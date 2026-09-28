import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ActivityLevel,
  FitnessGoal,
  Gender,
  NutritionUnit,
  UserRole,
  UserStatus,
} from '@prisma/client';
import request from 'supertest';

import type { JwtPayload } from '../src/auth/types/jwt-payload.type';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { JwtAuthGuard } from '../src/common/guards';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { NutritionController } from '../src/nutrition/nutrition.controller';
import { NutritionService } from '../src/nutrition/nutrition.service';

type NutritionServiceMethods =
  | 'getActiveTdee'
  | 'getTdeeHistory'
  | 'recalculateTdee'
  | 'logNutrition'
  | 'getNutritionLogs'
  | 'updateNutritionLog'
  | 'deleteNutritionLog'
  | 'getDailySummary';

type NutritionServiceMock = jest.Mocked<
  Pick<NutritionService, NutritionServiceMethods>
>;

type ActiveTdeeResult = Awaited<ReturnType<NutritionService['getActiveTdee']>>;
type TdeeHistoryResult = Awaited<
  ReturnType<NutritionService['getTdeeHistory']>
>;
type NutritionLogResult = Awaited<
  ReturnType<NutritionService['updateNutritionLog']>
>;
type DailySummaryResult = Awaited<
  ReturnType<NutritionService['getDailySummary']>
>;

const USERS: Record<string, JwtPayload> = {
  member: {
    sub: '22222222-2222-4222-8222-222222222222',
    role: UserRole.member,
    status: UserStatus.active,
    jti: 'member-jti',
    iat: 1,
    exp: 9999999999,
  },
};

function createNutritionServiceMock(): NutritionServiceMock {
  return {
    getActiveTdee: jest.fn(),
    getTdeeHistory: jest.fn(),
    recalculateTdee: jest.fn(),
    logNutrition: jest.fn(),
    getNutritionLogs: jest.fn(),
    updateNutritionLog: jest.fn(),
    deleteNutritionLog: jest.fn(),
    getDailySummary: jest.fn(),
  };
}

function createActiveTdeeResult(
  overrides: Partial<ActiveTdeeResult> = {},
): ActiveTdeeResult {
  return {
    tdee: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      user_id: USERS.member.sub,
      weight_kg: '75.50',
      height_cm: '175.00',
      age: 28,
      gender: Gender.male,
      activity_level: ActivityLevel.moderate,
      fitness_goal: FitnessGoal.maintenance,
      bmr_calories: '1700.25',
      tdee_calories: '2450.50',
      is_active: true,
      calculated_at: '2026-03-27T05:00:00.000Z',
      created_at: '2026-03-27T05:00:00.000Z',
      updated_at: '2026-03-27T05:00:00.000Z',
      ...overrides.tdee,
    },
    macros: {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      user_id: USERS.member.sub,
      tdee_profile_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      target_calories: '2200.00',
      protein_g: '180.00',
      carbs_g: '210.00',
      fat_g: '65.00',
      is_active: true,
      created_at: '2026-03-27T05:00:00.000Z',
      updated_at: '2026-03-27T05:00:00.000Z',
      ...overrides.macros,
    },
  };
}

function createTdeeHistoryResult(): TdeeHistoryResult {
  return {
    data: [
      createActiveTdeeResult().tdee,
      createActiveTdeeResult({
        tdee: {
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          is_active: false,
          tdee_calories: '2300.00',
        },
      }).tdee,
    ],
    meta: {
      page: 2,
      limit: 2,
      total: 4,
      total_pages: 2,
    },
  };
}

function createNutritionLogResult(
  overrides: Partial<NutritionLogResult> = {},
): NutritionLogResult {
  return {
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    user_id: USERS.member.sub,
    macro_target_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    log_date: '2026-03-27T00:00:00.000Z',
    meal_name: 'Breakfast',
    food_item: 'Greek yogurt',
    calories: '320.00',
    protein_g: '28.00',
    carbs_g: '22.00',
    fat_g: '11.00',
    quantity: '1.00',
    unit: NutritionUnit.serving,
    created_at: '2026-03-27T05:00:00.000Z',
    updated_at: '2026-03-27T05:00:00.000Z',
    ...overrides,
  };
}

function createDailySummaryResult(
  overrides: Partial<DailySummaryResult> = {},
): DailySummaryResult {
  return {
    date: '2026-03-27',
    macro_target_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    logged: {
      calories: '900.00',
      protein_g: '70.00',
      carbs_g: '80.00',
      fat_g: '25.00',
    },
    target: {
      calories: '2200.00',
      protein_g: '180.00',
      carbs_g: '210.00',
      fat_g: '65.00',
    },
    remaining: {
      calories: '1300.00',
      protein_g: '110.00',
      carbs_g: '130.00',
      fat_g: '40.00',
    },
    ...overrides,
  };
}

