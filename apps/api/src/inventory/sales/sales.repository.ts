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
import {
  InventoryAnalyticsPeriodEnum,
  type InventoryAnalyticsPeriod,
} from './dto/sales.dto';

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

export type SalesSummaryRecord = {
  completed_sales_count: number;
  total_revenue: Prisma.Decimal;
};

export type SalesAnalyticsPointRecord = {
  bucket_label: string;
  revenue: Prisma.Decimal;
};

export type SalesAnalyticsTopProductRecord = {
  name: string;
  value: Prisma.Decimal;
};

export type SalesAnalyticsRecord = {
  period: InventoryAnalyticsPeriod;
  revenue_series: SalesAnalyticsPointRecord[];
  top_products_by_inventory_value: SalesAnalyticsTopProductRecord[];
  top_products_by_stocks_sold: SalesAnalyticsTopProductRecord[];
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

  async getSalesSummary(dto: DateRangeDTO): Promise<SalesSummaryRecord> {
    const where: Prisma.SaleTransactionWhereInput = {
      status: 'completed',
    };

    if (dto.start_date || dto.end_date) {
      where.created_at = {
        ...(dto.start_date
          ? { gte: new Date(`${dto.start_date}T00:00:00.000Z`) }
          : {}),
        ...(dto.end_date
          ? { lte: new Date(`${dto.end_date}T23:59:59.999Z`) }
          : {}),
      };
    }

    const [completedSalesCount, aggregate] = await Promise.all([
      this.prisma.saleTransaction.count({ where }),
      this.prisma.saleTransaction.aggregate({
        where,
        _sum: {
          total_amount: true,
        },
      }),
    ]);

    return {
      completed_sales_count: completedSalesCount,
      total_revenue: aggregate._sum.total_amount ?? new Prisma.Decimal(0),
    };
  }

  async getSalesAnalytics(
    period: InventoryAnalyticsPeriod,
  ): Promise<SalesAnalyticsRecord> {
    const normalizedPeriod = period as InventoryAnalyticsPeriodEnum;
    const revenueSeries = await this.buildRevenueSeries(normalizedPeriod);
    const [topProductsByInventoryValue, topProductsByStocksSold] =
      await Promise.all([
        this.buildTopProductsByInventoryValue(),
        this.buildTopProductsByStocksSold(),
      ]);

    return {
      period: normalizedPeriod,
      revenue_series: revenueSeries,
      top_products_by_inventory_value: topProductsByInventoryValue,
      top_products_by_stocks_sold: topProductsByStocksSold,
    };
  }

  findSaleByIdOrThrow(id: string): Promise<SaleDetailRecord> {
    return this.findByIdOrThrow<SaleDetailRecord>(
      this.prisma.saleTransaction,
      id,
      'SaleTransaction',
      saleDetailInclude,
    );
  }

  private async buildRevenueSeries(
    period: InventoryAnalyticsPeriodEnum,
  ): Promise<SalesAnalyticsPointRecord[]> {
    const now = new Date();
    const buckets = this.createAnalyticsBuckets(period, now);
    const firstBucketStart = buckets[0]?.start;

    const sales = await this.prisma.saleTransaction.findMany({
      where: {
        status: 'completed',
        ...(firstBucketStart
          ? {
              created_at: {
                gte: firstBucketStart,
                lte: now,
              },
            }
          : {}),
      },
      select: {
        created_at: true,
        total_amount: true,
      },
    });

    const bucketsByKey = new Map(
      buckets.map((bucket) => [
        bucket.key,
        {
          bucket_label: bucket.label,
          revenue: new Prisma.Decimal(0),
        },
      ]),
    );

    for (const sale of sales) {
      const bucketKey = this.resolveAnalyticsBucketKey(period, sale.created_at);
      const bucket = bucketsByKey.get(bucketKey);
      if (!bucket) continue;
      bucket.revenue = bucket.revenue.plus(sale.total_amount);
    }

    return buckets.map((bucket) => bucketsByKey.get(bucket.key)!);
  }

  private async buildTopProductsByInventoryValue(): Promise<
    SalesAnalyticsTopProductRecord[]
  > {
    const products = await this.prisma.retailProduct.findMany({
      where: {
        is_active: true,
      },
      select: {
        name: true,
        price: true,
        stock_quantity: true,
      },
    });

    return products
      .map((product) => ({
        name: product.name,
        value: product.price.mul(product.stock_quantity),
      }))
      .sort((left, right) => right.value.minus(left.value).toNumber())
      .slice(0, 6);
  }

  private async buildTopProductsByStocksSold(): Promise<
    SalesAnalyticsTopProductRecord[]
  > {
    const rows = await this.prisma.saleTransactionItem.groupBy({
      by: ['product_id'],
      where: {
        transaction: {
          status: 'completed',
        },
      },
      _sum: {
        quantity: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: 6,
    });

    const productIds = rows.map((row) => row.product_id);
    const products = productIds.length
      ? await this.prisma.retailProduct.findMany({
          where: {
            id: {
              in: productIds,
            },
          },
          select: {
            id: true,
            name: true,
          },
        })
      : [];
    const productNames = new Map(
      products.map((product) => [product.id, product.name]),
    );

    return rows.map((row) => ({
      name:
        productNames.get(row.product_id) ??
        row.product_id.slice(0, 8).toUpperCase(),
      value: new Prisma.Decimal(row._sum.quantity ?? 0),
    }));
  }

  private createAnalyticsBuckets(
    period: InventoryAnalyticsPeriodEnum,
    now: Date,
  ) {
    const bucketCount =
      period === InventoryAnalyticsPeriodEnum.Daily
        ? 7
        : period === InventoryAnalyticsPeriodEnum.Weekly
          ? 8
          : period === InventoryAnalyticsPeriodEnum.Monthly
            ? 6
            : period === InventoryAnalyticsPeriodEnum.Quarterly
              ? 4
              : 5;
    const firstBucketDate =
      period === InventoryAnalyticsPeriodEnum.Daily
        ? this.startOfDay(this.addDays(now, -(bucketCount - 1)))
        : period === InventoryAnalyticsPeriodEnum.Weekly
          ? this.startOfWeek(this.addDays(now, -7 * (bucketCount - 1)))
          : period === InventoryAnalyticsPeriodEnum.Monthly
            ? this.startOfMonth(this.addMonths(now, -(bucketCount - 1)))
            : period === InventoryAnalyticsPeriodEnum.Quarterly
              ? this.startOfQuarter(this.addMonths(now, -3 * (bucketCount - 1)))
              : this.startOfYear(this.addYears(now, -(bucketCount - 1)));

    return Array.from({ length: bucketCount }, (_, index) => {
      const start =
        period === InventoryAnalyticsPeriodEnum.Daily
          ? this.startOfDay(this.addDays(firstBucketDate, index))
          : period === InventoryAnalyticsPeriodEnum.Weekly
            ? this.startOfWeek(this.addDays(firstBucketDate, index * 7))
            : period === InventoryAnalyticsPeriodEnum.Monthly
              ? this.startOfMonth(this.addMonths(firstBucketDate, index))
              : period === InventoryAnalyticsPeriodEnum.Quarterly
                ? this.startOfQuarter(
                    this.addMonths(firstBucketDate, index * 3),
                  )
                : this.startOfYear(this.addYears(firstBucketDate, index));

      return {
        key: this.resolveAnalyticsBucketKey(period, start),
        label: this.formatAnalyticsBucketLabel(period, start),
        start,
      };
    });
  }

  private resolveAnalyticsBucketKey(
    period: InventoryAnalyticsPeriodEnum,
    date: Date,
  ): string {
    if (period === InventoryAnalyticsPeriodEnum.Daily) {
      return this.startOfDay(date).toISOString();
    }

    if (period === InventoryAnalyticsPeriodEnum.Weekly) {
      return this.startOfWeek(date).toISOString();
    }

    if (period === InventoryAnalyticsPeriodEnum.Monthly) {
      return this.startOfMonth(date).toISOString();
    }

    if (period === InventoryAnalyticsPeriodEnum.Quarterly) {
      return this.startOfQuarter(date).toISOString();
    }

    return this.startOfYear(date).toISOString();
  }

  private formatAnalyticsBucketLabel(
    period: InventoryAnalyticsPeriodEnum,
    date: Date,
  ): string {
    if (period === InventoryAnalyticsPeriodEnum.Daily) {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }

    if (period === InventoryAnalyticsPeriodEnum.Weekly) {
      return `Week of ${date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })}`;
    }

    if (period === InventoryAnalyticsPeriodEnum.Monthly) {
      return date.toLocaleDateString('en-US', { month: 'short' });
    }

    if (period === InventoryAnalyticsPeriodEnum.Quarterly) {
      return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
    }

    return date.getFullYear().toString();
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private startOfWeek(date: Date): Date {
    const current = this.startOfDay(date);
    const day = current.getDay();
    const diff = (day + 6) % 7;
    current.setDate(current.getDate() - diff);
    return current;
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private startOfQuarter(date: Date): Date {
    const quarterMonth = Math.floor(date.getMonth() / 3) * 3;
    return new Date(date.getFullYear(), quarterMonth, 1);
  }

  private startOfYear(date: Date): Date {
    return new Date(date.getFullYear(), 0, 1);
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private addMonths(date: Date, months: number): Date {
    return new Date(date.getFullYear(), date.getMonth() + months, 1);
  }

  private addYears(date: Date, years: number): Date {
    return new Date(date.getFullYear() + years, 0, 1);
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
