import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { PaymentProvider, UserRole, UserStatus } from '@prisma/client';
import request from 'supertest';

import type { JwtPayload } from '../src/auth/types/jwt-payload.type';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { JwtAuthGuard, RolesGuard } from '../src/common/guards';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { AppointmentController } from '../src/coaching/appointment/appointment.controller';
import { AppointmentService } from '../src/coaching/appointment/appointment.service';
import { CoachController } from '../src/coaching/coach/coach.controller';
import { CoachService } from '../src/coaching/coach/coach.service';
import { RelationshipController } from '../src/coaching/relationship/relationship.controller';
import { RelationshipService } from '../src/coaching/relationship/relationship.service';

type CoachServiceMethods =
  | 'listCoaches'
  | 'getCoachById'
  | 'updateMyProfile'
  | 'adminUpdateCoach';

type AppointmentServiceMethods =
  | 'setAvailability'
  | 'createAppointment'
  | 'getMyAppointments'
  | 'respondToAppointment'
  | 'cancelAppointment'
  | 'initiateDownpayment'
  | 'processBalance'
  | 'completeAppointment';

type RelationshipServiceMethods =
  | 'requestRelationship'
  | 'getMyRelationships'
  | 'getMyClients'
  | 'updateRelationship'
  | 'submitReview';

type CoachServiceMock = jest.Mocked<Pick<CoachService, CoachServiceMethods>>;
type AppointmentServiceMock = jest.Mocked<
  Pick<AppointmentService, AppointmentServiceMethods>
>;
type RelationshipServiceMock = jest.Mocked<
  Pick<RelationshipService, RelationshipServiceMethods>
>;

type CoachProfileRecord = Awaited<ReturnType<CoachService['updateMyProfile']>>;
type AppointmentRecord = Awaited<
  ReturnType<AppointmentService['createAppointment']>
>;
type AppointmentCheckoutRecord = Awaited<
  ReturnType<AppointmentService['initiateDownpayment']>
>;
type RelationshipRecord = Awaited<
  ReturnType<RelationshipService['requestRelationship']>
>;
type ReviewRecord = Awaited<ReturnType<RelationshipService['submitReview']>>;

const USERS: Record<string, JwtPayload> = {
  admin: {
    sub: '11111111-1111-4111-8111-111111111111',
    role: UserRole.admin,
    status: UserStatus.active,
    jti: 'admin-jti',
    iat: 1,
    exp: 9999999999,
  },
  staff: {
    sub: '22222222-2222-4222-8222-222222222222',
    role: UserRole.staff,
    status: UserStatus.active,
    jti: 'staff-jti',
    iat: 1,
    exp: 9999999999,
  },
  member: {
    sub: '33333333-3333-4333-8333-333333333333',
    role: UserRole.member,
    status: UserStatus.active,
    jti: 'member-jti',
    iat: 1,
    exp: 9999999999,
  },
  coach: {
    sub: '44444444-4444-4444-8444-444444444444',
    role: UserRole.staff,
    status: UserStatus.active,
    jti: 'coach-jti',
    iat: 1,
    exp: 9999999999,
  },
};

function createCoachServiceMock(): CoachServiceMock {
  return {
    listCoaches: jest.fn(),
    getCoachById: jest.fn(),
    updateMyProfile: jest.fn(),
    adminUpdateCoach: jest.fn(),
  };
}

function createAppointmentServiceMock(): AppointmentServiceMock {
  return {
    setAvailability: jest.fn(),
    createAppointment: jest.fn(),
    getMyAppointments: jest.fn(),
    respondToAppointment: jest.fn(),
    cancelAppointment: jest.fn(),
    initiateDownpayment: jest.fn(),
    processBalance: jest.fn(),
    completeAppointment: jest.fn(),
  };
}

function createRelationshipServiceMock(): RelationshipServiceMock {
  return {
    requestRelationship: jest.fn(),
    getMyRelationships: jest.fn(),
    getMyClients: jest.fn(),
    updateRelationship: jest.fn(),
    submitReview: jest.fn(),
  };
}

function createCoachProfileRecord(
  overrides: Partial<CoachProfileRecord> = {},
): CoachProfileRecord {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    specialization: 'Strength and conditioning',
    bio: 'Focused on strength blocks.',
    certification: 'NSCA-CSCS',
    hourly_rate: '1500',
    average_rating: '4.8',
    rating_count: 18,
    is_available_for_booking: true,
    profile: {
      first_name: 'Maria',
      last_name: 'Santos',
      avatar_url: null,
    },
    availability_slots: [
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        day_of_week: 1,
        start_time: '08:00',
        end_time: '10:00',
      },
    ],
    created_at: '2026-03-25T00:00:00.000Z',
    updated_at: '2026-03-26T00:00:00.000Z',
    ...overrides,
  };
}

