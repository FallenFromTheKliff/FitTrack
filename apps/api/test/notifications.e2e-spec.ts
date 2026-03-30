import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  INestApplication,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  UserRole,
  UserStatus,
} from '@prisma/client';
import request from 'supertest';

import type { JwtPayload } from '../src/auth/types/jwt-payload.type';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { JwtAuthGuard } from '../src/common/guards';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { NotificationsController } from '../src/notifications/notifications.controller';
import { NotificationsService } from '../src/notifications/notifications.service';

type NotificationsServiceMethods =
  | 'getPreferences'
  | 'updatePreferences'
  | 'getMyNotifications'
  | 'getUnreadCount'
  | 'markAllRead'
  | 'markRead'
  | 'deleteNotification';

type NotificationsServiceMock = jest.Mocked<
  Pick<NotificationsService, NotificationsServiceMethods>
>;

type NotificationInboxResult = Awaited<
  ReturnType<NotificationsService['getMyNotifications']>
>;
type NotificationRecord = NotificationInboxResult['data'][number];
type NotificationPreferencesRecord = Awaited<
  ReturnType<NotificationsService['getPreferences']>
>;

const USERS: Record<string, JwtPayload> = {
  member: {
    sub: '11111111-1111-4111-8111-111111111111',
    role: UserRole.member,
    status: UserStatus.active,
    jti: 'member-jti',
    iat: 1,
    exp: 9999999999,
  },
  admin: {
    sub: '22222222-2222-4222-8222-222222222222',
    role: UserRole.admin,
    status: UserStatus.active,
    jti: 'admin-jti',
    iat: 1,
    exp: 9999999999,
  },
};

function createNotificationsServiceMock(): NotificationsServiceMock {
  return {
    getPreferences: jest.fn(),
    updatePreferences: jest.fn(),
    getMyNotifications: jest.fn(),
    getUnreadCount: jest.fn(),
    markAllRead: jest.fn(),
    markRead: jest.fn(),
    deleteNotification: jest.fn(),
  };
}

function createNotificationRecord(
  overrides: Partial<NotificationRecord> = {},
): NotificationRecord {
  return {
    id: '77777777-7777-4777-8777-777777777777',
    type: NotificationType.booking_confirmed,
    channel: NotificationChannel.in_app,
    title: 'Booking confirmed',
    body: 'Court A is reserved for your 6:00 PM slot.',
    data: {
      booking_id: '88888888-8888-4888-8888-888888888888',
      court: 'Court A',
    },
    status: NotificationStatus.sent,
    sent_at: '2026-03-28T06:00:00.000Z',
    read_at: null,
    error: null,
    created_at: '2026-03-28T05:55:00.000Z',
    updated_at: '2026-03-28T06:00:00.000Z',
    ...overrides,
  };
}

function createNotificationInboxResult(
  overrides: Partial<NotificationInboxResult> = {},
): NotificationInboxResult {
  return {
    data: [createNotificationRecord()],
    meta: {
      page: 1,
      limit: 20,
      total: 1,
      total_pages: 1,
    },
    ...overrides,
  };
}

