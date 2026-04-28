import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Payment,
  PayableType,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  Prisma,
  RetailProduct,
  SaleSource,
} from '@prisma/client';

import {
  BaseRepository,
  PaginatedResult,
} from '../../common/base-repository/base-repository';
import { PrismaService } from '../../prisma/prisma.service';
import { DateRangeDTO } from '../../user/dto/user-dto';
import { CreateSaleItemDTO } from './dto/sales.dto';

type ProductSnapshot = Pick<
  RetailProduct,
  'id' | 'name' | 'price' | 'stock_quantity' | 'image_url' | 'is_active'
>;

type SaleQuantityRequest = Map<string, number>;

const saleStaffInclude = {
  staff: {
    select: {
      id: true,
      profile: {
        select: {
          first_name: true,
          last_name: true,
        },
      },
    },
  },
} satisfies Prisma.SaleTransactionInclude;

const saleSummaryInclude = {
  ...saleStaffInclude,
  _count: {
    select: {
      items: true,
    },
  },
} satisfies Prisma.SaleTransactionInclude;

const saleDetailInclude = {
  ...saleStaffInclude,
  items: {
    orderBy: [{ created_at: 'asc' }],
    include: {
      product: {
        select: {
          id: true,
          name: true,
          image_url: true,
        },
      },
    },
  },
} satisfies Prisma.SaleTransactionInclude;

export type SaleSummaryRecord = Prisma.SaleTransactionGetPayload<{
  include: typeof saleSummaryInclude;
}>;

export type SaleDetailRecord = Prisma.SaleTransactionGetPayload<{
  include: typeof saleDetailInclude;
}>;

export type PendingPaymongoSaleResult = {
  payment: Payment;
  sale: SaleDetailRecord;
};