function createAppointmentRecord(
  overrides: Partial<AppointmentRecord> = {},
): AppointmentRecord {
  return {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    user_id: USERS.member.sub,
    coach_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    status: 'pending_payment',
    is_free_session: false,
    scheduled_at: '2099-04-01T08:00:00.000Z',
    duration_minutes: 60,
    total_amount: '1500',
    downpayment_amount: '450',
    balance_amount: '1050',
    gym_revenue: '300',
    coach_earnings: '1200',
    member_notes: 'Focus on mobility.',
    downpayment_paid_at: null,
    balance_paid_at: null,
    session_notes: null,
    completed_at: null,
    no_show_at: null,
    cancellation_reason: null,
    cancelled_at: null,
    created_at: '2026-03-26T00:00:00.000Z',
    updated_at: '2026-03-26T00:00:00.000Z',
    ...overrides,
  };
}

function createAppointmentCheckoutRecord(
  overrides: Partial<AppointmentCheckoutRecord> = {},
): AppointmentCheckoutRecord {
  return {
    appointment_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    status: 'pending_payment',
    checkout_url: 'https://checkout.paymongo.test/coaching-appt',
    ...overrides,
  };
}

function createRelationshipRecord(
  overrides: Partial<RelationshipRecord> = {},
): RelationshipRecord {
  return {
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    coach_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    member_id: USERS.member.sub,
    status: 'pending',
    notes: 'Looking for weekly coaching.',
    started_at: null,
    ended_at: null,
    created_at: '2026-03-26T00:00:00.000Z',
    updated_at: '2026-03-26T00:00:00.000Z',
    coach: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      specialization: 'Strength and conditioning',
      is_available_for_booking: true,
      profile: {
        first_name: 'Maria',
        last_name: 'Santos',
        avatar_url: null,
      },
    },
    member: {
      id: USERS.member.sub,
      profile: {
        first_name: 'Jamie',
        last_name: 'Rivera',
        avatar_url: null,
      },
    },
    ...overrides,
  };
}

