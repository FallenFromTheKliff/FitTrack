import type { Socket } from 'socket.io';

import type { PoseSessionResponseDTO } from './dto/pose.dto';
import { PoseGateway } from './pose.gateway';

type TestSocket = {
  id: string;
  handshake: {
    auth: { token: string };
    headers: Record<string, string>;
    query: { exercise_hint: string };
  };
  emit: jest.Mock;
  disconnect: jest.Mock;
};

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return {
    promise,
    resolve,
  };
}

function makeFinalizedSession(): PoseSessionResponseDTO {
  return {
    id: 'pose-1',
    user_id: 'user-1',
    exercise_log_id: null,
    exercise_hint: 'Barbell Back Squat',
    rep_count_ai: 2,
    confidence_avg: '0.91',
    detected_exercise_name: 'squat',
    detected_profile_id: 'profile-1',
    classification_confidence: '0.94',
    subject_lock_confidence: '0.88',
    analysis_summary: {
      reps_detected: 2,
      form_feedback: ['Keep your chest up.'],
    },
    started_at: '2026-03-27T08:00:00.000Z',
    ended_at: '2026-03-27T08:03:00.000Z',
    created_at: '2026-03-27T08:00:00.000Z',
    updated_at: '2026-03-27T08:03:00.000Z',
  };
}

