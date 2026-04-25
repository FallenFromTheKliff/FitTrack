import {
  CanActivate,
  ExecutionContext,
  Injectable,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { GymFaqCategory, UserRole, UserStatus } from '@prisma/client';
import request from 'supertest';

import { GymKnowledgeController } from '../src/ai/gym-knowledge.controller';
import { GymKnowledgeService } from '../src/ai/gym-knowledge.service';
import type { JwtPayload } from '../src/auth/types/jwt-payload.type';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { JwtAuthGuard, RolesGuard } from '../src/common/guards';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

type GymKnowledgeServiceMethods =
  | 'getGymProfile'
  | 'updateGymProfile'
  | 'getOperatingHours'
  | 'replaceOperatingHours'
  | 'getSpecialSchedules'
  | 'createSpecialSchedule'
  | 'getPromotions'
  | 'createPromotion'
  | 'getFaqEntries'
  | 'createFaqEntry';

type GymKnowledgeServiceMock = jest.Mocked<
  Pick<GymKnowledgeService, GymKnowledgeServiceMethods>
>;

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
  staff: {
    sub: '33333333-3333-4333-8333-333333333333',
    role: UserRole.staff,
    status: UserStatus.active,
    jti: 'staff-jti',
    iat: 1,
    exp: 9999999999,
  },
};