function createReviewRecord(
  overrides: Partial<ReviewRecord> = {},
): ReviewRecord {
  return {
    id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    coach_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    reviewer_id: USERS.member.sub,
    appointment_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    rating: 5,
    comment: 'Clear cues and a strong session.',
    coach_average_rating: '4.9',
    coach_rating_count: 19,
    created_at: '2026-03-26T00:00:00.000Z',
    updated_at: '2026-03-26T00:00:00.000Z',
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

describe('S6 Controllers (e2e)', () => {
  let app: INestApplication;
  let coachService: CoachServiceMock;
  let appointmentService: AppointmentServiceMock;
  let relationshipService: RelationshipServiceMock;

  beforeAll(async () => {
    coachService = createCoachServiceMock();
    appointmentService = createAppointmentServiceMock();
    relationshipService = createRelationshipServiceMock();

    const moduleFixtureBuilder = Test.createTestingModule({
      controllers: [
        CoachController,
        AppointmentController,
        RelationshipController,
      ],
      providers: [
        Reflector,
        { provide: CoachService, useValue: coachService },
        { provide: AppointmentService, useValue: appointmentService },
        { provide: RelationshipService, useValue: relationshipService },
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

  it('limits coach profile self-updates to coach accounts', async () => {
    const forbiddenResponse = await request(getHttpServer(app))
      .patch('/v1/coaching/coaches/me')
      .set('Authorization', 'Bearer member')
      .send({ specialization: 'Mobility' })
      .expect(403);

    expect(coachService.updateMyProfile).not.toHaveBeenCalled();
    expect(forbiddenResponse.body).toEqual({
      type: 'FORBIDDEN',
      title: 'Forbidden',
      status: 403,
      detail: 'This action requires one of the following roles: coach.',
    });

    coachService.updateMyProfile.mockResolvedValue(
      createCoachProfileRecord({
        specialization: 'Mobility and recovery',
      }),
    );

    const successResponse = await request(getHttpServer(app))
      .patch('/v1/coaching/coaches/me')
      .set('Authorization', 'Bearer coach')
      .send({ specialization: 'Mobility and recovery' })
      .expect(200);

    expect(coachService.updateMyProfile).toHaveBeenCalledWith(USERS.coach.sub, {
      specialization: 'Mobility and recovery',
    });
    expect(successResponse.body).toMatchObject({
      data: { specialization: 'Mobility and recovery' },
    });
  });

  it('validates appointment creation payloads and creates authenticated requests', async () => {
    const invalidResponse = await request(getHttpServer(app))
      .post('/v1/coaching/appointments')
      .set('Authorization', 'Bearer member')
      .send({
        coach_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        scheduled_at: '2099-04-01T08:00:00.000Z',
        duration_minutes: 15,
      })
      .expect(400);

    expect(appointmentService.createAppointment).not.toHaveBeenCalled();
    expect(invalidResponse.body).toEqual({
      type: 'BAD_REQUEST',
      title: 'BAD REQUEST',
      status: 400,
      detail: 'duration_minutes must be at least 30',
    });

    appointmentService.createAppointment.mockResolvedValue(
      createAppointmentRecord({ status: 'pending_coach' }),
    );

    const response = await request(getHttpServer(app))
      .post('/v1/coaching/appointments')
      .set('Authorization', 'Bearer member')
      .send({
        coach_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        scheduled_at: '2099-04-01T08:00:00.000Z',
        duration_minutes: 60,
        member_notes: ' Focus on mobility. ',
      })
      .expect(201);

    expect(appointmentService.createAppointment).toHaveBeenCalledWith(
      USERS.member.sub,
      {
        coach_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        scheduled_at: '2099-04-01T08:00:00.000Z',
        duration_minutes: 60,
        member_notes: 'Focus on mobility.',
      },
    );
    expect(response.body).toMatchObject({
      data: {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        status: 'pending_coach',
      },
    });
  });

  it('restricts appointment responses to coaches', async () => {
    const appointmentId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

    const forbiddenResponse = await request(getHttpServer(app))
      .patch(`/v1/coaching/appointments/${appointmentId}/respond`)
      .set('Authorization', 'Bearer member')
      .send({ accepted: true })
      .expect(403);

    expect(appointmentService.respondToAppointment).not.toHaveBeenCalled();
    expect(forbiddenResponse.body).toEqual({
      type: 'FORBIDDEN',
      title: 'Forbidden',
      status: 403,
      detail: 'This action requires one of the following roles: coach.',
    });

    appointmentService.respondToAppointment.mockResolvedValue(
      createAppointmentRecord({ status: 'confirmed' }),
    );

    const response = await request(getHttpServer(app))
      .patch(`/v1/coaching/appointments/${appointmentId}/respond`)
      .set('Authorization', 'Bearer coach')
      .send({ accepted: true })
      .expect(200);

    expect(appointmentService.respondToAppointment).toHaveBeenCalledWith(
      USERS.coach.sub,
      appointmentId,
      { accepted: true },
    );
    expect(response.body).toMatchObject({
      data: { status: 'confirmed' },
    });
  });

  it('forwards the idempotency key on downpayment initiation', async () => {
    appointmentService.initiateDownpayment.mockResolvedValue(
      createAppointmentCheckoutRecord(),
    );

    const appointmentId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const idempotencyKey = '55555555-5555-4555-8555-555555555555';

    const response = await request(getHttpServer(app))
      .post(`/v1/coaching/appointments/${appointmentId}/pay`)
      .set('Authorization', 'Bearer member')
      .set('Idempotency-Key', idempotencyKey)
      .send({ provider: 'paymongo' })
      .expect(201);

    expect(appointmentService.initiateDownpayment).toHaveBeenCalledWith(
      USERS.member.sub,
      appointmentId,
      { provider: PaymentProvider.paymongo },
      idempotencyKey,
    );
    expect(response.body).toEqual({
      data: {
        appointment_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        status: 'pending_payment',
        checkout_url: 'https://checkout.paymongo.test/coaching-appt',
      },
    });
  });

  it('limits balance collection to staff or admins and validates cash payloads', async () => {
    const appointmentId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

    const forbiddenResponse = await request(getHttpServer(app))
      .post(`/v1/coaching/appointments/${appointmentId}/balance`)
      .set('Authorization', 'Bearer member')
      .send({ provider: 'cash' })
      .expect(403);

    expect(appointmentService.processBalance).not.toHaveBeenCalled();
    expect(forbiddenResponse.body).toEqual({
      type: 'FORBIDDEN',
      title: 'Forbidden',
      status: 403,
      detail: 'This action requires one of the following roles: admin, staff.',
    });

    const invalidResponse = await request(getHttpServer(app))
      .post(`/v1/coaching/appointments/${appointmentId}/balance`)
      .set('Authorization', 'Bearer staff')
      .send({
        provider: 'cash',
        screenshot_url: 'not-a-url',
        reference_no: '',
      })
      .expect(400);

    expect(appointmentService.processBalance).not.toHaveBeenCalled();
    expect(invalidResponse.body).toEqual({
      type: 'BAD_REQUEST',
      title: 'BAD REQUEST',
      status: 400,
      detail: 'screenshot_url must be a valid URL, reference_no is required',
    });

    appointmentService.processBalance.mockResolvedValue(
      createAppointmentCheckoutRecord({
        status: 'confirmed',
        checkout_url: null,
      }),
    );

    const response = await request(getHttpServer(app))
      .post(`/v1/coaching/appointments/${appointmentId}/balance`)
      .set('Authorization', 'Bearer staff')
      .send({
        provider: 'cash',
        screenshot_url: 'https://cdn.fittrack.test/receipts/or-2026-020.png',
        reference_no: 'OR-2026-020',
      })
      .expect(201);

    expect(appointmentService.processBalance).toHaveBeenCalledWith(
      USERS.staff.sub,
      appointmentId,
      {
        provider: PaymentProvider.cash,
        screenshot_url: 'https://cdn.fittrack.test/receipts/or-2026-020.png',
        reference_no: 'OR-2026-020',
      },
    );
    expect(response.body).toEqual({
      data: {
        appointment_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        status: 'confirmed',
        checkout_url: null,
      },
    });
  });

  it('creates relationship requests and restricts relationship updates to coaches', async () => {
    relationshipService.requestRelationship.mockResolvedValue(
      createRelationshipRecord(),
    );

    const createResponse = await request(getHttpServer(app))
      .post('/v1/coaching/relationships')
      .set('Authorization', 'Bearer member')
      .send({
        coach_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        notes: ' Looking for weekly coaching. ',
      })
      .expect(201);

    expect(relationshipService.requestRelationship).toHaveBeenCalledWith(
      USERS.member.sub,
      {
        coach_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        notes: 'Looking for weekly coaching.',
      },
    );
    expect(createResponse.body).toMatchObject({
      data: { status: 'pending' },
    });

    const relationshipId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const forbiddenResponse = await request(getHttpServer(app))
      .patch(`/v1/coaching/relationships/${relationshipId}`)
      .set('Authorization', 'Bearer member')
      .send({ status: 'active' })
      .expect(403);

    expect(relationshipService.updateRelationship).not.toHaveBeenCalled();
    expect(forbiddenResponse.body).toEqual({
      type: 'FORBIDDEN',
      title: 'Forbidden',
      status: 403,
      detail: 'This action requires one of the following roles: coach.',
    });

    relationshipService.updateRelationship.mockResolvedValue(
      createRelationshipRecord({
        status: 'active',
        started_at: '2026-03-26T01:00:00.000Z',
      }),
    );

    const updateResponse = await request(getHttpServer(app))
      .patch(`/v1/coaching/relationships/${relationshipId}`)
      .set('Authorization', 'Bearer coach')
      .send({ status: 'active', notes: ' Weekly cadence confirmed. ' })
      .expect(200);

    expect(relationshipService.updateRelationship).toHaveBeenCalledWith(
      USERS.coach.sub,
      relationshipId,
      { status: 'active', notes: 'Weekly cadence confirmed.' },
    );
    expect(updateResponse.body).toMatchObject({
      data: { status: 'active' },
    });
  });

  it('validates review ratings and submits reviews for authenticated members', async () => {
    const coachId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    const invalidResponse = await request(getHttpServer(app))
      .post(`/v1/coaching/coaches/${coachId}/reviews`)
      .set('Authorization', 'Bearer member')
      .send({
        appointment_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        rating: 6,
      })
      .expect(400);

    expect(relationshipService.submitReview).not.toHaveBeenCalled();
    expect(invalidResponse.body).toEqual({
      type: 'BAD_REQUEST',
      title: 'BAD REQUEST',
      status: 400,
      detail: 'rating must not exceed 5',
    });

    relationshipService.submitReview.mockResolvedValue(createReviewRecord());

    const response = await request(getHttpServer(app))
      .post(`/v1/coaching/coaches/${coachId}/reviews`)
      .set('Authorization', 'Bearer member')
      .send({
        appointment_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        rating: 5,
        comment: ' Clear cues and a strong session. ',
      })
      .expect(201);

    expect(relationshipService.submitReview).toHaveBeenCalledWith(
      USERS.member.sub,
      coachId,
      {
        appointment_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        rating: 5,
        comment: 'Clear cues and a strong session.',
      },
    );
    expect(response.body).toMatchObject({
      data: {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        rating: 5,
      },
    });
  });
});