@Injectable()
export class SalesRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  listSales(dto: DateRangeDTO): Promise<PaginatedResult<SaleSummaryRecord>> {
    return this.paginateWithDateRange<SaleSummaryRecord>(
      this.prisma.saleTransaction,
      {},
      {
        start_date: dto.start_date,
        end_date: dto.end_date,
        dateField: 'created_at',
      },
      {
        include: saleSummaryInclude,
        orderBy: { created_at: 'desc' },
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  findSaleByIdOrThrow(id: string): Promise<SaleDetailRecord> {
    return this.findByIdOrThrow<SaleDetailRecord>(
      this.prisma.saleTransaction,
      id,
      'SaleTransaction',
      saleDetailInclude,
    );
  }

  createCashSale(input: {
    processedBy: string;
    customerName?: string;
    customerUserId?: string;
    notes?: string;
    items: CreateSaleItemDTO[];
    source: SaleSource;
  }): Promise<SaleDetailRecord> {
    return this.transaction(async (tx) => {
      const saleDraft = await this.buildSaleDraft(tx, input.items);
      await this.assertCustomerUserExists(tx, input.customerUserId);

      const sale = await tx.saleTransaction.create({
        data: {
          customer_name: input.customerName ?? null,
          customer_user_id: input.customerUserId ?? null,
          notes: input.notes ?? null,
          source: input.source,
          total_amount: saleDraft.totalAmount.toDecimalPlaces(2),
          payment_method: 'cash',
          processed_by: input.processedBy,
          status: 'completed',
        },
      });

      await tx.saleTransactionItem.createMany({
        data: saleDraft.saleItems.map((item) => ({
          transaction_id: sale.id,
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          subtotal: item.subtotal,
        })),
      });

      await this.decrementStockQuantities(tx, saleDraft.requestedQuantities);

      return this.findSaleDetailById(tx, sale.id);
    });
  }

  createPendingPaymongoSale(input: {
    processedBy: string;
    customerName?: string;
    customerUserId: string;
    notes?: string;
    items: CreateSaleItemDTO[];
    idempotencyKey: string;
    source: SaleSource;
  }): Promise<PendingPaymongoSaleResult> {
    return this.transaction(async (tx) => {
      const saleDraft = await this.buildSaleDraft(tx, input.items);
      await this.assertCustomerUserExists(tx, input.customerUserId);

      const sale = await tx.saleTransaction.create({
        data: {
          customer_name: input.customerName ?? null,
          customer_user_id: input.customerUserId,
          notes: input.notes ?? null,
          source: input.source,
          total_amount: saleDraft.totalAmount.toDecimalPlaces(2),
          payment_method: 'paymongo',
          processed_by: input.processedBy,
          status: 'pending',
        },
      });

      await tx.saleTransactionItem.createMany({
        data: saleDraft.saleItems.map((item) => ({
          transaction_id: sale.id,
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          subtotal: item.subtotal,
        })),
      });

      await this.decrementStockQuantities(tx, saleDraft.requestedQuantities);

      const payment = await tx.payment.create({
        data: {
          user: {
            connect: {
              id: input.customerUserId,
            },
          },
          payable_type: PayableType.product,
          payable_id: sale.id,
          payment_stage: PaymentStage.full,
          amount: saleDraft.totalAmount.toDecimalPlaces(2),
          provider: PaymentProvider.paymongo,
          idempotency_key: input.idempotencyKey,
          status: PaymentStatus.pending,
        },
      });

      await tx.saleTransaction.update({
        where: { id: sale.id },
        data: {
          payment_id: payment.id,
        },
      });

      return {
        payment,
        sale: await this.findSaleDetailById(tx, sale.id),
      };
    });
  }

  completePendingPaymongoSale(
    saleId: string,
    paymentId: string,
  ): Promise<SaleDetailRecord | null> {
    return this.transaction(async (tx) => {
      const sale = await tx.saleTransaction.findUnique({
        where: { id: saleId },
        include: {
          items: {
            orderBy: [{ created_at: 'asc' }],
          },
        },
      });

      if (!sale) {
        throw new NotFoundException({
          type: 'NOT_FOUND',
          title: 'SaleTransaction Not Found',
          status: 404,
          detail: `SaleTransaction with id "${saleId}" does not exist.`,
        });
      }

      if (
        sale.payment_method !== 'paymongo' ||
        sale.payment_id !== paymentId ||
        sale.status === 'cancelled'
      ) {
        return null;
      }

      if (sale.status === 'completed') {
        return null;
      }

      await tx.saleTransaction.update({
        where: { id: saleId },
        data: {
          status: 'completed',
        },
      });

      return this.findSaleDetailById(tx, saleId);
    });
  }

  private async findSaleDetailById(
    tx: Prisma.TransactionClient,
    saleId: string,
  ): Promise<SaleDetailRecord> {
    const sale = await tx.saleTransaction.findUnique({
      where: { id: saleId },
      include: saleDetailInclude,
    });

    if (!sale) {
      throw new NotFoundException({
        type: 'NOT_FOUND',
        title: 'SaleTransaction Not Found',
        status: 404,
        detail: `SaleTransaction with id "${saleId}" does not exist.`,
      });
    }

    return sale;
  }

  private async buildSaleDraft(
    tx: Prisma.TransactionClient,
    items: CreateSaleItemDTO[],
  ): Promise<{
    requestedQuantities: SaleQuantityRequest;
    saleItems: Array<{
      productId: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      subtotal: Prisma.Decimal;
    }>;
    totalAmount: Prisma.Decimal;
  }> {
    const requestedQuantities = this.aggregateRequestedQuantities(items);
    const productIds = [...requestedQuantities.keys()];

    const products = await tx.retailProduct.findMany({
      where: {
        id: { in: productIds },
        is_active: true,
      },
    });

    this.assertAllProductsFound(productIds, products);
    this.assertSufficientStock(requestedQuantities, products);

    const productsById = new Map(
      products.map((product) => [product.id, product]),
    );

    const saleItems = items.map((item) => {
      const product = productsById.get(item.product_id);

      if (!product) {
        throw new NotFoundException({
          type: 'NOT_FOUND',
          title: 'RetailProduct Not Found',
          status: 404,
          detail: `RetailProduct with id "${item.product_id}" does not exist.`,
        });
      }

      const unitPrice = new Prisma.Decimal(product.price);
      const overrideUnitPrice =
        item.unit_price !== undefined
          ? new Prisma.Decimal(item.unit_price)
          : null;
      const effectiveUnitPrice = overrideUnitPrice ?? unitPrice;
      const subtotal = effectiveUnitPrice.mul(item.quantity).toDecimalPlaces(2);

      return {
        productId: product.id,
        quantity: item.quantity,
        unitPrice: effectiveUnitPrice,
        subtotal,
      };
    });

    const totalAmount = saleItems.reduce(
      (total, item) => total.plus(item.subtotal),
      new Prisma.Decimal(0),
    );

    return {
      requestedQuantities,
      saleItems,
      totalAmount,
    };
  }

  private async assertCustomerUserExists(
    tx: Prisma.TransactionClient,
    customerUserId: string | undefined,
  ): Promise<void> {
    if (!customerUserId) {
      return;
    }

    const customer = await tx.user.findUnique({
      where: { id: customerUserId },
      select: { id: true },
    });

    if (customer) {
      return;
    }

    throw new NotFoundException({
      type: 'NOT_FOUND',
      title: 'User Not Found',
      status: 404,
      detail: `User with id "${customerUserId}" does not exist.`,
    });
  }

  private async decrementStockQuantities(
    tx: Prisma.TransactionClient,
    requestedQuantities: SaleQuantityRequest,
  ): Promise<void> {
    for (const [productId, quantity] of requestedQuantities.entries()) {
      const result = await tx.retailProduct.updateMany({
        where: {
          id: productId,
          is_active: true,
          stock_quantity: {
            gte: quantity,
          },
        },
        data: {
          stock_quantity: {
            decrement: quantity,
          },
        },
      });

      if (result.count !== 1) {
        throw this.buildInsufficientStockError({
          productId,
          requested: quantity,
        });
      }
    }
  }

  private aggregateRequestedQuantities(
    items: CreateSaleItemDTO[],
  ): SaleQuantityRequest {
    const requestedQuantities: SaleQuantityRequest = new Map();

    for (const item of items) {
      const current = requestedQuantities.get(item.product_id) ?? 0;
      requestedQuantities.set(item.product_id, current + item.quantity);
    }

    return requestedQuantities;
  }

  private assertAllProductsFound(
    requestedIds: string[],
    products: ProductSnapshot[],
  ): void {
    if (products.length === requestedIds.length) {
      return;
    }

    const foundIds = new Set(products.map((product) => product.id));
    const missingId = requestedIds.find((id) => !foundIds.has(id));

    throw new NotFoundException({
      type: 'NOT_FOUND',
      title: 'RetailProduct Not Found',
      status: 404,
      detail: `RetailProduct with id "${missingId}" does not exist.`,
    });
  }

  private assertSufficientStock(
    requestedQuantities: SaleQuantityRequest,
    products: ProductSnapshot[],
  ): void {
    for (const product of products) {
      const requested = requestedQuantities.get(product.id) ?? 0;

      if (requested > product.stock_quantity) {
        throw this.buildInsufficientStockError({
          productId: product.id,
          productName: product.name,
          requested,
          available: product.stock_quantity,
        });
      }
    }
  }

  private buildInsufficientStockError(input: {
    productId: string;
    productName?: string;
    requested: number;
    available?: number;
  }): HttpException {
    const label = input.productName ?? input.productId;
    const availableDetail =
      input.available !== undefined ? ` Available: ${input.available}.` : '';

    return new HttpException(
      {
        type: 'BUSINESS_RULE_VIOLATION',
        title: 'Insufficient Stock',
        status: 422,
        detail: `Insufficient stock for "${label}". Requested: ${input.requested}.${availableDetail}`,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
