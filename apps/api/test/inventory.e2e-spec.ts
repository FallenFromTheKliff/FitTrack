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
  PaymentStatus,
  SalePaymentMethod,
  SaleStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import request from 'supertest';

import type { JwtPayload } from '../src/auth/types/jwt-payload.type';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { JwtAuthGuard, RolesGuard } from '../src/common/guards';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { EquipmentController } from '../src/inventory/equipment/equipment.controller';
import { EquipmentService } from '../src/inventory/equipment/equipment.service';
import { RetailProductController } from '../src/inventory/retail-product/retail-product.controller';
import { RetailProductService } from '../src/inventory/retail-product/retail-product.service';
import { SalesController } from '../src/inventory/sales/sales.controller';
import { SalesService } from '../src/inventory/sales/sales.service';

type RetailProductServiceMethods =
  | 'listProducts'
  | 'getProductById'
  | 'createProduct'
  | 'updateProduct'
  | 'restockProduct';

type EquipmentServiceMethods =
  | 'listEquipmentItems'
  | 'getEquipmentItemById'
  | 'createEquipmentItem'
  | 'updateEquipmentItem'
  | 'writeOffEquipment'
  | 'getWriteOffHistory';

type SalesServiceMethods = 'createSale' | 'listSales' | 'getSaleById';

type RetailProductServiceMock = jest.Mocked<
  Pick<RetailProductService, RetailProductServiceMethods>
>;

type EquipmentServiceMock = jest.Mocked<
  Pick<EquipmentService, EquipmentServiceMethods>
>;

type SalesServiceMock = jest.Mocked<Pick<SalesService, SalesServiceMethods>>;

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

function createRetailProductServiceMock(): RetailProductServiceMock {
  return {
    listProducts: jest.fn(),
    getProductById: jest.fn(),
    createProduct: jest.fn(),
    updateProduct: jest.fn(),
    restockProduct: jest.fn(),
  };
}

function createEquipmentServiceMock(): EquipmentServiceMock {
  return {
    listEquipmentItems: jest.fn(),
    getEquipmentItemById: jest.fn(),
    createEquipmentItem: jest.fn(),
    updateEquipmentItem: jest.fn(),
    writeOffEquipment: jest.fn(),
    getWriteOffHistory: jest.fn(),
  };
}

function createSalesServiceMock(): SalesServiceMock {
  return {
    createSale: jest.fn(),
    listSales: jest.fn(),
    getSaleById: jest.fn(),
  };
}

function createProductResponse(
  overrides: Partial<{
    id: string;
    name: string;
    description: string | null;
    cost: string;
    price: string;
    stock_quantity: number;
    reorder_threshold: number;
    image_url: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }> = {},
) {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: 'Whey Protein Isolate',
    description: 'Vanilla whey isolate tub.',
    cost: '899.00',
    price: '1499.00',
    stock_quantity: 8,
    reorder_threshold: 10,
    image_url: 'https://cdn.fittrack.test/images/whey.png',
    is_active: true,
    created_at: '2026-03-27T02:00:00.000Z',
    updated_at: '2026-03-27T03:00:00.000Z',
    ...overrides,
  };
}

function createEquipmentResponse(
  overrides: Partial<{
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    quantity_total: number;
    quantity_current: number;
    unit: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }> = {},
) {
  return {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    name: 'Adjustable Bench',
    description: 'Commercial-grade bench.',
    image_url: 'https://cdn.fittrack.test/images/bench.png',
    quantity_total: 8,
    quantity_current: 6,
    unit: 'units',
    is_active: true,
    created_at: '2026-03-27T02:00:00.000Z',
    updated_at: '2026-03-27T03:00:00.000Z',
    ...overrides,
  };
}

function createWriteOffResponse() {
  return {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    equipment_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    quantity_before: 6,
    quantity_set_to: 4,
    quantity_lost: 2,
    reason: 'Damaged equipment removed.',
    performed_by: USERS.staff.sub,
    performer: {
      id: USERS.staff.sub,
      first_name: 'Morgan',
      last_name: 'Reyes',
    },
    created_at: '2026-03-27T04:00:00.000Z',
    updated_at: '2026-03-27T04:00:00.000Z',
  };
}

