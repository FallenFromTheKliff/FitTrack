import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  INestApplication,
  UnauthorizedException,
  UnprocessableEntityException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ExerciseCategory,
  FitnessGoal,
  PlanSource,
  SessionStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import request from 'supertest';

import { AiController } from '../src/ai/ai.controller';
import { AiService } from '../src/ai/ai.service';
import type { JwtPayload } from '../src/auth/types/jwt-payload.type';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { JwtAuthGuard, RolesGuard } from '../src/common/guards';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { ExerciseController } from '../src/fitness/exercise/exercise.controller';
import { ExerciseService } from '../src/fitness/exercise/exercise.service';
import { GamificationController } from '../src/fitness/gamification/gamification.controller';
import { GamificationService } from '../src/fitness/gamification/gamification.service';
import { WorkoutSessionController } from '../src/fitness/session/session.controller';
import { WorkoutSessionService } from '../src/fitness/session/session.service';
import { TrainingPlanController } from '../src/fitness/training-plan/training-plan.controller';
import { TrainingPlanService } from '../src/fitness/training-plan/training-plan.service';

type ExerciseServiceMethods =
  | 'listExercises'
  | 'getExerciseById'
  | 'createExercise'
  | 'updateExercise';

type TrainingPlanServiceMethods =
  | 'listPlans'
  | 'getPlanById'
  | 'createPlan'
  | 'deletePlan'
  | 'assignPlan';

type WorkoutSessionServiceMethods =
  | 'listSessions'
  | 'getSessionById'
  | 'startSession'
  | 'logSet'
  | 'completeSession'
  | 'cancelSession';

type GamificationServiceMethods = 'getMuscleMastery' | 'getLeaderboard';
type AiServiceMethods =
  | 'chat'
  | 'getMyChatSessions'
  | 'getChatSessionById'
  | 'getChatMessages'
  | 'archiveSession'
  | 'generatePlan';

type ExerciseServiceMock = jest.Mocked<
  Pick<ExerciseService, ExerciseServiceMethods>
>;
type TrainingPlanServiceMock = jest.Mocked<
  Pick<TrainingPlanService, TrainingPlanServiceMethods>
>;
type WorkoutSessionServiceMock = jest.Mocked<
  Pick<WorkoutSessionService, WorkoutSessionServiceMethods>
>;
type GamificationServiceMock = jest.Mocked<
  Pick<GamificationService, GamificationServiceMethods>
>;
type AiServiceMock = jest.Mocked<Pick<AiService, AiServiceMethods>>;

type ExerciseListResult = Awaited<ReturnType<ExerciseService['listExercises']>>;
type ExerciseRecord = Awaited<ReturnType<ExerciseService['getExerciseById']>>;
type TrainingPlanDetailRecord = Awaited<
  ReturnType<TrainingPlanService['getPlanById']>
>;
type WorkoutSessionDetailRecord = Awaited<
  ReturnType<WorkoutSessionService['getSessionById']>
>;
type MuscleMasteryRecord = Awaited<
  ReturnType<GamificationService['getMuscleMastery']>
>[number];
type LeaderboardRecord = Awaited<
  ReturnType<GamificationService['getLeaderboard']>
>['data'][number];

const USERS: Record<string, JwtPayload> = {
  admin: {
    sub: '11111111-1111-4111-8111-111111111111',
    role: UserRole.admin,
    status: UserStatus.active,
    jti: 'admin-jti',
    iat: 1,
    exp: 9999999999,
  },
  member: {
    sub: '22222222-2222-4222-8222-222222222222',
    role: UserRole.member,
    status: UserStatus.active,
    jti: 'member-jti',
    iat: 1,
    exp: 9999999999,
  },
  coach: {
    sub: '33333333-3333-4333-8333-333333333333',
    role: UserRole.staff,
    status: UserStatus.active,
    jti: 'coach-jti',
    iat: 1,
    exp: 9999999999,
  },
};

function createExerciseServiceMock(): ExerciseServiceMock {
  return {
    listExercises: jest.fn(),
    getExerciseById: jest.fn(),
    createExercise: jest.fn(),
    updateExercise: jest.fn(),
  };
}

