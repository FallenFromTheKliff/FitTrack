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
import { PaymentProvider, Prisma, UserRole, UserStatus } from '@prisma/client';
import request from 'supertest';

import type { JwtPayload } from '../src/auth/types/jwt-payload.type';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { JwtAuthGuard, RolesGuard } from '../src/common/guards';
import { PaymentController } from '../src/membership/payment/payment.controller';
import { PaymentService } from '../src/membership/payment/payment.service';
import { PaymentWebhookController } from '../src/membership/payment/payment-webhook.controller';
import { SubscriptionController } from '../src/membership/subscription/subscription.controller';
import { SubscriptionService } from '../src/membership/subscription/subscription.service';

type SubscriptionServiceMethods =
  | 'listPlans'
  | 'createPlan'
  | 'updatePlan'
  | 'getMySubscription'
  | 'cancelSubscription'
  | 'subscribe';

type PaymentServiceMethods =
  | 'submitManualPayment'
  | 'verifyPayment'
  | 'handleWebhook';

type PlanRecord = Awaited<ReturnType<SubscriptionService['createPlan']>>;
type CurrentSubscriptionRecord = Awaited<
  ReturnType<SubscriptionService['getMySubscription']>
>;
type ManualPaymentRecord = Awaited<
  ReturnType<PaymentService['submitManualPayment']>
>;

type SubscriptionServiceMock = jest.Mocked<
  Pick<SubscriptionService, SubscriptionServiceMethods>
>;

type PaymentServiceMock = jest.Mocked<
  Pick<PaymentService, PaymentServiceMethods>
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
};

function createSubscriptionServiceMock(): SubscriptionServiceMock {
  return {
    listPlans: jest.fn(),
    createPlan: jest.fn(),
    updatePlan: jest.fn(),
    getMySubscription: jest.fn(),
    cancelSubscription: jest.fn(),
    subscribe: jest.fn(),
  };
}

function createPaymentServiceMock(): PaymentServiceMock {
  return {
    submitManualPayment: jest.fn(),
    verifyPayment: jest.fn(),
    handleWebhook: jest.fn(),
  };
}

function getHttpServer(app: INestApplication): Parameters<typeof request>[0] {
  return app.getHttpServer() as Parameters<typeof request>[0];
}

function createPlanRecord(overrides: Partial<PlanRecord> = {}): PlanRecord {
  return {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    name: 'Quarterly Membership',
    description: '3 months',
    price: new Prisma.Decimal('3999'),
    currency: 'PHP',
    duration_days: 90,
    features: {},
    sort_order: 0,
    includes_coaching: false,
    is_active: true,
    created_at: new Date('2026-03-24T00:00:00.000Z'),
    updated_at: new Date('2026-03-24T00:00:00.000Z'),
    ...overrides,
  };
}

function createCurrentSubscriptionRecord(
  overrides: Partial<CurrentSubscriptionRecord> = {},
): CurrentSubscriptionRecord {
  return {
    id: '66666666-6666-4666-8666-666666666666',
    user_id: USERS.member.sub,
    plan_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    payment_id: 'payment-1',
    status: 'active',
    starts_at: new Date('2026-03-25T00:00:00.000Z'),
    expires_at: new Date('2026-04-24T00:00:00.000Z'),
    warned_7d_at: null,
    warned_3d_at: null,
    warned_1d_at: null,
    cancelled_at: null,
    cancellation_reason: null,
    created_at: new Date('2026-03-24T00:00:00.000Z'),
    updated_at: new Date('2026-03-24T00:00:00.000Z'),
    plan: createPlanRecord({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      name: 'Monthly Membership',
      duration_days: 30,
      price: new Prisma.Decimal('1499'),
    }),
    ...overrides,
  };
}