function createGymKnowledgeServiceMock(): GymKnowledgeServiceMock {
  return {
    getGymProfile: jest.fn(),
    updateGymProfile: jest.fn(),
    getOperatingHours: jest.fn(),
    replaceOperatingHours: jest.fn(),
    getSpecialSchedules: jest.fn(),
    createSpecialSchedule: jest.fn(),
    getPromotions: jest.fn(),
    createPromotion: jest.fn(),
    getFaqEntries: jest.fn(),
    createFaqEntry: jest.fn(),
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

describe('GymKnowledgeController (e2e)', () => {
  let app: INestApplication;
  let gymKnowledgeService: GymKnowledgeServiceMock;

  beforeAll(async () => {
    gymKnowledgeService = createGymKnowledgeServiceMock();

    const moduleFixtureBuilder = Test.createTestingModule({
      controllers: [GymKnowledgeController],
      providers: [
        Reflector,
        RolesGuard,
        { provide: GymKnowledgeService, useValue: gymKnowledgeService },
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

  it('supports the admin gym knowledge HTTP surface', async () => {
    gymKnowledgeService.getGymProfile.mockResolvedValue({
      name: 'SERTFIT Gym',
      phone: '+639281234567',
      location: '123 Fitness Ave, New York, NY 10001',
      email: 'contact@sertfit.com',
      opening_time: '06:00',
      closing_time: '22:00',
    });
    gymKnowledgeService.updateGymProfile.mockResolvedValue({
      name: 'SERTFIT Gym',
      phone: '+639281234567',
      location: '123 Fitness Ave, New York, NY 10001',
      email: 'contact@sertfit.com',
      opening_time: '06:00',
      closing_time: '22:00',
    });
    gymKnowledgeService.getOperatingHours.mockResolvedValue([
      {
        id: 'hour-1',
        day_of_week: 1,
        opens_at: '06:00',
        closes_at: '22:00',
        is_closed: false,
        label: 'Weekday hours',
        is_active: true,
        created_at: '2026-03-29T09:00:00.000Z',
        updated_at: '2026-03-29T10:00:00.000Z',
      },
    ]);
    gymKnowledgeService.replaceOperatingHours.mockResolvedValue([
      {
        id: 'hour-1',
        day_of_week: 1,
        opens_at: '06:00',
        closes_at: '22:00',
        is_closed: false,
        label: 'Weekday hours',
        is_active: true,
        created_at: '2026-03-29T09:00:00.000Z',
        updated_at: '2026-03-29T10:00:00.000Z',
      },
    ]);
    gymKnowledgeService.getSpecialSchedules.mockResolvedValue({
      data: [
        {
          id: 'schedule-1',
          starts_on: '2026-12-24',
          ends_on: '2026-12-25',
          opens_at: '08:00',
          closes_at: null,
          is_closed: false,
          reason: 'Christmas schedule',
          pricing_note: 'Holiday class passes remain valid.',
          is_active: true,
          created_at: '2026-03-29T09:00:00.000Z',
          updated_at: '2026-03-29T10:00:00.000Z',
        },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });
    gymKnowledgeService.createSpecialSchedule.mockResolvedValue({
      id: 'schedule-1',
      starts_on: '2026-12-24',
      ends_on: '2026-12-25',
      opens_at: '08:00',
      closes_at: null,
      is_closed: false,
      reason: 'Christmas schedule',
      pricing_note: 'Holiday class passes remain valid.',
      is_active: true,
      created_at: '2026-03-29T09:00:00.000Z',
      updated_at: '2026-03-29T10:00:00.000Z',
    });
    gymKnowledgeService.getPromotions.mockResolvedValue({
      data: [
        {
          id: 'promo-1',
          title: 'Summer Starter Pack',
          description: 'Get two weeks free on annual plans.',
          promo_code: 'SUMMER26',
          starts_at: '2026-05-01T00:00:00.000Z',
          ends_at: '2026-05-31T23:59:59.000Z',
          pricing_note: 'Applies only to new signups.',
          is_active: true,
          created_at: '2026-03-29T09:00:00.000Z',
          updated_at: '2026-03-29T10:00:00.000Z',
        },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });
    gymKnowledgeService.createPromotion.mockResolvedValue({
      id: 'promo-1',
      title: 'Summer Starter Pack',
      description: 'Get two weeks free on annual plans.',
      promo_code: 'SUMMER26',
      starts_at: '2026-05-01T00:00:00.000Z',
      ends_at: '2026-05-31T23:59:59.000Z',
      pricing_note: 'Applies only to new signups.',
      is_active: true,
      created_at: '2026-03-29T09:00:00.000Z',
      updated_at: '2026-03-29T10:00:00.000Z',
    });
    gymKnowledgeService.getFaqEntries.mockResolvedValue({
      data: [
        {
          id: 'faq-1',
          category: GymFaqCategory.membership,
          question: 'Do you offer walk-in rates?',
          answer: 'Yes, day passes are available.',
          keywords: ['walk-in', 'day pass'],
          sort_order: 10,
          is_active: true,
          created_at: '2026-03-29T09:00:00.000Z',
          updated_at: '2026-03-29T10:00:00.000Z',
        },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });
    gymKnowledgeService.createFaqEntry.mockResolvedValue({
      id: 'faq-1',
      category: GymFaqCategory.membership,
      question: 'Do you offer walk-in rates?',
      answer: 'Yes, day passes are available.',
      keywords: ['walk-in', 'day pass'],
      sort_order: 10,
      is_active: true,
      created_at: '2026-03-29T09:00:00.000Z',
      updated_at: '2026-03-29T10:00:00.000Z',
    });

    const gymProfileResponse = await request(getHttpServer(app))
      .get('/v1/gym-chat/knowledge/profile')
      .set('Authorization', 'Bearer admin')
      .expect(200);

    expect(gymKnowledgeService.getGymProfile).toHaveBeenCalledTimes(1);
    expect(gymProfileResponse.body).toMatchObject({
      data: { name: 'SERTFIT Gym', opening_time: '06:00' },
    });

    await request(getHttpServer(app))
      .put('/v1/gym-chat/knowledge/profile')
      .set('Authorization', 'Bearer admin')
      .send({
        name: 'SERTFIT Gym',
        phone: '+639281234567',
        location: '123 Fitness Ave, New York, NY 10001',
        email: 'contact@sertfit.com',
        opening_time: '06:00',
        closing_time: '22:00',
      })
      .expect(200);

    expect(gymKnowledgeService.updateGymProfile).toHaveBeenCalledWith({
      name: 'SERTFIT Gym',
      phone: '+639281234567',
      location: '123 Fitness Ave, New York, NY 10001',
      email: 'contact@sertfit.com',
      opening_time: '06:00',
      closing_time: '22:00',
    });

    const hoursResponse = await request(getHttpServer(app))
      .get('/v1/gym-chat/knowledge/hours')
      .set('Authorization', 'Bearer admin')
      .expect(200);

    expect(gymKnowledgeService.getOperatingHours).toHaveBeenCalledTimes(1);
    expect(hoursResponse.body).toMatchObject({
      data: [{ id: 'hour-1', day_of_week: 1 }],
    });

    const replaceHoursResponse = await request(getHttpServer(app))
      .put('/v1/gym-chat/knowledge/hours')
      .set('Authorization', 'Bearer admin')
      .send([
        {
          day_of_week: 1,
          opens_at: '06:00',
          closes_at: '22:00',
          label: 'Weekday hours',
        },
      ])
      .expect(200);

    expect(gymKnowledgeService.replaceOperatingHours).toHaveBeenCalledWith([
      {
        day_of_week: 1,
        opens_at: '06:00',
        closes_at: '22:00',
        label: 'Weekday hours',
      },
    ]);
    expect(replaceHoursResponse.body).toMatchObject({
      data: [{ id: 'hour-1', day_of_week: 1 }],
    });

    const schedulesResponse = await request(getHttpServer(app))
      .get('/v1/gym-chat/knowledge/special-schedules?page=1&limit=20')
      .set('Authorization', 'Bearer admin')
      .expect(200);

    expect(gymKnowledgeService.getSpecialSchedules).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
    expect(schedulesResponse.body).toMatchObject({
      data: [{ id: 'schedule-1', reason: 'Christmas schedule' }],
      meta: { total: 1 },
    });

    await request(getHttpServer(app))
      .post('/v1/gym-chat/knowledge/special-schedules')
      .set('Authorization', 'Bearer admin')
      .send({
        starts_on: '2026-12-24',
        ends_on: '2026-12-25',
        opens_at: '08:00',
        is_closed: false,
        reason: 'Christmas schedule',
        pricing_note: 'Holiday class passes remain valid.',
      })
      .expect(201);

    expect(gymKnowledgeService.createSpecialSchedule).toHaveBeenCalledWith({
      starts_on: '2026-12-24',
      ends_on: '2026-12-25',
      opens_at: '08:00',
      closes_at: undefined,
      is_closed: false,
      reason: 'Christmas schedule',
      pricing_note: 'Holiday class passes remain valid.',
    });

    const promotionsResponse = await request(getHttpServer(app))
      .get('/v1/gym-chat/knowledge/promotions?page=1&limit=20')
      .set('Authorization', 'Bearer admin')
      .expect(200);

    expect(gymKnowledgeService.getPromotions).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
    expect(promotionsResponse.body).toMatchObject({
      data: [{ id: 'promo-1', title: 'Summer Starter Pack' }],
      meta: { total: 1 },
    });

    await request(getHttpServer(app))
      .post('/v1/gym-chat/knowledge/promotions')
      .set('Authorization', 'Bearer admin')
      .send({
        title: 'Summer Starter Pack',
        description: 'Get two weeks free on annual plans.',
        promo_code: 'SUMMER26',
        starts_at: '2026-05-01T00:00:00.000Z',
        ends_at: '2026-05-31T23:59:59.000Z',
        pricing_note: 'Applies only to new signups.',
      })
      .expect(201);

    expect(gymKnowledgeService.createPromotion).toHaveBeenCalledWith({
      title: 'Summer Starter Pack',
      description: 'Get two weeks free on annual plans.',
      promo_code: 'SUMMER26',
      starts_at: '2026-05-01T00:00:00.000Z',
      ends_at: '2026-05-31T23:59:59.000Z',
      pricing_note: 'Applies only to new signups.',
    });

    const faqResponse = await request(getHttpServer(app))
      .get('/v1/gym-chat/knowledge/faqs?page=1&limit=20')
      .set('Authorization', 'Bearer admin')
      .expect(200);

    expect(gymKnowledgeService.getFaqEntries).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
    expect(faqResponse.body).toMatchObject({
      data: [{ id: 'faq-1', category: GymFaqCategory.membership }],
      meta: { total: 1 },
    });

    await request(getHttpServer(app))
      .post('/v1/gym-chat/knowledge/faqs')
      .set('Authorization', 'Bearer admin')
      .send({
        category: GymFaqCategory.membership,
        question: 'Do you offer walk-in rates?',
        answer: 'Yes, day passes are available.',
        keywords: ['walk-in', 'day pass'],
        sort_order: 10,
      })
      .expect(201);

    expect(gymKnowledgeService.createFaqEntry).toHaveBeenCalledWith({
      category: GymFaqCategory.membership,
      question: 'Do you offer walk-in rates?',
      answer: 'Yes, day passes are available.',
      keywords: ['walk-in', 'day pass'],
      sort_order: 10,
    });
  });

  it('allows staff to read the shared gym profile', async () => {
    gymKnowledgeService.getGymProfile.mockResolvedValue({
      name: 'SERTFIT Gym',
      phone: '+639281234567',
      location: '123 Fitness Ave, New York, NY 10001',
      email: 'contact@sertfit.com',
      opening_time: '06:00',
      closing_time: '22:00',
    });

    const response = await request(getHttpServer(app))
      .get('/v1/gym-chat/knowledge/profile')
      .set('Authorization', 'Bearer staff')
      .expect(200);

    expect(response.body).toMatchObject({
      data: { name: 'SERTFIT Gym' },
    });
    expect(gymKnowledgeService.getGymProfile).toHaveBeenCalledTimes(1);
  });

  it('rejects non-admin callers from the knowledge routes', async () => {
    const response = await request(getHttpServer(app))
      .get('/v1/gym-chat/knowledge/hours')
      .set('Authorization', 'Bearer member')
      .expect(403);

    expect(response.body).toEqual({
      type: 'FORBIDDEN',
      title: 'Forbidden',
      status: 403,
      detail: 'This action requires one of the following roles: admin.',
    });
    expect(gymKnowledgeService.getOperatingHours).not.toHaveBeenCalled();
  });

  it('validates each operating-hour row before service delegation', async () => {
    const response = await request(getHttpServer(app))
      .put('/v1/gym-chat/knowledge/hours')
      .set('Authorization', 'Bearer admin')
      .send([
        {
          day_of_week: 8,
          opens_at: '06:00',
          closes_at: '22:00',
        },
      ])
      .expect(400);

    expect(gymKnowledgeService.replaceOperatingHours).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      type: 'BAD_REQUEST',
      title: 'BAD REQUEST',
      status: 400,
      detail: 'day_of_week must not exceed 6',
    });
  });
});
