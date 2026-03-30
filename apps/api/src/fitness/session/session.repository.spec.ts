import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, SessionStatus } from '@prisma/client';

import { WorkoutSessionRepository } from './session.repository';

describe('WorkoutSessionRepository', () => {
  const workoutSession = {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };

  const trainingPlan = {
    findUnique: jest.fn(),
  };

  const exerciseCatalog = {
    findFirst: jest.fn(),
  };

  const poseSession = {
    findUnique: jest.fn(),
    update: jest.fn(),
  };

  const exerciseLog = {
    create: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  };

  const tx = {
    exerciseLog,
    poseSession,
    workoutSession,
  };

  const prisma = {
    workoutSession,
    trainingPlan,
    exerciseCatalog,
    poseSession,
    exerciseLog,
    $transaction: jest.fn(),
  };

  let repo: WorkoutSessionRepository;

  beforeEach(() => {
    repo = new WorkoutSessionRepository(prisma as never);
    prisma.$transaction.mockImplementation(
      async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    );
    jest.clearAllMocks();
  });

  it('lists sessions with started_at date filtering and pagination', async () => {
    workoutSession.findMany.mockResolvedValue([{ id: 'session-1' }]);
    workoutSession.count.mockResolvedValue(1);

    await repo.getMySessions('user-1', {
      start_date: '2026-03-01',
      end_date: '2026-03-31',
      page: 2,
      limit: 10,
    });

    expect(workoutSession.findMany).toHaveBeenCalledWith({
      where: {
        user_id: 'user-1',
        started_at: {
          gte: new Date('2026-03-01'),
          lte: new Date('2026-03-31'),
        },
      },
      include: {
        plan: {
          select: {
            id: true,
            title: true,
            goal: true,
            source: true,
          },
        },
        _count: {
          select: {
            exercise_logs: true,
          },
        },
      },
      orderBy: [{ started_at: 'desc' }, { created_at: 'desc' }],
      skip: 10,
      take: 10,
    });
  });

  it('loads a detailed session with ordered exercise logs', async () => {
    workoutSession.findUnique.mockResolvedValue({ id: 'session-1' });

    await repo.findSessionByIdOrThrow('session-1');

    expect(workoutSession.findUnique).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      include: {
        plan: {
          select: {
            id: true,
            title: true,
            goal: true,
            source: true,
          },
        },
        exercise_logs: {
          orderBy: [{ created_at: 'asc' }, { set_number: 'asc' }],
          include: {
            exercise: true,
            pose_session: {
              select: {
                id: true,
                rep_count_ai: true,
                confidence_avg: true,
                started_at: true,
                ended_at: true,
              },
            },
          },
        },
      },
      select: undefined,
    });
  });

  it('creates sessions with initial lifecycle timestamps', async () => {
    workoutSession.create.mockResolvedValue({ id: 'session-1' });
    const startedAt = new Date('2026-03-26T08:00:00.000Z');

    await repo.createSession({
      userId: 'user-1',
      planId: 'plan-1',
      startedAt,
    });

    expect(workoutSession.create).toHaveBeenCalledWith({
      data: {
        user: { connect: { id: 'user-1' } },
        plan: { connect: { id: 'plan-1' } },
        status: SessionStatus.in_progress,
        started_at: startedAt,
        last_activity_at: startedAt,
      },
      include: {
        plan: {
          select: {
            id: true,
            title: true,
            goal: true,
            source: true,
          },
        },
        exercise_logs: {
          orderBy: [{ created_at: 'asc' }, { set_number: 'asc' }],
          include: {
            exercise: true,
            pose_session: {
              select: {
                id: true,
                rep_count_ai: true,
                confidence_avg: true,
                started_at: true,
                ended_at: true,
              },
            },
          },
        },
      },
    });
  });

  it('loads pose-session ownership context without broadening the S7 linkage contract', async () => {
    poseSession.findUnique.mockResolvedValue({ id: 'pose-1' });

    await repo.findPoseSessionByIdOrThrow('pose-1');

    expect(poseSession.findUnique).toHaveBeenCalledWith({
      where: { id: 'pose-1' },
      include: undefined,
      select: {
        id: true,
        user_id: true,
        exercise_log_id: true,
        rep_count_ai: true,
      },
    });
  });

  it('creates exercise logs transactionally, links pose sessions, and refreshes last activity', async () => {
    exerciseLog.create.mockResolvedValue({ id: 'log-1' });
    exerciseLog.findUniqueOrThrow.mockResolvedValue({ id: 'log-1' });
    poseSession.update.mockResolvedValue({ id: 'pose-1' });
    workoutSession.update.mockResolvedValue({ id: 'session-1' });

    await repo.createExerciseLog({
      sessionId: 'session-1',
      userId: 'user-1',
      exerciseId: 'exercise-1',
      setNumber: 1,
      repsCompleted: 10,
      repsAiCounted: 12,
      weightKg: new Prisma.Decimal('42.5'),
      durationSeconds: null,
      poseSessionId: 'pose-1',
      loggedAt: new Date('2026-03-26T08:15:00.000Z'),
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(exerciseLog.create).toHaveBeenCalledWith({
      data: {
        session: { connect: { id: 'session-1' } },
        user: { connect: { id: 'user-1' } },
        exercise: { connect: { id: 'exercise-1' } },
        set_number: 1,
        reps_completed: 10,
        reps_ai_counted: 12,
        weight_kg: new Prisma.Decimal('42.5'),
        duration_seconds: null,
      },
    });
    expect(poseSession.update).toHaveBeenCalledWith({
      where: { id: 'pose-1' },
      data: {
        exercise_log: { connect: { id: 'log-1' } },
      },
    });
    expect(workoutSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { last_activity_at: new Date('2026-03-26T08:15:00.000Z') },
    });
  });

  it('translates duplicate set inserts into a conflict error', async () => {
    exerciseLog.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      repo.createExerciseLog({
        sessionId: 'session-1',
        userId: 'user-1',
        exerciseId: 'exercise-1',
        setNumber: 1,
        repsCompleted: 10,
        repsAiCounted: null,
        weightKg: null,
        durationSeconds: null,
        poseSessionId: null,
        loggedAt: new Date('2026-03-26T08:15:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('cancels abandoned in-progress sessions in bulk', async () => {
    workoutSession.updateMany.mockResolvedValue({ count: 2 });

    await expect(
      repo.cancelAbandonedInProgressSessions(
        new Date('2026-03-26T06:00:00.000Z'),
        new Date('2026-03-26T08:00:00.000Z'),
      ),
    ).resolves.toBe(2);

    expect(workoutSession.updateMany).toHaveBeenCalledWith({
      where: {
        status: SessionStatus.in_progress,
        last_activity_at: { lt: new Date('2026-03-26T06:00:00.000Z') },
      },
      data: {
        status: SessionStatus.cancelled,
        cancelled_at: new Date('2026-03-26T08:00:00.000Z'),
        last_activity_at: new Date('2026-03-26T08:00:00.000Z'),
      },
    });
  });

  it('throws not found when the plan ownership context is missing', async () => {
    trainingPlan.findUnique.mockResolvedValue(null);

    await expect(
      repo.findPlanOwnershipContextByIdOrThrow('plan-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