@Injectable()
class TestJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: JwtPayload;
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

function getHttpServer(app: INestApplication): Parameters<typeof request>[0] {
  return app.getHttpServer() as Parameters<typeof request>[0];
}

describe('S9 Controllers (e2e)', () => {
  let app: INestApplication;
  let nutritionService: NutritionServiceMock;

  beforeAll(async () => {
    nutritionService = createNutritionServiceMock();

    const moduleFixtureBuilder = Test.createTestingModule({
      controllers: [NutritionController],
      providers: [
        Reflector,
        { provide: NutritionService, useValue: nutritionService },
        JwtAuthGuard,
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

  it('rejects unauthenticated nutrition requests before reaching the service', async () => {
    const response = await request(getHttpServer(app))
      .get('/v1/nutrition/tdee')
      .expect(401);

    expect(response.body).toEqual({
      type: 'UNAUTHORIZED',
      title: 'Unauthorized',
      status: 401,
      detail: 'Invalid or missing authentication token.',
    });
    expect(nutritionService.getActiveTdee).not.toHaveBeenCalled();
  });

  it('returns the authenticated members active tdee aggregate', async () => {
    nutritionService.getActiveTdee.mockResolvedValue(createActiveTdeeResult());

    const response = await request(getHttpServer(app))
      .get('/v1/nutrition/tdee')
      .set('Authorization', 'Bearer member')
      .expect(200);

    expect(nutritionService.getActiveTdee).toHaveBeenCalledWith(
      USERS.member.sub,
    );
    expect(response.body).toMatchObject({
      data: {
        tdee: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          tdee_calories: '2450.50',
        },
        macros: {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          target_calories: '2200.00',
        },
      },
    });
  });

  it('lists tdee history with paginated query parsing', async () => {
    nutritionService.getTdeeHistory.mockResolvedValue(
      createTdeeHistoryResult(),
    );

    const response = await request(getHttpServer(app))
      .get('/v1/nutrition/tdee/history?page=2&limit=2')
      .set('Authorization', 'Bearer member')
      .expect(200);

    expect(nutritionService.getTdeeHistory).toHaveBeenCalledWith(
      USERS.member.sub,
      {
        page: 2,
        limit: 2,
      },
    );
    expect(response.body).toMatchObject({
      data: [
        { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
        {
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          is_active: false,
        },
      ],
      meta: { page: 2, limit: 2, total: 4, total_pages: 2 },
    });
  });

  it('validates recalculation payloads before calling the service', async () => {
    const response = await request(getHttpServer(app))
      .post('/v1/nutrition/tdee/recalculate')
      .set('Authorization', 'Bearer member')
      .send({
        activity_level: 'legendary',
      })
      .expect(400);

    expect(response.body).toEqual({
      type: 'BAD_REQUEST',
      title: 'BAD REQUEST',
      status: 400,
      detail:
        'activity_level must be one of: sedentary, light, moderate, active, very_active',
    });
    expect(nutritionService.recalculateTdee).not.toHaveBeenCalled();
  });

  it('recalculates tdee with transformed dto values and returns 200', async () => {
    nutritionService.recalculateTdee.mockResolvedValue(
      createActiveTdeeResult({
        tdee: {
          id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          weight_kg: '76.50',
          activity_level: ActivityLevel.active,
          fitness_goal: FitnessGoal.cutting,
        },
        macros: {
          id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        },
      }),
    );

    const response = await request(getHttpServer(app))
      .post('/v1/nutrition/tdee/recalculate')
      .set('Authorization', 'Bearer member')
      .send({
        weight_kg: '76.5',
        activity_level: ActivityLevel.active,
        fitness_goal: FitnessGoal.cutting,
      })
      .expect(200);

    expect(nutritionService.recalculateTdee).toHaveBeenCalledWith(
      USERS.member.sub,
      {
        weight_kg: 76.5,
        activity_level: ActivityLevel.active,
        fitness_goal: FitnessGoal.cutting,
      },
    );
    expect(response.body).toMatchObject({
      data: {
        tdee: {
          id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          weight_kg: '76.50',
        },
        macros: {
          id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        },
      },
    });
  });

  it('creates nutrition logs with trimmed strings and numeric coercion', async () => {
    nutritionService.logNutrition.mockResolvedValue(createNutritionLogResult());

    const response = await request(getHttpServer(app))
      .post('/v1/nutrition/logs')
      .set('Authorization', 'Bearer member')
      .send({
        log_date: '2026-03-27',
        meal_name: ' Breakfast ',
        food_item: ' Greek yogurt ',
        calories: '320',
        protein_g: '28',
        carbs_g: '22',
        fat_g: '11',
        quantity: '1',
        unit: NutritionUnit.serving,
      })
      .expect(201);

    expect(nutritionService.logNutrition).toHaveBeenCalledWith(
      USERS.member.sub,
      {
        log_date: '2026-03-27',
        meal_name: 'Breakfast',
        food_item: 'Greek yogurt',
        calories: 320,
        protein_g: 28,
        carbs_g: 22,
        fat_g: 11,
        quantity: 1,
        unit: NutritionUnit.serving,
      },
    );
    expect(response.body).toMatchObject({
      data: {
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        meal_name: 'Breakfast',
        unit: NutritionUnit.serving,
      },
    });
  });

  it('lists nutrition logs with date-range pagination', async () => {
    nutritionService.getNutritionLogs.mockResolvedValue({
      data: [
        createNutritionLogResult(),
        createNutritionLogResult({
          id: '11111111-aaaa-4aaa-8aaa-111111111111',
          meal_name: 'Lunch',
          food_item: 'Chicken breast',
        }),
      ],
      meta: {
        page: 2,
        limit: 2,
        total: 4,
        total_pages: 2,
      },
    });

    const response = await request(getHttpServer(app))
      .get(
        '/v1/nutrition/logs?start_date=2026-03-01&end_date=2026-03-31&page=2&limit=2',
      )
      .set('Authorization', 'Bearer member')
      .expect(200);

    expect(nutritionService.getNutritionLogs).toHaveBeenCalledWith(
      USERS.member.sub,
      {
        start_date: '2026-03-01',
        end_date: '2026-03-31',
        page: 2,
        limit: 2,
      },
    );
    expect(response.body).toMatchObject({
      data: [
        { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' },
        {
          id: '11111111-aaaa-4aaa-8aaa-111111111111',
          meal_name: 'Lunch',
        },
      ],
      meta: { page: 2, limit: 2, total: 4, total_pages: 2 },
    });
  });

  it('surfaces ownership errors when updating another users nutrition log', async () => {
    nutritionService.updateNutritionLog.mockRejectedValue(
      new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Forbidden',
        status: 403,
        detail: 'You do not have permission to access this NutritionLog.',
      }),
    );

    const response = await request(getHttpServer(app))
      .patch('/v1/nutrition/logs/dddddddd-dddd-4ddd-8ddd-dddddddddddd')
      .set('Authorization', 'Bearer member')
      .send({ calories: 450 })
      .expect(403);

    expect(nutritionService.updateNutritionLog).toHaveBeenCalledWith(
      USERS.member.sub,
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      { calories: 450 },
    );
    expect(response.body).toEqual({
      type: 'FORBIDDEN',
      title: 'Forbidden',
      status: 403,
      detail: 'You do not have permission to access this NutritionLog.',
    });
  });

  it('deletes owned nutrition logs through the authenticated route', async () => {
    nutritionService.deleteNutritionLog.mockResolvedValue(undefined);

    const response = await request(getHttpServer(app))
      .delete('/v1/nutrition/logs/dddddddd-dddd-4ddd-8ddd-dddddddddddd')
      .set('Authorization', 'Bearer member')
      .expect(200);

    expect(nutritionService.deleteNutritionLog).toHaveBeenCalledWith(
      USERS.member.sub,
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    );
    expect(response.body).toEqual({
      data: {
        message: 'Nutrition log deleted.',
      },
    });
  });

  it('returns nullable target comparisons for daily summary when no active target exists', async () => {
    nutritionService.getDailySummary.mockResolvedValue(
      createDailySummaryResult({
        macro_target_id: null,
        target: null,
        remaining: null,
      }),
    );

    const response = await request(getHttpServer(app))
      .get('/v1/nutrition/daily-summary?date=2026-03-27')
      .set('Authorization', 'Bearer member')
      .expect(200);

    expect(nutritionService.getDailySummary).toHaveBeenCalledWith(
      USERS.member.sub,
      {
        date: '2026-03-27',
      },
    );
    expect(response.body).toEqual({
      data: {
        date: '2026-03-27',
        macro_target_id: null,
        logged: {
          calories: '900.00',
          protein_g: '70.00',
          carbs_g: '80.00',
          fat_g: '25.00',
        },
        target: null,
        remaining: null,
      },
    });
  });
});