function createManualPaymentRecord(
  overrides: Partial<ManualPaymentRecord> = {},
): ManualPaymentRecord {
  return {
    id: '77777777-7777-4777-8777-777777777777',
    user_id: USERS.member.sub,
    payable_type: 'subscription',
    payable_id: '88888888-8888-4888-8888-888888888888',
    payment_stage: 'full',
    amount: new Prisma.Decimal('1499'),
    currency: 'PHP',
    provider: PaymentProvider.cash,
    provider_ref: 'OR-2026-001',
    gateway_event_id: null,
    idempotency_key: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    status: 'awaiting_verification',
    gateway_metadata: null,
    screenshot_url: 'https://cdn.fittrack.test/receipts/or-2026-001.png',
    rejection_reason: null,
    verified_by: null,
    verified_at: null,
    created_at: new Date('2026-03-24T00:00:00.000Z'),
    updated_at: new Date('2026-03-24T00:00:00.000Z'),
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

describe('S4 Controllers (e2e)', () => {
  let app: INestApplication;
  let subscriptionService: SubscriptionServiceMock;
  let paymentService: PaymentServiceMock;

  beforeAll(async () => {
    subscriptionService = createSubscriptionServiceMock();
    paymentService = createPaymentServiceMock();

    const moduleFixtureBuilder = Test.createTestingModule({
      controllers: [
        SubscriptionController,
        PaymentController,
        PaymentWebhookController,
      ],
      providers: [
        Reflector,
        { provide: SubscriptionService, useValue: subscriptionService },
        { provide: PaymentService, useValue: paymentService },
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

  it('lists public membership plans with pagination metadata', async () => {
    subscriptionService.listPlans.mockResolvedValue({
      data: [
        createPlanRecord({
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          name: 'Monthly Membership',
          price: new Prisma.Decimal('1499'),
          duration_days: 30,
        }),
      ],
      meta: {
        page: 2,
        limit: 5,
        total: 1,
        total_pages: 1,
      },
    });

    const response = await request(getHttpServer(app))
      .get('/v1/membership/plans?page=2&limit=5')
      .expect(200);

    expect(subscriptionService.listPlans).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 5 }),
    );
    expect(response.body).toEqual({
      data: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          name: 'Monthly Membership',
          description: '3 months',
          price: '1499',
          currency: 'PHP',
          duration_days: 30,
          features: {},
          sort_order: 0,
          includes_coaching: false,
          is_active: true,
          created_at: '2026-03-24T00:00:00.000Z',
          updated_at: '2026-03-24T00:00:00.000Z',
        },
      ],
      meta: {
        page: 2,
        limit: 5,
        total: 1,
        total_pages: 1,
      },
    });
  });

  it('allows admins to create membership plans', async () => {
    subscriptionService.createPlan.mockResolvedValue(createPlanRecord());

    const response = await request(getHttpServer(app))
      .post('/v1/membership/plans')
      .set('Authorization', 'Bearer admin')
      .send({
        name: 'Quarterly Membership',
        price: 3999,
        duration_days: 90,
      })
      .expect(201);

    expect(subscriptionService.createPlan).toHaveBeenCalledWith({
      name: 'Quarterly Membership',
      price: 3999,
      duration_days: 90,
    });
    expect(response.body).toMatchObject({
      data: { name: 'Quarterly Membership' },
    });
  });

  it('rejects non-admin plan management requests', async () => {
    const response = await request(getHttpServer(app))
      .post('/v1/membership/plans')
      .set('Authorization', 'Bearer member')
      .send({
        name: 'Quarterly Membership',
        price: 3999,
        duration_days: 90,
      })
      .expect(403);

    expect(subscriptionService.createPlan).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      type: 'FORBIDDEN',
      title: 'Forbidden',
      status: 403,
      detail: 'This action requires one of the following roles: admin.',
    });
  });

  it('updates plans through the admin patch route', async () => {
    subscriptionService.updatePlan.mockResolvedValue(
      createPlanRecord({
        name: 'Quarterly Membership Plus',
        description: '3 months with extras',
        price: new Prisma.Decimal('4299'),
        includes_coaching: true,
        updated_at: new Date('2026-03-24T01:00:00.000Z'),
      }),
    );

    const planId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const response = await request(getHttpServer(app))
      .patch(`/v1/membership/plans/${planId}`)
      .set('Authorization', 'Bearer admin')
      .send({
        name: 'Quarterly Membership Plus',
        includes_coaching: true,
      })
      .expect(200);

    expect(subscriptionService.updatePlan).toHaveBeenCalledWith(planId, {
      name: 'Quarterly Membership Plus',
      includes_coaching: true,
    });
    expect(response.body).toMatchObject({
      data: { name: 'Quarterly Membership Plus' },
    });
  });

  it('starts subscription checkout for an authenticated member', async () => {
    subscriptionService.subscribe.mockResolvedValue({
      checkout_url: 'https://checkout.paymongo.com/cs_test_123',
    });

    const idempotencyKey = '44444444-4444-4444-8444-444444444444';
    const response = await request(getHttpServer(app))
      .post('/v1/membership/subscribe')
      .set('Authorization', 'Bearer member')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        plan_id: '55555555-5555-4555-8555-555555555555',
        provider: 'paymongo',
      })
      .expect(201);

    expect(subscriptionService.subscribe).toHaveBeenCalledWith(
      USERS.member.sub,
      {
        plan_id: '55555555-5555-4555-8555-555555555555',
        provider: 'paymongo',
      },
      idempotencyKey,
    );
    expect(response.body).toEqual({
      data: {
        checkout_url: 'https://checkout.paymongo.com/cs_test_123',
      },
    });
  });

  it('returns the authenticated members current subscription', async () => {
    subscriptionService.getMySubscription.mockResolvedValue(
      createCurrentSubscriptionRecord(),
    );

    const response = await request(getHttpServer(app))
      .get('/v1/membership/my-subscription')
      .set('Authorization', 'Bearer member')
      .expect(200);

    expect(subscriptionService.getMySubscription).toHaveBeenCalledWith(
      USERS.member.sub,
    );
    expect(response.body).toMatchObject({
      data: { status: 'active' },
    });
  });

  it('cancels the authenticated members subscription', async () => {
    subscriptionService.cancelSubscription.mockResolvedValue(undefined);

    await request(getHttpServer(app))
      .post('/v1/membership/cancel')
      .set('Authorization', 'Bearer member')
      .send({ reason: 'Moving out of town.' })
      .expect(200);

    expect(subscriptionService.cancelSubscription).toHaveBeenCalledWith(
      USERS.member.sub,
      { reason: 'Moving out of town.' },
    );
  });

  it('submits manual payments for the authenticated requester', async () => {
    paymentService.submitManualPayment.mockResolvedValue(
      createManualPaymentRecord(),
    );

    const response = await request(getHttpServer(app))
      .post('/v1/payments/manual')
      .set('Authorization', 'Bearer member')
      .send({
        payable_type: 'subscription',
        payable_id: '88888888-8888-4888-8888-888888888888',
        payment_stage: 'full',
        amount: 1499,
        screenshot_url: 'https://cdn.fittrack.test/receipts/or-2026-001.png',
        reference_no: 'OR-2026-001',
      })
      .expect(201);

    expect(paymentService.submitManualPayment).toHaveBeenCalledWith(
      USERS.member.sub,
      USERS.member.role,
      {
        payable_type: 'subscription',
        payable_id: '88888888-8888-4888-8888-888888888888',
        payment_stage: 'full',
        amount: 1499,
        screenshot_url: 'https://cdn.fittrack.test/receipts/or-2026-001.png',
        reference_no: 'OR-2026-001',
      },
    );
    expect(response.body).toMatchObject({
      data: { status: 'awaiting_verification' },
    });
  });

  it('allows staff to verify manual payments', async () => {
    paymentService.verifyPayment.mockResolvedValue(undefined);

    await request(getHttpServer(app))
      .patch('/v1/payments/99999999-9999-4999-8999-999999999999/verify')
      .set('Authorization', 'Bearer staff')
      .send({ action: 'approve' })
      .expect(200);

    expect(paymentService.verifyPayment).toHaveBeenCalledWith(
      '99999999-9999-4999-8999-999999999999',
      { action: 'approve' },
      USERS.staff.sub,
    );
  });
});
