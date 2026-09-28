import { once } from 'node:events';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

import { ConfigService } from '@nestjs/config';

import { AiPythonClientService } from './ai-python-client.service';

async function getAvailablePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();

    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Unable to allocate an ephemeral port.'));
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(address.port);
      });
    });
  });
}

async function waitForHealthy(
  healthUrl: string,
  stdout: string[],
  stderr: string[],
): Promise<void> {
  const deadline = Date.now() + 20000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        const payload = (await response.json()) as { status?: string };
        if (payload.status === 'ok') {
          return;
        }
      }
    } catch {
      // Server is still starting.
    }

    await delay(250);
  }

  throw new Error(
    [
      'FastAPI pose app did not become healthy in time.',
      'stdout:',
      stdout.join(''),
      'stderr:',
      stderr.join(''),
    ].join('\n'),
  );
}

describe('AiPythonClientService (integration)', () => {
  jest.setTimeout(60000);

  let serverProcess: ChildProcessWithoutNullStreams | null = null;
  let apiBaseUrl: string;

  beforeAll(async () => {
    const port = await getAvailablePort();
    const repoRoot = join(__dirname, '..', '..', '..');
    const aiMicroserviceDir = join(repoRoot, 'ai-microservice');
    const stdout: string[] = [];
    const stderr: string[] = [];

    apiBaseUrl = `http://127.0.0.1:${port}`;
    const spawnedProcess = spawn(
      process.platform === 'win32' ? 'uv.exe' : 'uv',
      [
        'run',
        'uvicorn',
        'app.main:app',
        '--host',
        '127.0.0.1',
        '--port',
        String(port),
        '--log-level',
        'warning',
      ],
      {
        cwd: aiMicroserviceDir,
        env: {
          ...process.env,
          UV_CACHE_DIR: join(aiMicroserviceDir, '.uv-cache'),
          UV_PYTHON_INSTALL_DIR: join(aiMicroserviceDir, '.uv-python'),
          PYTHONUNBUFFERED: '1',
        },
        stdio: 'pipe',
      },
    );
    serverProcess = spawnedProcess;

    spawnedProcess.stdout.on('data', (chunk: Buffer) => {
      stdout.push(chunk.toString());
    });
    spawnedProcess.stderr.on('data', (chunk: Buffer) => {
      stderr.push(chunk.toString());
    });

    await waitForHealthy(`${apiBaseUrl}/health`, stdout, stderr);
  });

  afterAll(async () => {
    if (serverProcess && !serverProcess.killed) {
      const closePromise = once(serverProcess, 'close').catch(() => undefined);
      serverProcess.kill();
      await Promise.race([closePromise, delay(2000)]);
    }

    serverProcess?.stdout.destroy();
    serverProcess?.stderr.destroy();
    serverProcess = null;
  });

  it('completes the pose lifecycle against the real FastAPI contract', async () => {
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn((key: string, fallback?: string | number) => {
        if (key === 'ai.apiBaseUrl') {
          return apiBaseUrl;
        }

        if (key === 'ai.requestTimeoutMs') {
          return 10000;
        }

        return fallback;
      }),
    };
    const service = new AiPythonClientService(config as ConfigService);

    const bootstrap = await service.bootstrapPoseSession({
      poseSessionId: 'integration-pose-1',
      exerciseHint: 'Barbell Back Squat',
      starterCatalog: ['squat', 'push_up'],
      candidateProfiles: [
        {
          id: 'profile-1',
          canonical_name: 'squat',
          profile_kind: 'seed',
          landmark_signature: { left_shoulder: [0.1, 0.2] },
          angle_signature: { hip_knee_ankle: 92.4 },
          orientation_signature: { body_orientation: 'upright' },
          movement_pattern: { tracked_joint: 'knee_angle' },
          visibility_pattern: { min_visibility: 0.5 },
          rep_rules: { rep_start_angle: 88 },
        },
      ],
    });

    const firstAnalyze = await service.analyzePoseFrame({
      poseSessionId: 'integration-pose-1',
      frameBase64: 'frame-data-001',
    });
    await service.analyzePoseFrame({
      poseSessionId: 'integration-pose-1',
      frameBase64: 'frame-data-002',
    });
    const thirdAnalyze = await service.analyzePoseFrame({
      poseSessionId: 'integration-pose-1',
      frameBase64: 'frame-data-003',
    });
    const finalized = await service.finalizePoseSession({
      poseSessionId: 'integration-pose-1',
    });

    expect(bootstrap).toEqual({
      status: 'ready',
      accepted_fps: 15,
      subject_lock_mode: 'single_subject',
    });
    expect(firstAnalyze).toMatchObject({
      rep_event: false,
      matched_profile_id: 'profile-1',
      exercise_class: 'squat',
      subject_locked: true,
    });
    expect(thirdAnalyze).toMatchObject({
      rep_event: true,
      rep_count_delta: 1,
      exercise_class: 'squat',
    });
    expect(finalized).toEqual({
      detected_exercise_name: 'squat',
      matched_profile_id: 'profile-1',
      classification_confidence: 0.87,
      subject_lock_confidence: 0.853,
      analysis_summary: {
        reps_detected: 1,
        form_feedback: [
          'Keep your chest up.',
          'Drive through your heels.',
          'Maintain a controlled tempo.',
          'Rep counted cleanly.',
        ],
        average_confidence: 0.87,
        dominant_joint_angles: {
          hip_knee_ankle: 93.2,
          torso_hip_knee: 74.9,
        },
      },
      learned_profile: null,
    });
  });

  it('completes grounded gym-chat requests against the real FastAPI contract', async () => {
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn((key: string, fallback?: string | number) => {
        if (key === 'ai.apiBaseUrl') {
          return apiBaseUrl;
        }

        if (key === 'ai.requestTimeoutMs') {
          return 10000;
        }

        return fallback;
      }),
    };
    const service = new AiPythonClientService(config as ConfigService);

    const result = await service.chatGym({
      sessionId: 'gym-session-1',
      message: 'What membership plans do you offer right now?',
      grounding: {
        operating_hours: [
          {
            day_of_week: 1,
            opens_at: '06:00',
            closes_at: '22:00',
            is_closed: false,
            label: 'Weekday hours',
          },
        ],
        special_schedules: [
          {
            starts_on: '2026-12-24',
            ends_on: '2026-12-25',
            opens_at: '08:00',
            closes_at: '18:00',
            is_closed: false,
            reason: 'Christmas schedule',
            pricing_note: 'Holiday passes remain valid.',
          },
        ],
        faqs: [
          {
            category: 'membership',
            question: 'Do you offer walk-in rates?',
            answer: 'Yes, day passes are available at the front desk.',
            keywords: ['walk-in', 'day pass'],
          },
        ],
        membership_plans: [
          {
            name: 'Monthly Flex',
            price: 'PHP 1999',
            duration_days: 30,
            description: 'Month-to-month access.',
          },
        ],
        session_history: [
          {
            role: 'user',
            content: 'I want to compare your membership plans.',
          },
        ],
        user_context: {
          first_name: 'Alex',
          role: 'member',
          active_membership: true,
        },
      },
      policy: {
        gymOnly: true,
        refuseOutOfScope: true,
      },
    });

    expect(result).toEqual({
      reply: 'Alex, Membership option: Monthly Flex at PHP 1999 for 30 days.',
      out_of_scope: false,
      sources: ['membership_plans'],
      follow_up_suggestions: [
        'Ask which membership plan fits your visit frequency.',
      ],
      model_used: null,
      token_count: null,
    });
  });
});
