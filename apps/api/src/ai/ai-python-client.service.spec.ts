import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExerciseCategory } from '@prisma/client';

import { AiPythonClientService } from './ai-python-client.service';

describe('AiPythonClientService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('throws when required AI config is missing', async () => {
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn().mockReturnValue(''),
    };
    const service = new AiPythonClientService(config as ConfigService);

    await expect(service.assertHealthy()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('posts generation requests to the dedicated Python service boundary', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          weeks: [
            {
              week_number: 1,
              days: [
                {
                  day_of_week: 1,
                  exercises: [{ name: 'Barbell Back Squat', sets: 4 }],
                },
              ],
            },
          ],
          token_count: 321,
          model_used: 'fittrack-llama',
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);
    const result = await service.generatePlan({
      userContext: {
        age: 28,
        gender: 'male',
        weight_kg: 78,
        height_cm: 175,
        activity_level: 'moderate',
        fitness_goal: 'bulking',
      },
      planInput: {
        duration_weeks: 8,
        days_per_week: 4,
        preferences: 'Prefer barbells',
      },
      allowedExercises: [
        {
          name: 'Barbell Back Squat',
          muscle_group: 'legs',
          category: ExerciseCategory.strength,
        },
      ],
    });

    const calls = fetchMock.mock.calls as Array<
      [RequestInfo | URL, RequestInit | undefined]
    >;
    const [url, init] = calls[0] ?? [];
    const requestBody = typeof init?.body === 'string' ? init.body : '';
    const body = JSON.parse(requestBody) as {
      user_context: { gender: string };
      allowed_exercises: Array<{ name: string }>;
    };

    expect(url).toBe('https://ai.fittrack.test/generate-plan');
    expect(init?.method).toBe('POST');
    expect(body.user_context.gender).toBe('male');
    expect(body.allowed_exercises[0]?.name).toBe('Barbell Back Squat');
    expect(result).toEqual({
      weeks: [
        {
          week_number: 1,
          days: [
            {
              day_of_week: 1,
              exercises: [{ name: 'Barbell Back Squat', sets: 4 }],
            },
          ],
        },
      ],
      token_count: 321,
      model_used: 'fittrack-llama',
    });
  });

  it('rejects invalid upstream generation payloads', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ invalid: true }), { status: 200 }),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);

    await expect(
      service.generatePlan({
        userContext: {
          age: 28,
          gender: 'male',
          weight_kg: 78,
          height_cm: 175,
          activity_level: 'moderate',
          fitness_goal: 'bulking',
        },
        planInput: {
          duration_weeks: 8,
          days_per_week: 4,
        },
        allowedExercises: [],
      }),
    ).rejects.toThrow(HttpException);
  });

  it('posts chat requests to the dedicated Python service boundary', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          content: 'Let us work through your nutrition goals.',
          action: 'NONE',
          params: null,
          token_count: 77,
          model_used: 'fittrack-llama',
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);
    const result = await service.chat({
      messages: [{ role: 'user', content: 'Help me with nutrition.' }],
      userContext: {
        age: 28,
        gender: 'male',
        weight_kg: 78,
        height_cm: 175,
        activity_level: 'moderate',
        fitness_goal: 'cutting',
      },
      sessionContext: {
        session_id: 'session-1',
        context_type: 'nutrition',
      },
    });

    const calls = fetchMock.mock.calls as Array<
      [RequestInfo | URL, RequestInit | undefined]
    >;
    const [url, init] = calls[0] ?? [];
    const requestBody = typeof init?.body === 'string' ? init.body : '';
    const body = JSON.parse(requestBody) as {
      messages: Array<{ role: string; content: string }>;
      session_context: { context_type: string };
    };

    expect(url).toBe('https://ai.fittrack.test/chat');
    expect(init?.method).toBe('POST');
    expect(body.messages[0]).toEqual({
      role: 'user',
      content: 'Help me with nutrition.',
    });
    expect(body.session_context.context_type).toBe('nutrition');
    expect(result).toEqual({
      content: 'Let us work through your nutrition goals.',
      action: 'NONE',
      params: null,
      token_count: 77,
      model_used: 'fittrack-llama',
    });
  });

  it('rejects malformed upstream chat payloads', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ content: '', action: 'NONE' }), {
        status: 200,
      }),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);

    await expect(
      service.chat({
        messages: [{ role: 'user', content: 'Help me with nutrition.' }],
        userContext: {
          age: 28,
          gender: 'male',
          weight_kg: 78,
          height_cm: 175,
          activity_level: 'moderate',
          fitness_goal: 'cutting',
        },
        sessionContext: {
          session_id: 'session-1',
          context_type: 'nutrition',
        },
      }),
    ).rejects.toThrow(HttpException);
  });

  it('posts grounded gym-chat requests to the dedicated Python service boundary', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          reply: 'Current promotion: Summer Starter Pack (SUMMER26).',
          out_of_scope: false,
          sources: ['promotions'],
          follow_up_suggestions: [
            'Ask whether the current promotion applies to new members.',
          ],
          token_count: 21,
          model_used: 'fittrack-llama',
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);
    const result = await service.chatGym({
      sessionId: 'session-1',
      message: 'What promotions are active right now?',
      grounding: {
        operating_hours: [],
        special_schedules: [],
        promotions: [],
        faqs: [],
        membership_plans: [],
        session_history: [],
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

    const calls = fetchMock.mock.calls as Array<
      [RequestInfo | URL, RequestInit | undefined]
    >;
    const [url, init] = calls[0] ?? [];
    const requestBody = typeof init?.body === 'string' ? init.body : '';
    const body = JSON.parse(requestBody) as {
      session_id: string;
      message: string;
      policy: {
        gym_only: boolean;
        refuse_out_of_scope: boolean;
      };
    };

    expect(url).toBe('https://ai.fittrack.test/chat/gym');
    expect(init?.method).toBe('POST');
    expect(body).toMatchObject({
      session_id: 'session-1',
      message: 'What promotions are active right now?',
      policy: {
        gym_only: true,
        refuse_out_of_scope: true,
      },
    });
    expect(result).toEqual({
      reply: 'Current promotion: Summer Starter Pack (SUMMER26).',
      out_of_scope: false,
      sources: ['promotions'],
      follow_up_suggestions: [
        'Ask whether the current promotion applies to new members.',
      ],
      token_count: 21,
      model_used: 'fittrack-llama',
    });
  });

  it('rejects malformed upstream gym-chat payloads', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          reply: '',
          out_of_scope: false,
          sources: ['promotions'],
          follow_up_suggestions: [],
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);

    await expect(
      service.chatGym({
        sessionId: 'session-1',
        message: 'What promotions are active right now?',
        grounding: {
          operating_hours: [],
          special_schedules: [],
          promotions: [],
          faqs: [],
          membership_plans: [],
          session_history: [],
        },
        policy: {
          gymOnly: true,
          refuseOutOfScope: true,
        },
      }),
    ).rejects.toThrow(HttpException);
  });

  it('posts tdee recalculation requests to the dedicated Python service boundary', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          bmr: 1700.25,
          tdee: 2450.5,
          target_calories: 2200,
          protein_g: 180,
          carbs_g: 210,
          fat_g: 65,
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);
    const result = await service.calculateTdee({
      age: 28,
      gender: 'male',
      weight_kg: 78,
      height_cm: 175,
      activity_level: 'moderate',
      fitness_goal: 'cutting',
    });

    const calls = fetchMock.mock.calls as Array<
      [RequestInfo | URL, RequestInit | undefined]
    >;
    const [url, init] = calls[0] ?? [];
    const requestBody = typeof init?.body === 'string' ? init.body : '';
    const body = JSON.parse(requestBody) as {
      age: number;
      gender: string;
      fitness_goal: string;
    };

    expect(url).toBe('https://ai.fittrack.test/calculate-tdee');
    expect(init?.method).toBe('POST');
    expect(body).toMatchObject({
      age: 28,
      gender: 'male',
      fitness_goal: 'cutting',
    });
    expect(result).toEqual({
      bmr: 1700.25,
      tdee: 2450.5,
      target_calories: 2200,
      protein_g: 180,
      carbs_g: 210,
      fat_g: 65,
    });
  });

  it('rejects invalid upstream tdee payloads', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          bmr: '1700.25',
          tdee: 2450.5,
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);

    await expect(
      service.calculateTdee({
        age: 28,
        gender: 'male',
        weight_kg: 78,
        height_cm: 175,
        activity_level: 'moderate',
        fitness_goal: 'cutting',
      }),
    ).rejects.toThrow(HttpException);
  });

  it('posts pose-analysis requests to the Python service boundary', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          rep_event: true,
          confidence: 0.94,
          exercise_class: 'squat',
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);
    const result = await service.analyzePoseFrame({
      poseSessionId: 'pose-1',
      frameBase64: 'frame-data',
    });

    const calls = fetchMock.mock.calls as Array<
      [RequestInfo | URL, RequestInit | undefined]
    >;
    const [url, init] = calls[0] ?? [];
    const requestBody = typeof init?.body === 'string' ? init.body : '';
    const body = JSON.parse(requestBody) as {
      pose_session_id: string;
      frame_b64: string;
    };

    expect(url).toBe('https://ai.fittrack.test/pose/analyze');
    expect(init?.method).toBe('POST');
    expect(body.pose_session_id).toBe('pose-1');
    expect(body.frame_b64).toBe('frame-data');
    expect(result).toEqual({
      rep_event: true,
      confidence: 0.94,
      exercise_class: 'squat',
    });
  });

  it('rejects invalid pose-analysis payloads', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          rep_event: true,
          rep_count_delta: 1.5,
          confidence: 0.94,
          exercise_class: 'squat',
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);

    await expect(
      service.analyzePoseFrame({
        poseSessionId: 'pose-1',
        frameBase64: 'frame-data',
      }),
    ).rejects.toThrow(HttpException);
  });

  it('posts pose-session bootstrap requests to the Python service boundary', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'ready',
          accepted_fps: 15,
          subject_lock_mode: 'single_subject',
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);
    const result = await service.bootstrapPoseSession({
      poseSessionId: 'pose-1',
      exerciseHint: 'Barbell Back Squat',
      starterCatalog: ['squat', 'push_up'],
      candidateProfiles: [
        {
          id: 'profile-1',
          canonical_name: 'squat',
          profile_kind: 'seed',
          landmark_signature: { left_shoulder: [0.1, 0.2] },
          angle_signature: { hip_knee_ankle: 92.4 },
          rep_rules: { rep_start_angle: 88 },
        },
      ],
    });

    const calls = fetchMock.mock.calls as Array<
      [RequestInfo | URL, RequestInit | undefined]
    >;
    const [url, init] = calls[0] ?? [];
    const requestBody = typeof init?.body === 'string' ? init.body : '';
    const body = JSON.parse(requestBody) as {
      pose_session_id: string;
      starter_catalog: string[];
      candidate_profiles: Array<{ canonical_name: string }>;
    };

    expect(url).toBe('https://ai.fittrack.test/pose/session/bootstrap');
    expect(init?.method).toBe('POST');
    expect(body.pose_session_id).toBe('pose-1');
    expect(body.starter_catalog).toEqual(['squat', 'push_up']);
    expect(body.candidate_profiles[0]?.canonical_name).toBe('squat');
    expect(result).toEqual({
      status: 'ready',
      accepted_fps: 15,
      subject_lock_mode: 'single_subject',
    });
  });

  it('posts pose-session finalize requests to the Python service boundary', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          detected_exercise_name: 'squat',
          matched_profile_id: 'profile-1',
          classification_confidence: 0.94,
          subject_lock_confidence: 0.88,
          analysis_summary: {
            reps_detected: 12,
            form_feedback: ['Keep your chest up.'],
            average_confidence: 0.91,
            dominant_joint_angles: { hip_knee_ankle: 92.4 },
          },
          learned_profile: {
            canonical_name: 'squat',
            landmark_signature: { left_shoulder: [0.1, 0.2] },
            angle_signature: { hip_knee_ankle: 92.4 },
            rep_rules: { rep_start_angle: 88 },
          },
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);
    const result = await service.finalizePoseSession({
      poseSessionId: 'pose-1',
    });

    const calls = fetchMock.mock.calls as Array<
      [RequestInfo | URL, RequestInit | undefined]
    >;
    const [url, init] = calls[0] ?? [];
    const requestBody = typeof init?.body === 'string' ? init.body : '';
    const body = JSON.parse(requestBody) as { pose_session_id: string };

    expect(url).toBe('https://ai.fittrack.test/pose/session/finalize');
    expect(init?.method).toBe('POST');
    expect(body.pose_session_id).toBe('pose-1');
    expect(result).toEqual({
      detected_exercise_name: 'squat',
      matched_profile_id: 'profile-1',
      classification_confidence: 0.94,
      subject_lock_confidence: 0.88,
      analysis_summary: {
        reps_detected: 12,
        form_feedback: ['Keep your chest up.'],
        average_confidence: 0.91,
        dominant_joint_angles: { hip_knee_ankle: 92.4 },
      },
      learned_profile: {
        canonical_name: 'squat',
        landmark_signature: { left_shoulder: [0.1, 0.2] },
        angle_signature: { hip_knee_ankle: 92.4 },
        rep_rules: { rep_start_angle: 88 },
      },
    });
  });

  it('rejects invalid pose bootstrap payloads', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'ready',
          accepted_fps: 0,
          subject_lock_mode: 'single_subject',
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);

    await expect(
      service.bootstrapPoseSession({
        poseSessionId: 'pose-1',
        exerciseHint: null,
        starterCatalog: [],
        candidateProfiles: [],
      }),
    ).rejects.toThrow(HttpException);
  });

  it('rejects invalid pose finalize payloads', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          detected_exercise_name: 'squat',
          matched_profile_id: null,
          classification_confidence: 0.94,
          subject_lock_confidence: 0.88,
          analysis_summary: {
            reps_detected: 12,
            form_feedback: ['Keep your chest up.'],
            average_confidence: 0.91,
            dominant_joint_angles: { hip_knee_ankle: '92.4' },
          },
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);

    await expect(
      service.finalizePoseSession({
        poseSessionId: 'pose-1',
      }),
    ).rejects.toThrow(HttpException);
  });

  it('posts business insight requests to the dedicated Python analytics boundary', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          summary: 'Attendance softened late in the month.',
          highlights: ['Membership revenue remained stable.'],
          risks: ['Late-month check-ins declined.'],
          opportunities: ['Upsell high-performing plans during peak hours.'],
          anomaly_flags: ['Week four attendance dropped 18%.'],
          recommended_actions: ['Review class scheduling for the final week.'],
          token_count: 144,
          model_used: 'openrouter/model',
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);
    const result = await service.generateBusinessInsight({
      grounding: {
        window: {
          start_date: '2026-03-01',
          end_date: '2026-03-31',
          period: 'monthly',
          focus: 'overview',
        },
        overview: {
          total_revenue: '8849.00',
          total_check_ins: 342,
          new_members: 18,
          completed_coaching_sessions: 24,
        },
        revenue: {
          totals: {
            membership_revenue: '4999.00',
            booking_revenue: '1200.00',
            product_revenue: '850.00',
            coaching_payments_collected: '3000.00',
            coaching_gym_revenue: '1800.00',
            total_revenue: '8849.00',
          },
          series: [],
        },
        attendance: {
          series: [],
          peak_hours: [],
        },
        membership: {
          new_members: 18,
          active_members: 124,
          top_plans: [],
        },
        coaching: {
          coaches: [],
        },
      },
    });

    const calls = fetchMock.mock.calls as Array<
      [RequestInfo | URL, RequestInit | undefined]
    >;
    const [url, init] = calls[0] ?? [];
    const requestBody = typeof init?.body === 'string' ? init.body : '';
    const body = JSON.parse(requestBody) as {
      grounding: {
        window: { focus: string; period: string };
      };
    };

    expect(url).toBe('https://ai.fittrack.test/analytics/insights');
    expect(init?.method).toBe('POST');
    expect(body.grounding.window.focus).toBe('overview');
    expect(body.grounding.window.period).toBe('monthly');
    expect(result).toEqual({
      summary: 'Attendance softened late in the month.',
      highlights: ['Membership revenue remained stable.'],
      risks: ['Late-month check-ins declined.'],
      opportunities: ['Upsell high-performing plans during peak hours.'],
      anomaly_flags: ['Week four attendance dropped 18%.'],
      recommended_actions: ['Review class scheduling for the final week.'],
      token_count: 144,
      model_used: 'openrouter/model',
    });
  });

  it('rejects malformed upstream business insight payloads', async () => {
    const configValues = {
      'ai.apiBaseUrl': 'https://ai.fittrack.test',
      'ai.requestTimeoutMs': 10000,
    };
    const config: Pick<ConfigService, 'get'> = {
      get: jest.fn(
        (key: string, fallback?: string | number) =>
          configValues[key as keyof typeof configValues] ?? fallback,
      ),
    };
    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          summary: '',
          highlights: [],
          risks: [],
          opportunities: [],
          anomaly_flags: [],
          recommended_actions: [],
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;

    const service = new AiPythonClientService(config as ConfigService);

    await expect(
      service.generateBusinessInsight({
        grounding: {
          window: {
            start_date: '2026-03-01',
            end_date: '2026-03-31',
            period: 'monthly',
            focus: 'overview',
          },
          overview: {
            total_revenue: '8849.00',
            total_check_ins: 342,
            new_members: 18,
            completed_coaching_sessions: 24,
          },
          revenue: {
            totals: {
              membership_revenue: '4999.00',
              booking_revenue: '1200.00',
              product_revenue: '850.00',
              coaching_payments_collected: '3000.00',
              coaching_gym_revenue: '1800.00',
              total_revenue: '8849.00',
            },
            series: [],
          },
          attendance: {
            series: [],
            peak_hours: [],
          },
          membership: {
            new_members: 18,
            active_members: 124,
            top_plans: [],
          },
          coaching: {
            coaches: [],
          },
        },
      }),
    ).rejects.toThrow(HttpException);
  });
});