describe('PoseGateway', () => {
  const poseService = {
    authenticateSocket: jest.fn(),
    startPoseSession: jest.fn(),
    normalizeExerciseHint: jest.fn(),
    analyzeFrame: jest.fn(),
    finalizePoseSession: jest.fn(),
  };

  let gateway: PoseGateway;

  beforeEach(() => {
    gateway = new PoseGateway(poseService as never);
    jest.clearAllMocks();
  });

function makeSocket(): TestSocket {
  return {
      id: 'socket-1',
      handshake: {
        auth: { token: 'token-1' },
        headers: {},
        query: { exercise_hint: 'Barbell Back Squat' },
      },
      emit: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as TestSocket;
  }

  function makeConnectedState() {
    return {
      poseSessionId: 'pose-1',
      userId: 'user-1',
      exerciseHint: 'Barbell Back Squat',
      repCountAi: 0,
      confidenceSum: 0,
      confidenceSamples: 0,
      acceptedFps: 15,
      subjectLockMode: 'single_subject' as const,
    };
  }

  it('creates a pose session on connect and emits the session bootstrap payload', async () => {
    const client = makeSocket();
    poseService.authenticateSocket.mockResolvedValue({ sub: 'user-1' });
    poseService.normalizeExerciseHint.mockReturnValue('Barbell Back Squat');
    poseService.startPoseSession.mockResolvedValue(makeConnectedState());

    await gateway.handleConnection(client as unknown as Socket);

    expect(poseService.startPoseSession).toHaveBeenCalledWith(
      'user-1',
      'Barbell Back Squat',
    );
    expect(client.emit).toHaveBeenCalledWith('pose.session.started', {
      pose_session_id: 'pose-1',
      accepted_fps: 15,
    });
  });

  it('emits movement-contract feedback updates from analyzed frames', async () => {
    const client = makeSocket();
    poseService.authenticateSocket.mockResolvedValue({ sub: 'user-1' });
    poseService.normalizeExerciseHint.mockReturnValue('Barbell Back Squat');
    poseService.startPoseSession.mockResolvedValue(makeConnectedState());
    poseService.analyzeFrame.mockResolvedValue({
      nextState: {
        ...makeConnectedState(),
        repCountAi: 1,
        confidenceSum: 0.93,
        confidenceSamples: 1,
      },
      analysis: {
        confidence: 0.93,
        exercise_class: 'squat',
        subject_locked: true,
        form_feedback: ['Drive through your heels.'],
        movement_contract: {
          exercise: 'squat',
          dominant_joint: 'knee',
          rep_thresholds: {
            down: { angle: 88, tolerance: 12 },
            up: { angle: 166, tolerance: 10 },
          },
          secondary_check: 'hip_depth',
          oscillating_joints: ['hip', 'knee'],
        },
      },
    });

    await gateway.handleConnection(client as unknown as Socket);
    await gateway.handleFrame(client as unknown as Socket, {
      frame_b64: 'frame-data',
    });

    expect(client.emit).toHaveBeenCalledWith('pose.feedback', {
      pose_session_id: 'pose-1',
      subject_locked: true,
      form_feedback: ['Drive through your heels.'],
      movement_contract: {
        exercise: 'squat',
        dominant_joint: 'knee',
        rep_thresholds: {
          down: { angle: 88, tolerance: 12 },
          up: { angle: 166, tolerance: 10 },
        },
        secondary_check: 'hip_depth',
        oscillating_joints: ['hip', 'knee'],
      },
      exercise_class: 'squat',
      confidence: 0.93,
    });
  });

  it('keeps only the latest queued frame while analysis is in flight', async () => {
    const client = makeSocket();
    const firstAnalysis = createDeferred<{
      nextState: ReturnType<typeof makeConnectedState>;
      analysis: {
        confidence: number;
        exercise_class: string;
        subject_locked: boolean;
        form_feedback: string[];
      };
    }>();
    const secondAnalysis = createDeferred<{
      nextState: ReturnType<typeof makeConnectedState>;
      analysis: {
        confidence: number;
        exercise_class: string;
        subject_locked: boolean;
        form_feedback: string[];
      };
    }>();

    poseService.authenticateSocket.mockResolvedValue({ sub: 'user-1' });
    poseService.normalizeExerciseHint.mockReturnValue('Barbell Back Squat');
    poseService.startPoseSession.mockResolvedValue(makeConnectedState());
    poseService.analyzeFrame
      .mockImplementationOnce(() => firstAnalysis.promise)
      .mockImplementationOnce(() => secondAnalysis.promise);

    await gateway.handleConnection(client as unknown as Socket);

    const firstFrame = gateway.handleFrame(client as unknown as Socket, {
      frame_b64: 'frame-1',
    });
    await Promise.resolve();

    const secondFrame = gateway.handleFrame(client as unknown as Socket, {
      frame_b64: 'frame-2',
    });
    const thirdFrame = gateway.handleFrame(client as unknown as Socket, {
      frame_b64: 'frame-3',
    });

    expect(poseService.analyzeFrame).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        poseSessionId: 'pose-1',
      }),
      'frame-1',
    );

    firstAnalysis.resolve({
      nextState: {
        ...makeConnectedState(),
        confidenceSum: 0.9,
        confidenceSamples: 1,
      },
      analysis: {
        confidence: 0.9,
        exercise_class: 'squat',
        subject_locked: true,
        form_feedback: ['Keep your chest up.'],
      },
    });
    await Promise.resolve();

    expect(poseService.analyzeFrame).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        poseSessionId: 'pose-1',
        confidenceSum: 0.9,
        confidenceSamples: 1,
      }),
      'frame-3',
    );

    secondAnalysis.resolve({
      nextState: {
        ...makeConnectedState(),
        confidenceSum: 1.82,
        confidenceSamples: 2,
      },
      analysis: {
        confidence: 0.92,
        exercise_class: 'squat',
        subject_locked: true,
        form_feedback: ['Maintain a controlled tempo.'],
      },
    });

    await Promise.all([firstFrame, secondFrame, thirdFrame]);

    expect(poseService.analyzeFrame).toHaveBeenCalledTimes(2);
  });

  it('finalizes the pose session through the shared stop flow', async () => {
    const client = makeSocket();
    poseService.authenticateSocket.mockResolvedValue({ sub: 'user-1' });
    poseService.normalizeExerciseHint.mockReturnValue('Barbell Back Squat');
    poseService.startPoseSession.mockResolvedValue(makeConnectedState());
    poseService.finalizePoseSession.mockResolvedValue(makeFinalizedSession());

    await gateway.handleConnection(client as unknown as Socket);
    await gateway.handleStop(client as unknown as Socket, {
      ended_reason: 'manual_stop',
    });

    expect(poseService.finalizePoseSession).toHaveBeenCalledWith(
      expect.objectContaining({
        poseSessionId: 'pose-1',
        userId: 'user-1',
      }),
      'manual_stop',
    );
    expect(client.emit).toHaveBeenCalledWith('pose.session.finalized', {
      pose_session_id: 'pose-1',
      detected_exercise_name: 'squat',
      classification_confidence: 0.94,
      summary: {
        reps_detected: 2,
        form_feedback: ['Keep your chest up.'],
      },
    });
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('finalizes the persisted pose session on disconnect', async () => {
    const client = makeSocket();
    poseService.authenticateSocket.mockResolvedValue({ sub: 'user-1' });
    poseService.normalizeExerciseHint.mockReturnValue('Barbell Back Squat');
    poseService.startPoseSession.mockResolvedValue(makeConnectedState());
    poseService.finalizePoseSession.mockResolvedValue(makeFinalizedSession());

    await gateway.handleConnection(client as unknown as Socket);
    await gateway.handleDisconnect(client as unknown as Socket);

    expect(poseService.finalizePoseSession).toHaveBeenCalledWith(
      expect.objectContaining({
        poseSessionId: 'pose-1',
        userId: 'user-1',
      }),
      'client_disconnect',
    );
    expect(client.emit).toHaveBeenCalledWith('pose.session.finalized', {
      pose_session_id: 'pose-1',
      detected_exercise_name: 'squat',
      classification_confidence: 0.94,
      summary: {
        reps_detected: 2,
        form_feedback: ['Keep your chest up.'],
      },
    });
  });
});