function createSaleDetailResponse(
  overrides: Partial<{
    id: string;
    customer_name: string | null;
    customer_user_id: string | null;
    total_amount: string;
    payment_method: SalePaymentMethod;
    payment_id: string | null;
    processed_by: string;
    status: SaleStatus;
    staff: {
      id: string;
      first_name: string | null;
      last_name: string | null;
    } | null;
    items_count: number;
    created_at: string;
    updated_at: string;
    items: Array<{
      id: string;
      product_id: string;
      quantity: number;
      unit_price: string;
      subtotal: string;
      product: { id: string; name: string; image_url: string | null } | null;
    }>;
  }> = {},
) {
  return {
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    customer_name: 'Walk-in Customer',
    customer_user_id: null,
    total_amount: '2998.00',
    payment_method: SalePaymentMethod.cash,
    payment_id: null,
    processed_by: USERS.staff.sub,
    status: SaleStatus.completed,
    staff: {
      id: USERS.staff.sub,
      first_name: 'Morgan',
      last_name: 'Reyes',
    },
    items_count: 1,
    created_at: '2026-03-27T05:00:00.000Z',
    updated_at: '2026-03-27T05:00:00.000Z',
    items: [
      {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        product_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        quantity: 2,
        unit_price: '1499.00',
        subtotal: '2998.00',
        product: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          name: 'Whey Protein Isolate',
          image_url: 'https://cdn.fittrack.test/images/whey.png',
        },
      },
    ],
    ...overrides,
  };
}