function createTrainingPlanServiceMock(): TrainingPlanServiceMock {
  return {
    listPlans: jest.fn(),
    getPlanById: jest.fn(),
    createPlan: jest.fn(),
    deletePlan: jest.fn(),
    assignPlan: jest.fn(),
  };
}

function createWorkoutSessionServiceMock(): WorkoutSessionServiceMock {
  return {
    listSessions: jest.fn(),
    getSessionById: jest.fn(),
    startSession: jest.fn(),
    logSet: jest.fn(),
    completeSession: jest.fn(),
    cancelSession: jest.fn(),
  };
}

function createAiServiceMock(): AiServiceMock {
  return {
    chat: jest.fn(),
    getMyChatSessions: jest.fn(),
    getChatSessionById: jest.fn(),
    getChatMessages: jest.fn(),
    archiveSession: jest.fn(),
    generatePlan: jest.fn(),
  };
}

function createGamificationServiceMock(): GamificationServiceMock {
  return {
    getMuscleMastery: jest.fn(),
    getLeaderboard: jest.fn(),
  };
}

function createExerciseRecord(
  overrides: Partial<ExerciseRecord> = {},
): ExerciseRecord {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: 'Barbell Back Squat',
    muscle_group: 'legs',
    category: ExerciseCategory.strength,
    description: 'Compound lower-body strength builder.',
    instructions: 'Brace, descend with control, then drive up.',
    video_url: 'https://cdn.fittrack.test/videos/barbell-back-squat.mp4',
    image_url: 'https://cdn.fittrack.test/images/barbell-back-squat.png',
    is_active: true,
    created_at: '2026-03-26T00:00:00.000Z',
    updated_at: '2026-03-26T00:00:00.000Z',
    ...overrides,
  };
}

function createExerciseListResult(
  overrides: Partial<ExerciseListResult> = {},
): ExerciseListResult {
  return {
    data: [createExerciseRecord()],
    meta: {
      page: 1,
      limit: 20,
      total: 1,
      total_pages: 1,
    },
    ...overrides,
  };
}