function createNotificationPreferencesRecord(
  overrides: Partial<NotificationPreferencesRecord> = {},
): NotificationPreferencesRecord {
  return {
    subscription_expiring_email: true,
    subscription_expiring_sms: true,
    subscription_expired_email: true,
    booking_confirmed_email: true,
    booking_confirmed_sms: false,
    booking_cancelled_email: true,
    booking_no_show_email: true,
    appointment_confirmed_email: true,
    appointment_confirmed_sms: false,
    appointment_completed_email: true,
    appointment_cancelled_email: true,
    rank_up_email: true,
    payment_confirmed_email: true,
    payment_failed_email: true,
    ai_session_archived_email: true,
    system_email: true,
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

describe('S12 Notifications Controller (e2e)', () => {
  let app: INestApplication;
  let notificationsService: NotificationsServiceMock;

  beforeAll(async () => {
    notificationsService = createNotificationsServiceMock();

    const moduleFixtureBuilder = Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        Reflector,
        { provide: NotificationsService, useValue: notificationsService },
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

  it('rejects unauthenticated inbox reads before reaching the service', async () => {
    const response = await request(getHttpServer(app))
      .get('/v1/notifications/my')
      .expect(401);

    expect(response.body).toEqual({
      type: 'UNAUTHORIZED',
      title: 'Unauthorized',
      status: 401,
      detail: 'Invalid or missing authentication token.',
    });
    expect(notificationsService.getMyNotifications).not.toHaveBeenCalled();
  });

  it('lists inbox notifications with transformed query params and the standard envelope', async () => {
    notificationsService.getMyNotifications.mockResolvedValue(
      createNotificationInboxResult({
        data: [
          createNotificationRecord(),
          createNotificationRecord({
            id: '99999999-9999-4999-8999-999999999999',
            title: 'Payment confirmed',
            type: NotificationType.payment_confirmed,
            body: 'Your membership renewal was paid successfully.',
            data: {
              payment_id: '12121212-1212-4212-8212-121212121212',
            },
            read_at: '2026-03-28T06:10:00.000Z',
          }),
        ],
        meta: {
          page: 2,
          limit: 5,
          total: 2,
          total_pages: 1,
        },
      }),
    );

    const response = await request(getHttpServer(app))
      .get('/v1/notifications/my?unread_only=%20true%20&page=2&limit=5')
      .set('Authorization', 'Bearer member')
      .expect(200);

    expect(notificationsService.getMyNotifications).toHaveBeenCalledWith(
      USERS.member.sub,
      {
        unread_only: true,
        page: 2,
        limit: 5,
      },
    );
    expect(response.body).toMatchObject({
      data: [
        { id: '77777777-7777-4777-8777-777777777777' },
        { id: '99999999-9999-4999-8999-999999999999' },
      ],
      meta: { page: 2, limit: 5, total: 2, total_pages: 1 },
    });
  });

  it('rejects invalid inbox query booleans before the service is called', async () => {
    const response = await request(getHttpServer(app))
      .get('/v1/notifications/my?unread_only=maybe')
      .set('Authorization', 'Bearer member')
      .expect(400);

    expect(response.body).toEqual({
      type: 'BAD_REQUEST',
      title: 'BAD REQUEST',
      status: 400,
      detail: 'unread_only must be a boolean value',
    });
    expect(notificationsService.getMyNotifications).not.toHaveBeenCalled();
  });

  it('returns unread counts and mark-all updates for the authenticated user', async () => {
    notificationsService.getUnreadCount.mockResolvedValue({ count: 4 });
    notificationsService.markAllRead.mockResolvedValue({ updated_count: 4 });

    const unreadResponse = await request(getHttpServer(app))
      .get('/v1/notifications/unread-count')
      .set('Authorization', 'Bearer member')
      .expect(200);

    expect(notificationsService.getUnreadCount).toHaveBeenCalledWith(
      USERS.member.sub,
    );
    expect(unreadResponse.body).toEqual({
      data: { count: 4 },
    });

    const markAllResponse = await request(getHttpServer(app))
      .patch('/v1/notifications/read-all')
      .set('Authorization', 'Bearer member')
      .expect(200);

    expect(notificationsService.markAllRead).toHaveBeenCalledWith(
      USERS.member.sub,
    );
    expect(markAllResponse.body).toEqual({
      data: { updated_count: 4 },
    });
  });

  it('marks owned notifications as read and preserves service-level ownership failures', async () => {
    notificationsService.markRead
      .mockResolvedValueOnce(
        createNotificationRecord({
          read_at: '2026-03-28T06:15:00.000Z',
          updated_at: '2026-03-28T06:15:00.000Z',
        }),
      )
      .mockRejectedValueOnce(
        new ForbiddenException({
          type: 'FORBIDDEN',
          title: 'Forbidden',
          status: 403,
          detail: 'You do not have permission to access this notification.',
        }),
      );

    const successResponse = await request(getHttpServer(app))
      .patch('/v1/notifications/77777777-7777-4777-8777-777777777777/read')
      .set('Authorization', 'Bearer member')
      .expect(200);

    expect(notificationsService.markRead).toHaveBeenNthCalledWith(
      1,
      USERS.member.sub,
      '77777777-7777-4777-8777-777777777777',
    );
    expect(successResponse.body).toMatchObject({
      data: {
        id: '77777777-7777-4777-8777-777777777777',
        read_at: '2026-03-28T06:15:00.000Z',
      },
    });

    const forbiddenResponse = await request(getHttpServer(app))
      .patch('/v1/notifications/99999999-9999-4999-8999-999999999999/read')
      .set('Authorization', 'Bearer member')
      .expect(403);

    expect(notificationsService.markRead).toHaveBeenNthCalledWith(
      2,
      USERS.member.sub,
      '99999999-9999-4999-8999-999999999999',
    );
    expect(forbiddenResponse.body).toEqual({
      type: 'FORBIDDEN',
      title: 'Forbidden',
      status: 403,
      detail: 'You do not have permission to access this notification.',
    });
  });

  it('validates notification ids before mark-read reaches the service', async () => {
    const response = await request(getHttpServer(app))
      .patch('/v1/notifications/not-a-uuid/read')
      .set('Authorization', 'Bearer member')
      .expect(400);

    expect(response.body).toEqual({
      type: 'BAD_REQUEST',
      title: 'BAD REQUEST',
      status: 400,
      detail: 'Validation failed (uuid is expected)',
    });
    expect(notificationsService.markRead).not.toHaveBeenCalled();
  });

  it('deletes owned notifications and preserves not-found failures', async () => {
    notificationsService.deleteNotification
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(
        new NotFoundException({
          type: 'NOT_FOUND',
          title: 'Not Found',
          status: 404,
          detail: 'Notification not found.',
        }),
      );

    const successResponse = await request(getHttpServer(app))
      .delete('/v1/notifications/77777777-7777-4777-8777-777777777777')
      .set('Authorization', 'Bearer member')
      .expect(200);

    expect(notificationsService.deleteNotification).toHaveBeenNthCalledWith(
      1,
      USERS.member.sub,
      '77777777-7777-4777-8777-777777777777',
    );
    expect(successResponse.body).toEqual({
      data: { message: 'Notification deleted.' },
    });

    const notFoundResponse = await request(getHttpServer(app))
      .delete('/v1/notifications/99999999-9999-4999-8999-999999999999')
      .set('Authorization', 'Bearer member')
      .expect(404);

    expect(notificationsService.deleteNotification).toHaveBeenNthCalledWith(
      2,
      USERS.member.sub,
      '99999999-9999-4999-8999-999999999999',
    );
    expect(notFoundResponse.body).toEqual({
      type: 'NOT_FOUND',
      title: 'Not Found',
      status: 404,
      detail: 'Notification not found.',
    });
  });

  it('validates notification ids before delete reaches the service', async () => {
    const response = await request(getHttpServer(app))
      .delete('/v1/notifications/not-a-uuid')
      .set('Authorization', 'Bearer admin')
      .expect(400);

    expect(response.body).toEqual({
      type: 'BAD_REQUEST',
      title: 'BAD REQUEST',
      status: 400,
      detail: 'Validation failed (uuid is expected)',
    });
    expect(notificationsService.deleteNotification).not.toHaveBeenCalled();
  });

  it('gets and updates notification preferences through the authenticated route', async () => {
    notificationsService.getPreferences.mockResolvedValue(
      createNotificationPreferencesRecord(),
    );
    notificationsService.updatePreferences.mockResolvedValue(
      createNotificationPreferencesRecord({
        booking_confirmed_email: false,
        payment_failed_email: false,
      }),
    );

    const getResponse = await request(getHttpServer(app))
      .get('/v1/notifications/preferences')
      .set('Authorization', 'Bearer member')
      .expect(200);

    expect(notificationsService.getPreferences).toHaveBeenCalledWith(
      USERS.member.sub,
    );
    expect(getResponse.body).toEqual({
      data: createNotificationPreferencesRecord(),
    });

    const updateResponse = await request(getHttpServer(app))
      .patch('/v1/notifications/preferences')
      .set('Authorization', 'Bearer member')
      .send({
        booking_confirmed_email: false,
        payment_failed_email: false,
        system_email: ' true ',
      })
      .expect(200);

    expect(notificationsService.updatePreferences).toHaveBeenCalledWith(
      USERS.member.sub,
      {
        booking_confirmed_email: false,
        payment_failed_email: false,
        system_email: true,
      },
    );
    expect(updateResponse.body).toEqual({
      data: createNotificationPreferencesRecord({
        booking_confirmed_email: false,
        payment_failed_email: false,
      }),
    });
  });

  it('rejects malformed preference payload booleans before hitting the service', async () => {
    const response = await request(getHttpServer(app))
      .patch('/v1/notifications/preferences')
      .set('Authorization', 'Bearer member')
      .send({
        payment_failed_email: 'sometimes',
      })
      .expect(400);

    expect(response.body).toEqual({
      type: 'BAD_REQUEST',
      title: 'BAD REQUEST',
      status: 400,
      detail: 'payment_failed_email must be a boolean value',
    });
    expect(notificationsService.updatePreferences).not.toHaveBeenCalled();
  });
});