function createSaleCheckoutResponse() {
  return {
    sale_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    payment_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    status: SaleStatus.pending,
    payment_status: PaymentStatus.processing,
    checkout_url: 'https://checkout.paymongo.test/sale-1',
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

describe('S10 Controllers (e2e)', () => {
  let app: INestApplication;
  let retailProductService: RetailProductServiceMock;
  let equipmentService: EquipmentServiceMock;
  let salesService: SalesServiceMock;

  beforeAll(async () => {
    retailProductService = createRetailProductServiceMock();
    equipmentService = createEquipmentServiceMock();
    salesService = createSalesServiceMock();

    const moduleFixtureBuilder = Test.createTestingModule({
      controllers: [
        RetailProductController,
        EquipmentController,
        SalesController,
      ],
      providers: [
        Reflector,
        { provide: RetailProductService, useValue: retailProductService },
        { provide: EquipmentService, useValue: equipmentService },
        { provide: SalesService, useValue: salesService },
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

  it('rejects unauthenticated retail product reads before reaching the service', async () => {
    const response = await request(getHttpServer(app))
      .get('/v1/inventory/products')
      .expect(401);

    expect(response.body).toEqual({
      type: 'UNAUTHORIZED',
      title: 'Unauthorized',
      status: 401,
      detail: 'Invalid or missing authentication token.',
    });
    expect(retailProductService.listProducts).not.toHaveBeenCalled();
  });

  it('lists products for authenticated users with transformed query params', async () => {
    retailProductService.listProducts.mockResolvedValue({
      data: [
        createProductResponse(),
        createProductResponse({
          id: '99999999-9999-4999-8999-999999999999',
          name: 'Creatine Monohydrate',
          price: '899.00',
        }),
      ],
      meta: {
        page: 2,
        limit: 5,
        total: 2,
        total_pages: 1,
      },
    });

    const response = await request(getHttpServer(app))
      .get(
        '/v1/inventory/products?search=%20whey%20&in_stock_only=true&page=2&limit=5',
      )
      .set('Authorization', 'Bearer member')
      .expect(200);

    expect(retailProductService.listProducts).toHaveBeenCalledWith({
      search: 'whey',
      in_stock_only: true,
      page: 2,
      limit: 5,
    });
    expect(response.body).toMatchObject({
      data: [
        { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
        { id: '99999999-9999-4999-8999-999999999999' },
      ],
      meta: { page: 2, limit: 5, total: 2, total_pages: 1 },
    });
  });

  it('limits product creation to admins and validates payloads before service calls', async () => {
    const forbiddenResponse = await request(getHttpServer(app))
      .post('/v1/inventory/products')
      .set('Authorization', 'Bearer member')
      .send({
        name: 'Whey Protein Isolate',
        price: 1499,
      })
      .expect(403);

    expect(forbiddenResponse.body).toEqual({
      type: 'FORBIDDEN',
      title: 'Forbidden',
      status: 403,
      detail: 'This action requires one of the following roles: admin.',
    });

    const validationResponse = await request(getHttpServer(app))
      .post('/v1/inventory/products')
      .set('Authorization', 'Bearer admin')
      .send({
        name: 'Whey Protein Isolate',
        price: 0,
      })
      .expect(400);

    expect(validationResponse.body).toEqual({
      type: 'BAD_REQUEST',
      title: 'BAD REQUEST',
      status: 400,
      detail: 'price must be a positive number',
    });
    expect(retailProductService.createProduct).not.toHaveBeenCalled();

    retailProductService.createProduct.mockResolvedValue(
      createProductResponse(),
    );

    const successResponse = await request(getHttpServer(app))
      .post('/v1/inventory/products')
      .set('Authorization', 'Bearer admin')
      .send({
        name: 'Whey Protein Isolate',
        price: 1499,
        stock_quantity: 8,
      })
      .expect(201);

    expect(retailProductService.createProduct).toHaveBeenCalledWith({
      name: 'Whey Protein Isolate',
      price: 1499,
      stock_quantity: 8,
    });
    expect(successResponse.body).toMatchObject({
      data: { name: 'Whey Protein Isolate', price: '1499.00' },
    });
  });

  it('allows staff to restock products with authenticated actor context', async () => {
    retailProductService.restockProduct.mockResolvedValue(
      createProductResponse({
        stock_quantity: 13,
        updated_at: '2026-03-27T04:00:00.000Z',
      }),
    );

    const response = await request(getHttpServer(app))
      .post(
        '/v1/inventory/products/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/restock',
      )
      .set('Authorization', 'Bearer staff')
      .send({
        quantity: '5',
        notes: ' Delivered from supplier. ',
      })
      .expect(201);

    expect(retailProductService.restockProduct).toHaveBeenCalledWith(
      USERS.staff.sub,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      {
        quantity: 5,
        notes: 'Delivered from supplier.',
      },
    );
    expect(response.body).toMatchObject({
      data: { stock_quantity: 13 },
    });
  });

  it('limits equipment reads to admin and staff users', async () => {
    const forbiddenResponse = await request(getHttpServer(app))
      .get('/v1/inventory/equipment')
      .set('Authorization', 'Bearer member')
      .expect(403);

    expect(forbiddenResponse.body).toEqual({
      type: 'FORBIDDEN',
      title: 'Forbidden',
      status: 403,
      detail: 'This action requires one of the following roles: admin, staff.',
    });

    equipmentService.listEquipmentItems.mockResolvedValue({
      data: [createEquipmentResponse()],
      meta: { page: 2, limit: 5, total: 1, total_pages: 1 },
    });

    const allowedResponse = await request(getHttpServer(app))
      .get('/v1/inventory/equipment?page=2&limit=5')
      .set('Authorization', 'Bearer staff')
      .expect(200);

    expect(equipmentService.listEquipmentItems).toHaveBeenCalledWith({
      page: 2,
      limit: 5,
    });
    expect(allowedResponse.body).toMatchObject({
      data: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }],
      meta: { page: 2, limit: 5, total: 1, total_pages: 1 },
    });
  });

  it('validates equipment write-off payloads before calling the service', async () => {
    const response = await request(getHttpServer(app))
      .post(
        '/v1/inventory/equipment/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/writeoff',
      )
      .set('Authorization', 'Bearer staff')
      .send({
        quantity_set_to: -1,
        reason: '',
      })
      .expect(400);

    expect(response.body).toEqual({
      type: 'BAD_REQUEST',
      title: 'BAD REQUEST',
      status: 400,
      detail: 'quantity_set_to must be at least 0, reason is required',
    });
    expect(equipmentService.writeOffEquipment).not.toHaveBeenCalled();
  });

  it('records equipment write-offs for staff users', async () => {
    equipmentService.writeOffEquipment.mockResolvedValue(
      createWriteOffResponse(),
    );

    const response = await request(getHttpServer(app))
      .post(
        '/v1/inventory/equipment/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/writeoff',
      )
      .set('Authorization', 'Bearer staff')
      .send({
        quantity_set_to: '4',
        reason: ' Damaged equipment removed. ',
      })
      .expect(201);

    expect(equipmentService.writeOffEquipment).toHaveBeenCalledWith(
      USERS.staff.sub,
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      {
        quantity_set_to: 4,
        reason: 'Damaged equipment removed.',
      },
    );
    expect(response.body).toMatchObject({
      data: {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        quantity_lost: 2,
      },
    });
  });

  it('limits sale creation to staff users', async () => {
    const response = await request(getHttpServer(app))
      .post('/v1/inventory/sales')
      .set('Authorization', 'Bearer member')
      .send({
        payment_method: 'cash',
        items: [
          { product_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', quantity: 2 },
        ],
      })
      .expect(403);

    expect(response.body).toEqual({
      type: 'FORBIDDEN',
      title: 'Forbidden',
      status: 403,
      detail: 'This action requires one of the following roles: staff.',
    });
    expect(salesService.createSale).not.toHaveBeenCalled();
  });

  it('starts paymongo sales with idempotency handling through the staff route', async () => {
    const idempotencyKey = '44444444-4444-4444-8444-444444444444';
    salesService.createSale.mockResolvedValue(createSaleCheckoutResponse());

    const response = await request(getHttpServer(app))
      .post('/v1/inventory/sales')
      .set('Authorization', 'Bearer staff')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        customer_user_id: '55555555-5555-4555-8555-555555555555',
        payment_method: 'paymongo',
        items: [
          { product_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', quantity: 2 },
        ],
      })
      .expect(201);

    expect(salesService.createSale).toHaveBeenCalledWith(
      USERS.staff.sub,
      {
        customer_user_id: '55555555-5555-4555-8555-555555555555',
        payment_method: 'paymongo',
        items: [
          { product_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', quantity: 2 },
        ],
      },
      idempotencyKey,
    );
    expect(response.body).toEqual({
      data: createSaleCheckoutResponse(),
    });
  });

  it('lists and reads sales for admin and staff users', async () => {
    salesService.listSales.mockResolvedValue({
      data: [createSaleDetailResponse()],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });
    salesService.getSaleById.mockResolvedValue(createSaleDetailResponse());

    const listResponse = await request(getHttpServer(app))
      .get(
        '/v1/inventory/sales?start_date=2026-03-01&end_date=2026-03-31&page=1&limit=20',
      )
      .set('Authorization', 'Bearer staff')
      .expect(200);

    expect(salesService.listSales).toHaveBeenCalledWith({
      start_date: '2026-03-01',
      end_date: '2026-03-31',
      page: 1,
      limit: 20,
    });
    expect(listResponse.body).toMatchObject({
      data: [
        { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', total_amount: '2998.00' },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    const detailResponse = await request(getHttpServer(app))
      .get('/v1/inventory/sales/dddddddd-dddd-4ddd-8ddd-dddddddddddd')
      .set('Authorization', 'Bearer admin')
      .expect(200);

    expect(salesService.getSaleById).toHaveBeenCalledWith(
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    );
    expect(detailResponse.body).toMatchObject({
      data: {
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        items: [
          {
            id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            subtotal: '2998.00',
          },
        ],
      },
    });
  });

  it('surfaces service-level ownership errors for inventory detail reads', async () => {
    salesService.getSaleById.mockRejectedValue(
      new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Forbidden',
        status: 403,
        detail: 'You do not have permission to access this sale.',
      }),
    );

    const response = await request(getHttpServer(app))
      .get('/v1/inventory/sales/dddddddd-dddd-4ddd-8ddd-dddddddddddd')
      .set('Authorization', 'Bearer staff')
      .expect(403);

    expect(response.body).toEqual({
      type: 'FORBIDDEN',
      title: 'Forbidden',
      status: 403,
      detail: 'You do not have permission to access this sale.',
    });
  });
});