function createTrainingPlanDetailRecord(
  overrides: Partial<TrainingPlanDetailRecord> = {},
): TrainingPlanDetailRecord {
  return {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    user_id: USERS.member.sub,
    coach_id: null,
    source: PlanSource.self_created,
    title: 'Upper / Lower Strength Builder',
    goal: FitnessGoal.bulking,
    duration_weeks: 8,
    days_per_week: 4,
    is_active: true,
    is_template: false,
    created_at: '2026-03-26T00:00:00.000Z',
    updated_at: '2026-03-26T00:00:00.000Z',
    schedule_days: [
      {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        week_number: 1,
        day_of_week: 1,
        focus_label: 'Upper Body Strength',
        notes: 'Start conservatively this week.',
        exercises: [
          {
            id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            exercise_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            exercise_name: 'Barbell Back Squat',
            muscle_group: 'legs',
            category: ExerciseCategory.strength,
            sets: 4,
            reps: 8,
            duration_seconds: null,
            rest_seconds: 120,
            weight_kg_target: '80',
            notes: null,
            order_index: 1,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function createWorkoutSessionDetailRecord(
  overrides: Partial<WorkoutSessionDetailRecord> = {},
): WorkoutSessionDetailRecord {
  return {
    id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    user_id: USERS.member.sub,
    plan_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    status: SessionStatus.in_progress,
    started_at: '2026-03-26T01:00:00.000Z',
    completed_at: null,
    cancelled_at: null,
    duration_seconds: null,
    total_volume_kg: '480',
    last_activity_at: '2026-03-26T01:15:00.000Z',
    exercise_log_count: 1,
    plan: {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      title: 'Upper / Lower Strength Builder',
      goal: FitnessGoal.bulking,
      source: PlanSource.self_created,
    },
    created_at: '2026-03-26T01:00:00.000Z',
    updated_at: '2026-03-26T01:15:00.000Z',
    exercise_logs: [
      {
        id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        session_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        user_id: USERS.member.sub,
        plan_exercise_id: null,
        exercise_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        exercise_name: 'Barbell Back Squat',
        set_number: 1,
        reps_completed: 8,
        reps_ai_counted: null,
        weight_kg: '60',
        duration_seconds: null,
        pose_session: null,
        created_at: '2026-03-26T01:15:00.000Z',
        updated_at: '2026-03-26T01:15:00.000Z',
      },
    ],
    ...overrides,
  };
}

function createMuscleMasteryRecord(
  overrides: Partial<MuscleMasteryRecord> = {},
): MuscleMasteryRecord {
  return {
    id: 'abababab-abab-4bab-8bab-abababababab',
    user_id: USERS.member.sub,
    muscle_group: 'legs',
    total_volume_kg: '12500.00',
    xp_points: 2750,
    rank: 'gold',
    rank_display: 'Gold',
    last_ranked_at: '2026-03-27T04:00:00.000Z',
    created_at: '2026-03-27T02:00:00.000Z',
    updated_at: '2026-03-27T04:00:00.000Z',
    ...overrides,
  };
}

function createLeaderboardRecord(
  overrides: Partial<LeaderboardRecord> = {},
): LeaderboardRecord {
  return {
    rank_position: 1,
    user_id: USERS.member.sub,
    display_name: 'Fit Track',
    avatar_url: 'https://cdn.fittrack.test/avatars/fit.png',
    total_xp: 2750,
    ...overrides,
  };
}

function getHttpServer(app: INestApplication): Parameters<typeof request>[0] {
  return app.getHttpServer() as Parameters<typeof request>[0];
}

@Injectable()
class TestJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: JwtPayload;
      query?: Record<string, string | undefined>;
    }>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        type: 'UNAUTHORIZED',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid or missing authentication token.',
      });
    }

    const actor = authorization.slice('Bearer '.length).trim();
    const user = USERS[actor];

    if (!user) {
      throw new UnauthorizedException({
        type: 'UNAUTHORIZED',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid or missing authentication token.',
      });
    }

    request.user = user;
    return true;
  }
}

