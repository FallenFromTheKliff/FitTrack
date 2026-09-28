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
import {
  AmenityType,
  BookingStatus,
  PaymentProvider,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import request from 'supertest';

import type { JwtPayload } from '../src/auth/types/jwt-payload.type';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { JwtAuthGuard, RolesGuard } from '../src/common/guards';
import { AmenityController } from '../src/bookings/amenity/amenity.controller';
import { AmenityService } from '../src/bookings/amenity/amenity.service';
import { BookingController } from '../src/bookings/booking/booking.controller';
import { BookingService } from '../src/bookings/booking/booking.service';

type AmenityServiceMethods =
  | 'listAmenities'
  | 'getAmenityById'
  | 'createAmenity'
  | 'updateAmenity'
  | 'deleteAmenity';

type BookingServiceMethods =
  | 'getAvailability'
  | 'createBooking'
  | 'getMyBookings'
  | 'getAllBookings'
  | 'cancelBooking'
  | 'processBalance';

type AmenityServiceMock = jest.Mocked<
  Pick<AmenityService, AmenityServiceMethods>
>;

type BookingServiceMock = jest.Mocked<
  Pick<BookingService, BookingServiceMethods>
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

function createAmenityServiceMock(): AmenityServiceMock {
  return {
    listAmenities: jest.fn(),
    getAmenityById: jest.fn(),
    createAmenity: jest.fn(),
    updateAmenity: jest.fn(),
    deleteAmenity: jest.fn(),
  };
}

function createBookingServiceMock(): BookingServiceMock {
  return {
    getAvailability: jest.fn(),
    createBooking: jest.fn(),
    getMyBookings: jest.fn(),
    getAllBookings: jest.fn(),
    cancelBooking: jest.fn(),
    processBalance: jest.fn(),
  };
}

function getHttpServer(app: INestApplication): Parameters<typeof request>[0] {
  return app.getHttpServer() as Parameters<typeof request>[0];
}

function createAmenityRecord(
  overrides: Partial<{
    id: string;
    name: string;
    type: AmenityType;
    description: string | null;
    capacity: number;
    hourly_rate: Prisma.Decimal;
    requires_subscription: boolean;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
  }> = {},
) {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: 'Main Court',
    type: AmenityType.basketball_court,
    description: 'Full-size basketball court.',
    capacity: 2,
    hourly_rate: new Prisma.Decimal('800'),
    requires_subscription: false,
    is_active: true,
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

describe('S5 Controllers (e2e)', () => {
  let app: INestApplication;
  let amenityService: AmenityServiceMock;
  let bookingService: BookingServiceMock;

  beforeAll(async () => {
    amenityService = createAmenityServiceMock();
    bookingService = createBookingServiceMock();

    const moduleFixtureBuilder = Test.createTestingModule({
      controllers: [BookingController, AmenityController],
      providers: [
        Reflector,
        { provide: AmenityService, useValue: amenityService },
        { provide: BookingService, useValue: bookingService },
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

  it('lists active amenities publicly', async () => {
    amenityService.listAmenities.mockResolvedValue([
      createAmenityRecord(),
      createAmenityRecord({
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        name: 'Boxing Ring',
        type: AmenityType.boxing_ring,
        hourly_rate: new Prisma.Decimal('1200'),
      }),
    ]);

    const response = await request(getHttpServer(app))
      .get('/v1/bookings/amenities')
      .expect(200);

    expect(amenityService.listAmenities).toHaveBeenCalled();
    expect(response.body).toEqual({
      data: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          name: 'Main Court',
          type: 'basketball_court',
          description: 'Full-size basketball court.',
          capacity: 2,
          hourly_rate: '800',
          requires_subscription: false,
          is_active: true,
          created_at: '2026-03-24T00:00:00.000Z',
          updated_at: '2026-03-24T00:00:00.000Z',
        },
        {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          name: 'Boxing Ring',
          type: 'boxing_ring',
          description: 'Full-size basketball court.',
          capacity: 2,
          hourly_rate: '1200',
          requires_subscription: false,
          is_active: true,
          created_at: '2026-03-24T00:00:00.000Z',
          updated_at: '2026-03-24T00:00:00.000Z',
        },
      ],
    });
  });

  it('requires JWT auth for single-amenity reads', async () => {
    await request(getHttpServer(app))
      .get('/v1/bookings/amenities/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      .expect(401);

    expect(amenityService.getAmenityById).not.toHaveBeenCalled();
  });

  it('allows authenticated members to load a single amenity', async () => {
    amenityService.getAmenityById.mockResolvedValue(createAmenityRecord());

    const response = await request(getHttpServer(app))
      .get('/v1/bookings/amenities/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      .set('Authorization', 'Bearer member')
      .expect(200);

    expect(amenityService.getAmenityById).toHaveBeenCalledWith(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
    expect(response.body).toMatchObject({
      data: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    });
  });

  it('allows admins to create and update amenities', async () => {
    amenityService.createAmenity.mockResolvedValue(createAmenityRecord());
    amenityService.updateAmenity.mockResolvedValue(
      createAmenityRecord({
        name: 'Main Court Plus',
        requires_subscription: true,
        updated_at: new Date('2026-03-24T01:00:00.000Z'),
      }),
    );

    const createResponse = await request(getHttpServer(app))
      .post('/v1/bookings/amenities')
      .set('Authorization', 'Bearer admin')
      .send({
        name: 'Main Court',
        type: 'basketball_court',
        capacity: 2,
        hourly_rate: 800,
      })
      .expect(201);

    expect(amenityService.createAmenity).toHaveBeenCalledWith({
      name: 'Main Court',
      type: 'basketball_court',
      capacity: 2,
      hourly_rate: 800,
    });
    expect(createResponse.body).toMatchObject({
      data: { name: 'Main Court' },
    });

    const updateResponse = await request(getHttpServer(app))
      .patch('/v1/bookings/amenities/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      .set('Authorization', 'Bearer admin')
      .send({
        name: 'Main Court Plus',
        requires_subscription: true,
      })
      .expect(200);

    expect(amenityService.updateAmenity).toHaveBeenCalledWith(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      {
        name: 'Main Court Plus',
        requires_subscription: true,
      },
    );
    expect(updateResponse.body).toMatchObject({
      data: {
        name: 'Main Court Plus',
        requires_subscription: true,
      },
    });
  });

  it('rejects non-admin amenity management requests', async () => {
    const response = await request(getHttpServer(app))
      .post('/v1/bookings/amenities')
      .set('Authorization', 'Bearer member')
      .send({
        name: 'Main Court',
        type: 'basketball_court',
      })
      .expect(403);

    expect(amenityService.createAmenity).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      type: 'FORBIDDEN',
      title: 'Forbidden',
      status: 403,
      detail: 'This action requires one of the following roles: admin.',
    });
  });

  it('soft-deletes amenities for admins', async () => {
    amenityService.deleteAmenity.mockResolvedValue(undefined);

    const response = await request(getHttpServer(app))
      .delete('/v1/bookings/amenities/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      .set('Authorization', 'Bearer admin')
      .expect(200);

    expect(amenityService.deleteAmenity).toHaveBeenCalledWith(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
    expect(response.body).toEqual({
      data: { message: 'Amenity deleted.' },
    });
  });

  it('returns booking availability for authenticated members', async () => {
    bookingService.getAvailability.mockResolvedValue([
      {
        starts_at: '2026-03-24T10:00:00.000Z',
        ends_at: '2026-03-24T10:30:00.000Z',
        available: true,
      },
      {
        starts_at: '2026-03-24T10:30:00.000Z',
        ends_at: '2026-03-24T11:00:00.000Z',
        available: false,
      },
    ]);

    const response = await request(getHttpServer(app))
      .get(
        '/v1/bookings/amenities/availability?amenity_id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&date=2026-03-24',
      )
      .set('Authorization', 'Bearer member')
      .expect(200);

    expect(bookingService.getAvailability).toHaveBeenCalledWith({
      amenity_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      date: '2026-03-24',
    });
    expect(response.body).toEqual({
      data: [
        {
          starts_at: '2026-03-24T10:00:00.000Z',
          ends_at: '2026-03-24T10:30:00.000Z',
          available: true,
        },
        {
          starts_at: '2026-03-24T10:30:00.000Z',
          ends_at: '2026-03-24T11:00:00.000Z',
          available: false,
        },
      ],
    });
  });

  it('creates bookings with an idempotency key and returns checkout details', async () => {
    const idempotencyKey = '44444444-4444-4444-8444-444444444444';
    bookingService.createBooking.mockResolvedValue({
      booking_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      status: BookingStatus.pending,
      checkout_url: 'https://checkout.paymongo.com/cs_test_123',
    });

    const response = await request(getHttpServer(app))
      .post('/v1/bookings/amenity')
      .set('Authorization', 'Bearer member')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        amenity_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        starts_at: '2099-03-24T10:00:00.000Z',
        ends_at: '2099-03-24T11:00:00.000Z',
        provider: 'paymongo',
        notes: 'Birthday game booking.',
      })
      .expect(201);

    expect(bookingService.createBooking).toHaveBeenCalledWith(
      USERS.member.sub,
      {
        amenity_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        starts_at: '2099-03-24T10:00:00.000Z',
        ends_at: '2099-03-24T11:00:00.000Z',
        provider: PaymentProvider.paymongo,
        notes: 'Birthday game booking.',
      },
      idempotencyKey,
    );
    expect(response.body).toEqual({
      data: {
        booking_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        status: 'pending',
        checkout_url: 'https://checkout.paymongo.com/cs_test_123',
      },
    });
  });

  it('returns the authenticated member booking history', async () => {
    bookingService.getMyBookings.mockResolvedValue({
      data: [
        {
          id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          status: BookingStatus.confirmed,
        },
      ],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });

    const response = await request(getHttpServer(app))
      .get('/v1/bookings/amenity/my?page=1&limit=20')
      .set('Authorization', 'Bearer member')
      .expect(200);

    expect(bookingService.getMyBookings).toHaveBeenCalledWith(
      USERS.member.sub,
      {
        page: 1,
        limit: 20,
      },
    );
    expect(response.body).toEqual({
      data: [
        {
          id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          status: 'confirmed',
        },
      ],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });
  });

  it('cancels a members booking through the HTTP route', async () => {
    bookingService.cancelBooking.mockResolvedValue(undefined);

    const response = await request(getHttpServer(app))
      .patch('/v1/bookings/amenity/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/cancel')
      .set('Authorization', 'Bearer member')
      .expect(200);

    expect(bookingService.cancelBooking).toHaveBeenCalledWith(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      USERS.member.sub,
    );
    expect(response.body).toEqual({
      data: { message: 'Booking cancelled. Downpayment is non-refundable.' },
    });
  });

  it('limits the admin booking list to staff and admins', async () => {
    const forbiddenResponse = await request(getHttpServer(app))
      .get('/v1/bookings/amenity')
      .set('Authorization', 'Bearer member')
      .expect(403);

    expect(bookingService.getAllBookings).not.toHaveBeenCalled();
    expect(forbiddenResponse.body).toEqual({
      type: 'FORBIDDEN',
      title: 'Forbidden',
      status: 403,
      detail: 'This action requires one of the following roles: admin, staff.',
    });

    bookingService.getAllBookings.mockResolvedValue({
      data: [{ id: 'booking-1', status: BookingStatus.completed }],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    const allowedResponse = await request(getHttpServer(app))
      .get('/v1/bookings/amenity')
      .set('Authorization', 'Bearer staff')
      .expect(200);

    expect(bookingService.getAllBookings).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
    expect(allowedResponse.body).toMatchObject({
      data: [{ id: 'booking-1', status: 'completed' }],
    });
  });

  it('allows staff to start booking balance collection', async () => {
    bookingService.processBalance.mockResolvedValue({
      booking_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      status: BookingStatus.balance_pending,
      checkout_url: null,
    });

    const response = await request(getHttpServer(app))
      .post('/v1/bookings/amenity/ffffffff-ffff-4fff-8fff-ffffffffffff/balance')
      .set('Authorization', 'Bearer staff')
      .send({
        provider: 'cash',
        screenshot_url: 'https://cdn.fittrack.test/receipts/or-2026-001.png',
        reference_no: 'OR-2026-001',
      })
      .expect(201);

    expect(bookingService.processBalance).toHaveBeenCalledWith(
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      {
        provider: PaymentProvider.cash,
        screenshot_url: 'https://cdn.fittrack.test/receipts/or-2026-001.png',
        reference_no: 'OR-2026-001',
      },
    );
    expect(response.body).toEqual({
      data: {
        booking_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        status: 'balance_pending',
        checkout_url: null,
      },
    });
  });
});
