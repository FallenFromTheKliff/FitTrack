import { GUARDS_METADATA } from '@nestjs/common/constants';

import { ActiveMemberCardGuard } from '../../common/guards/active-member-card.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkoutSessionController } from './session.controller';

function getGuardMetadata(
  methodName:
    | 'listSessions'
    | 'getSessionById'
    | 'startSession'
    | 'logSet'
    | 'completeSession'
    | 'cancelSession',
): unknown[] | undefined {
  return Reflect.getMetadata(
    GUARDS_METADATA,
    WorkoutSessionController.prototype[methodName],
  ) as unknown[] | undefined;
}

describe('WorkoutSessionController', () => {
  const workoutSessionService = {
    listSessions: jest.fn(),
    getSessionById: jest.fn(),
    startSession: jest.fn(),
    logSet: jest.fn(),
    completeSession: jest.fn(),
    cancelSession: jest.fn(),
  };

  let controller: WorkoutSessionController;

  beforeEach(() => {
    controller = new WorkoutSessionController(workoutSessionService as never);
    jest.clearAllMocks();
  });

  it.each([
    'listSessions',
    'getSessionById',
    'startSession',
    'logSet',
    'completeSession',
    'cancelSession',
  ] as const)('protects %s with JWT auth', (methodName) => {
    expect(getGuardMetadata(methodName)).toEqual([
      JwtAuthGuard,
      ActiveMemberCardGuard,
    ]);
  });

  it('lists sessions through the service', async () => {
    workoutSessionService.listSessions.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, total_pages: 0 },
    });

    await controller.listSessions({ sub: 'user-1' } as never, {
      page: 1,
      limit: 20,
    });

    expect(workoutSessionService.listSessions).toHaveBeenCalledWith('user-1', {
      page: 1,
      limit: 20,
    });
  });

  it('starts sessions through the service', async () => {
    workoutSessionService.startSession.mockResolvedValue({ id: 'session-1' });

    await controller.startSession({ sub: 'user-1' } as never, {
      plan_id: 'plan-1',
    });

    expect(workoutSessionService.startSession).toHaveBeenCalledWith('user-1', {
      plan_id: 'plan-1',
    });
  });

  it('logs sets through the service', async () => {
    workoutSessionService.logSet.mockResolvedValue({ id: 'log-1' });

    await controller.logSet('session-1', { sub: 'user-1' } as never, {
      exercise_id: 'exercise-1',
      set_number: 1,
      reps_completed: 10,
    });

    expect(workoutSessionService.logSet).toHaveBeenCalledWith(
      'user-1',
      'session-1',
      expect.objectContaining({
        exercise_id: 'exercise-1',
      }),
    );
  });

  it('completes sessions through the service', async () => {
    workoutSessionService.completeSession.mockResolvedValue({
      id: 'session-1',
    });

    await controller.completeSession('session-1', {
      sub: 'user-1',
    } as never);

    expect(workoutSessionService.completeSession).toHaveBeenCalledWith(
      'user-1',
      'session-1',
    );
  });

  it('cancels sessions through the service', async () => {
    workoutSessionService.cancelSession.mockResolvedValue({ id: 'session-1' });

    await controller.cancelSession('session-1', { sub: 'user-1' } as never);

    expect(workoutSessionService.cancelSession).toHaveBeenCalledWith(
      'user-1',
      'session-1',
    );
  });
});