describe('S7 Controllers (e2e)', () => {
  let app: INestApplication;
  let exerciseService: ExerciseServiceMock;
  let trainingPlanService: TrainingPlanServiceMock;
  let workoutSessionService: WorkoutSessionServiceMock;
  let gamificationService: GamificationServiceMock;
  let aiService: AiServiceMock;

  beforeAll(async () => {
    exerciseService = createExerciseServiceMock();
    trainingPlanService = createTrainingPlanServiceMock();
    workoutSessionService = createWorkoutSessionServiceMock();
    gamificationService = createGamificationServiceMock();
    aiService = createAiServiceMock();

    const moduleFixtureBuilder = Test.createTestingModule({
      controllers: [
        AiController,
        ExerciseController,
        GamificationController,
        TrainingPlanController,
        WorkoutSessionController,
      ],
      providers: [
        Reflector,
        { provide: AiService, useValue: aiService },
        { provide: ExerciseService, useValue: exerciseService },
        { provide: GamificationService, useValue: gamificationService },
        { provide: TrainingPlanService, useValue: trainingPlanService },
        { provide: WorkoutSessionService, useValue: workoutSessionService },
        JwtAuthGuard,
        RolesGuard,
      ],
    });
    moduleFixtureBuilder.overrideGuard(JwtAuthGuard).useClass(TestJwtAuthGuard);

    const moduleFixture: TestingModule = await moduleFixtureBuilder.compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists exercises for authenticated members and restricts admin writes', async () => {
    exerciseService.listExercises.mockResolvedValue(createExerciseListResult());

    const listResponse = await request(getHttpServer(app))
      .get('/v1/fitness/exercises?page=1&limit=20')
      .set('Authorization', 'Bearer member')
      .expect(200);

    expect(exerciseService.listExercises).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
    expect(listResponse.body).toMatchObject({
      data: [{ name: 'Barbell Back Squat' }],
      meta: { total: 1 },
    });

    const forbiddenResponse = await request(getHttpServer(app))
      .post('/v1/fitness/exercises')
      .set('Authorization', 'Bearer member')
      .send({
        name: 'Barbell Back Squat',
        muscle_group: 'legs',
        category: 'strength',
      })
      .expect(403);

    expect(exerciseService.createExercise).not.toHaveBeenCalled();
    expect(forbiddenResponse.body).toEqual({
      type: 'FORBIDDEN',
      title: 'Forbidden',
      status: 403,
      detail: 'This action requires one of the following roles: admin.',
    });
  });

  it('validates exercise payloads for admins before creation', async () => {
    const invalidResponse = await request(getHttpServer(app))
      .post('/v1/fitness/exercises')
      .set('Authorization', 'Bearer admin')
      .send({
        name: 'Barbell Back Squat',
        muscle_group: 'legs',
        category: 'not-a-category',
      })
      .expect(400);

    expect(exerciseService.createExercise).not.toHaveBeenCalled();
    expect(invalidResponse.body).toEqual({
      type: 'BAD_REQUEST',
      title: 'BAD REQUEST',
      status: 400,
      detail: 'category must be one of: strength, cardio, flexibility, balance',
    });
  });

  it('creates and assigns training plans through the expected ownership routes', async () => {
    trainingPlanService.createPlan.mockResolvedValue(
      createTrainingPlanDetailRecord(),
    );
    trainingPlanService.assignPlan.mockResolvedValue(
      createTrainingPlanDetailRecord({
        id: '12121212-1212-4212-8212-121212121212',
        coach_id: USERS.coach.sub,
        source: PlanSource.coach_assigned,
      }),
    );

    const createResponse = await request(getHttpServer(app))
      .post('/v1/fitness/plans')
      .set('Authorization', 'Bearer member')
      .send({
        title: ' Upper / Lower Strength Builder ',
        goal: 'bulking',
        duration_weeks: 8,
        days_per_week: 4,
        schedule: [
          {
            week_number: 1,
            day_of_week: 1,
            focus_label: ' Upper Body Strength ',
            exercises: [
              {
                exercise_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                sets: 4,
                reps: 8,
                rest_seconds: 120,
                order_index: 1,
              },
            ],
          },
        ],
      })
      .expect(201);

    expect(trainingPlanService.createPlan).toHaveBeenCalledWith(
      USERS.member.sub,
      UserRole.member,
      {
        title: 'Upper / Lower Strength Builder',
        goal: FitnessGoal.bulking,
        duration_weeks: 8,
        days_per_week: 4,
        schedule: [
          {
            week_number: 1,
            day_of_week: 1,
            focus_label: 'Upper Body Strength',
            exercises: [
              {
                exercise_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                sets: 4,
                reps: 8,
                rest_seconds: 120,
                order_index: 1,
              },
            ],
          },
        ],
      },
    );
    expect(createResponse.body).toMatchObject({
      data: {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        title: 'Upper / Lower Strength Builder',
      },
    });

    const assignResponse = await request(getHttpServer(app))
      .post(
        '/v1/fitness/plans/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/assign?member_id=22222222-2222-4222-8222-222222222222',
      )
      .set('Authorization', 'Bearer coach')
      .expect(201);

    expect(trainingPlanService.assignPlan).toHaveBeenCalledWith(
      USERS.coach.sub,
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      USERS.member.sub,
    );
    expect(assignResponse.body).toMatchObject({
      data: {
        coach_id: USERS.coach.sub,
        source: 'coach_assigned',
      },
    });
  });

  it('lists mastery with validated filters and keeps invalid rank queries out of the service', async () => {
    gamificationService.getMuscleMastery.mockResolvedValue([
      createMuscleMasteryRecord(),
    ]);

    const masteryResponse = await request(getHttpServer(app))
      .get('/v1/fitness/mastery?muscle_group=%20legs%20&rank=gold')
      .set('Authorization', 'Bearer member')
      .expect(200);

    expect(gamificationService.getMuscleMastery).toHaveBeenCalledWith(
      USERS.member.sub,
      {
        muscle_group: 'legs',
        rank: 'gold',
      },
    );
    expect(masteryResponse.body).toMatchObject({
      data: [
        {
          muscle_group: 'legs',
          rank: 'gold',
          rank_display: 'Gold',
        },
      ],
    });

    const invalidRankResponse = await request(getHttpServer(app))
      .get('/v1/fitness/mastery?rank=legendary')
      .set('Authorization', 'Bearer member')
      .expect(400);

    expect(invalidRankResponse.body).toEqual({
      type: 'BAD_REQUEST',
      title: 'BAD REQUEST',
      status: 400,
      detail: 'rank must be one of: bronze, silver, gold, platinum, adamantite',
    });
    expect(gamificationService.getMuscleMastery).toHaveBeenCalledTimes(1);
  });

  it('lists the leaderboard with paginated query parsing for authenticated members', async () => {
    gamificationService.getLeaderboard.mockResolvedValue({
      data: [
        createLeaderboardRecord(),
        createLeaderboardRecord({
          rank_position: 2,
          user_id: USERS.coach.sub,
          display_name: 'Coach Prime',
          avatar_url: null,
          total_xp: 1900,
        }),
      ],
      meta: {
        page: 2,
        limit: 2,
        total: 4,
        total_pages: 2,
      },
    });

    const leaderboardResponse = await request(getHttpServer(app))
      .get('/v1/fitness/leaderboard?page=2&limit=2')
      .set('Authorization', 'Bearer member')
      .expect(200);

    expect(gamificationService.getLeaderboard).toHaveBeenCalledWith({
      page: 2,
      limit: 2,
    });
    expect(leaderboardResponse.body).toEqual({
      data: [
        createLeaderboardRecord(),
        createLeaderboardRecord({
          rank_position: 2,
          user_id: USERS.coach.sub,
          display_name: 'Coach Prime',
          avatar_url: null,
          total_xp: 1900,
        }),
      ],
      meta: {
        page: 2,
        limit: 2,
        total: 4,
        total_pages: 2,
      },
    });
  });

  it('starts sessions, validates set logging, and surfaces invalid state errors', async () => {
    workoutSessionService.startSession.mockResolvedValue(
      createWorkoutSessionDetailRecord(),
    );
    workoutSessionService.completeSession.mockRejectedValue(
      new UnprocessableEntityException({
        type: 'UNPROCESSABLE_ENTITY',
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Workout session is not active.',
      }),
    );

    const startResponse = await request(getHttpServer(app))
      .post('/v1/fitness/sessions/start')
      .set('Authorization', 'Bearer member')
      .send({
        plan_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      })
      .expect(201);

    expect(workoutSessionService.startSession).toHaveBeenCalledWith(
      USERS.member.sub,
      { plan_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    );
    expect(startResponse.body).toMatchObject({
      data: {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        status: 'in_progress',
      },
    });

    const invalidSetResponse = await request(getHttpServer(app))
      .post('/v1/fitness/sessions/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/sets')
      .set('Authorization', 'Bearer member')
      .send({
        exercise_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        set_number: 0,
      })
      .expect(400);

    expect(workoutSessionService.logSet).not.toHaveBeenCalled();
    expect(invalidSetResponse.body).toEqual({
      type: 'BAD_REQUEST',
      title: 'BAD REQUEST',
      status: 400,
      detail: 'set_number must be at least 1',
    });

    const invalidStateResponse = await request(getHttpServer(app))
      .post(
        '/v1/fitness/sessions/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/complete',
      )
      .set('Authorization', 'Bearer member')
      .expect(422);

    expect(workoutSessionService.completeSession).toHaveBeenCalledWith(
      USERS.member.sub,
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    );
    expect(invalidStateResponse.body).toEqual({
      type: 'UNPROCESSABLE_ENTITY',
      title: 'Unprocessable Entity',
      status: 422,
      detail: 'Workout session is not active.',
    });
  });

  it('generates AI plans for authenticated members and preserves 422 profile-context failures', async () => {
    aiService.generatePlan
      .mockResolvedValueOnce(
        createTrainingPlanDetailRecord({
          id: '13131313-1313-4313-8313-131313131313',
          source: PlanSource.ai_generated,
          title: 'AI Fat Loss Builder',
          goal: FitnessGoal.cutting,
          duration_weeks: 6,
          days_per_week: 3,
        }),
      )
      .mockRejectedValueOnce(
        new UnprocessableEntityException({
          type: 'UNPROCESSABLE_ENTITY',
          title: 'Unprocessable Entity',
          status: 422,
          detail:
            'Missing required fitness profile fields: fitness_goal, activity_level.',
        }),
      );

    const successResponse = await request(getHttpServer(app))
      .post('/v1/ai/generate-plan')
      .set('Authorization', 'Bearer member')
      .send({
        duration_weeks: 6,
        days_per_week: 3,
        preferences: ' Prefer dumbbells and 45-minute sessions. ',
      })
      .expect(201);

    expect(aiService.generatePlan).toHaveBeenNthCalledWith(
      1,
      USERS.member.sub,
      {
        duration_weeks: 6,
        days_per_week: 3,
        preferences: 'Prefer dumbbells and 45-minute sessions.',
      },
    );
    expect(successResponse.body).toMatchObject({
      data: {
        source: 'ai_generated',
        title: 'AI Fat Loss Builder',
      },
    });

    const failureResponse = await request(getHttpServer(app))
      .post('/v1/ai/generate-plan')
      .set('Authorization', 'Bearer member')
      .send({
        duration_weeks: 6,
        days_per_week: 3,
      })
      .expect(422);

    expect(aiService.generatePlan).toHaveBeenNthCalledWith(
      2,
      USERS.member.sub,
      {
        duration_weeks: 6,
        days_per_week: 3,
      },
    );
    expect(failureResponse.body).toEqual({
      type: 'UNPROCESSABLE_ENTITY',
      title: 'Unprocessable Entity',
      status: 422,
      detail:
        'Missing required fitness profile fields: fitness_goal, activity_level.',
    });
  });

  it('supports the AI chat and session HTTP surface for authenticated members', async () => {
    aiService.chat.mockResolvedValue({
      session_id: '17171717-1717-4717-8717-171717171717',
      reply: 'I logged that for you.',
      action_triggered: 'LOG_NUTRITION',
      action_result: {
        id: 'log-1',
        meal_name: 'General',
      },
    });
    aiService.getMyChatSessions.mockResolvedValue({
      data: [
        {
          id: '17171717-1717-4717-8717-171717171717',
          user_id: USERS.member.sub,
          context_type: 'general',
          title: 'Macros',
          is_active: true,
          last_activity_at: '2026-03-28T08:00:00.000Z',
          created_at: '2026-03-28T07:00:00.000Z',
          updated_at: '2026-03-28T08:00:00.000Z',
        },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });
    aiService.getChatSessionById.mockResolvedValue({
      id: '17171717-1717-4717-8717-171717171717',
      user_id: USERS.member.sub,
      context_type: 'general',
      title: 'Macros',
      is_active: true,
      last_activity_at: '2026-03-28T08:00:00.000Z',
      created_at: '2026-03-28T07:00:00.000Z',
      updated_at: '2026-03-28T08:00:00.000Z',
    });
    aiService.getChatMessages.mockResolvedValue({
      data: [
        {
          id: '18181818-1818-4818-8818-181818181818',
          session_id: '17171717-1717-4717-8717-171717171717',
          role: 'assistant',
          content: 'I logged that for you.',
          action_triggered: 'LOG_NUTRITION',
          created_at: '2026-03-28T08:01:00.000Z',
          updated_at: '2026-03-28T08:01:00.000Z',
        },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });
    aiService.archiveSession.mockResolvedValue(undefined);

    const chatResponse = await request(getHttpServer(app))
      .post('/v1/ai/chat')
      .set('Authorization', 'Bearer member')
      .send({
        message: ' Log my lunch please. ',
        context_type: 'general',
      })
      .expect(201);

    expect(aiService.chat).toHaveBeenCalledWith(USERS.member.sub, {
      message: 'Log my lunch please.',
      context_type: 'general',
    });
    expect(chatResponse.body).toMatchObject({
      data: {
        session_id: '17171717-1717-4717-8717-171717171717',
        reply: 'I logged that for you.',
        action_triggered: 'LOG_NUTRITION',
      },
    });

    const sessionsResponse = await request(getHttpServer(app))
      .get('/v1/ai/chat/sessions?page=1&limit=20')
      .set('Authorization', 'Bearer member')
      .expect(200);

    expect(aiService.getMyChatSessions).toHaveBeenCalledWith(USERS.member.sub, {
      page: 1,
      limit: 20,
    });
    expect(sessionsResponse.body).toMatchObject({
      data: [
        {
          id: '17171717-1717-4717-8717-171717171717',
          title: 'Macros',
        },
      ],
      meta: { total: 1 },
    });

    const sessionResponse = await request(getHttpServer(app))
      .get('/v1/ai/chat/sessions/17171717-1717-4717-8717-171717171717')
      .set('Authorization', 'Bearer member')
      .expect(200);

    expect(aiService.getChatSessionById).toHaveBeenCalledWith(
      USERS.member.sub,
      '17171717-1717-4717-8717-171717171717',
    );
    expect(sessionResponse.body).toMatchObject({
      data: {
        id: '17171717-1717-4717-8717-171717171717',
        title: 'Macros',
      },
    });

    const messagesResponse = await request(getHttpServer(app))
      .get('/v1/ai/chat/sessions/17171717-1717-4717-8717-171717171717/messages')
      .query({ page: 1, limit: 20 })
      .set('Authorization', 'Bearer member')
      .expect(200);

    expect(aiService.getChatMessages).toHaveBeenCalledWith(
      USERS.member.sub,
      '17171717-1717-4717-8717-171717171717',
      { page: 1, limit: 20 },
    );
    expect(messagesResponse.body).toMatchObject({
      data: [
        {
          id: '18181818-1818-4818-8818-181818181818',
          action_triggered: 'LOG_NUTRITION',
        },
      ],
      meta: { total: 1 },
    });

    const archiveResponse = await request(getHttpServer(app))
      .delete('/v1/ai/chat/sessions/17171717-1717-4717-8717-171717171717')
      .set('Authorization', 'Bearer member')
      .expect(200);

    expect(aiService.archiveSession).toHaveBeenCalledWith(
      USERS.member.sub,
      '17171717-1717-4717-8717-171717171717',
    );
    expect(archiveResponse.body).toEqual({
      data: {
        message: 'AI chat session deleted.',
      },
    });
  });

  it('preserves archived-session and validation failures for AI chat requests', async () => {
    aiService.chat.mockRejectedValueOnce(
      new HttpException(
        {
          type: 'SESSION_ARCHIVED',
          title: 'Chat Session Archived',
          status: 410,
          detail:
            'This chat session was archived after more than 14 days of inactivity.',
        },
        410,
      ),
    );

    const archivedResponse = await request(getHttpServer(app))
      .post('/v1/ai/chat')
      .set('Authorization', 'Bearer member')
      .send({
        session_id: '17171717-1717-4717-8717-171717171717',
        message: 'Resume this chat.',
      })
      .expect(410);

    expect(aiService.chat).toHaveBeenCalledWith(USERS.member.sub, {
      session_id: '17171717-1717-4717-8717-171717171717',
      message: 'Resume this chat.',
    });
    expect(archivedResponse.body).toEqual({
      type: 'SESSION_ARCHIVED',
      title: 'Chat Session Archived',
      status: 410,
      detail:
        'This chat session was archived after more than 14 days of inactivity.',
    });

    const invalidPayloadResponse = await request(getHttpServer(app))
      .post('/v1/ai/chat')
      .set('Authorization', 'Bearer member')
      .send({
        message: '',
        context_type: 'general',
      })
      .expect(400);

    expect(aiService.chat).toHaveBeenCalledTimes(1);
    expect(invalidPayloadResponse.body).toEqual({
      type: 'BAD_REQUEST',
      title: 'BAD REQUEST',
      status: 400,
      detail: 'message is required',
    });
  });
});
