import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  PayableType,
  Payment,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  SalePaymentMethod,
  SaleSource,
  SaleStatus,
  UserRole,
} from '@prisma/client';
import { isUUID } from 'class-validator';

import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import type { PaginatedResult } from '../../common/base-repository/base-repository';
import {
  PAYMENT_COMPLETED_EVENT,
  type PaymentCompletedEvent,
} from '../../membership/payment/events/payment-completed.event';
import {
  PaymongoCheckoutResult,
  PaymongoCheckoutService,
} from '../../membership/payment/paymongo-checkout.service';
import { PaymentRepository } from '../../membership/payment/payment.repository';
import {
  CreateSaleDTO,
  SaleCheckoutResponseDTO,
  SaleFilterDTO,
  SaleTransactionDetailResponseDTO,
  SaleTransactionItemResponseDTO,
  SaleTransactionSummaryResponseDTO,
} from './dto/sales.dto';
import {
  SaleDetailRecord,
  SalesRepository,
  SaleSummaryRecord,
} from './sales.repository';
import {
  PRODUCT_STOCK_CHANGED_EVENT,
  type ProductStockChangedEvent,
} from '../events/product-stock-changed.event';
import {
  INVENTORY_ACTIVITY_EVENT,
  type InventoryActivityEvent,
} from '../events/inventory-activity.event';

@Injectable()
export class SalesService {
  constructor(
    private readonly repo: SalesRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly paymongoCheckoutService: PaymongoCheckoutService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createSale(
    user: Pick<JwtPayload, 'role' | 'sub'>,
    dto: CreateSaleDTO,
    idempotencyKey: string | undefined,
  ): Promise<SaleTransactionDetailResponseDTO | SaleCheckoutResponseDTO> {
    const saleContext = this.resolveSaleContext(user, dto);

    if (dto.payment_method === SalePaymentMethod.cash) {
      const sale = await this.repo.createCashSale({
        notes: dto.notes,
        processedBy: saleContext.processedBy,
        customerName: dto.customer_name,
        customerUserId: saleContext.customerUserId,
        items: dto.items,
        source: saleContext.source,
      });

      this.emitProductStockChanged({
        productIds: sale.items.map((item) => item.product_id),
      });
      await this.emitSaleRecordedActivity(sale);

      return this.toDetailResponse(sale);
    }

    const normalizedIdempotencyKey =
      this.normalizeAndValidateIdempotencyKey(idempotencyKey);
    const customerUserId = this.requireCustomerUserForPaymongo(
      saleContext.customerUserId,
    );
    const existingPayment =
      await this.paymentRepository.findPaymentByIdempotencyKey(
        normalizedIdempotencyKey,
      );

    if (existingPayment) {
      return this.resumeExistingCheckout(
        existingPayment,
        saleContext.processedBy,
        customerUserId,
      );
    }

    try {
      const initiation = await this.repo.createPendingPaymongoSale({
        notes: dto.notes,
        processedBy: saleContext.processedBy,
        customerName: dto.customer_name,
        customerUserId,
        items: dto.items,
        idempotencyKey: normalizedIdempotencyKey,
        source: saleContext.source,
      });

      this.emitProductStockChanged({
        productIds: initiation.sale.items.map((item) => item.product_id),
      });

      return this.startCheckoutForPayment(
        initiation.payment,
        initiation.sale.id,
      );
    } catch (error) {
      const resumedPayment =
        await this.paymentRepository.findPaymentByIdempotencyKey(
          normalizedIdempotencyKey,
        );

      if (resumedPayment) {
        return this.resumeExistingCheckout(
          resumedPayment,
          saleContext.processedBy,
          customerUserId,
        );
      }

      throw error;
    }
  }

  async listSales(
    dto: SaleFilterDTO,
  ): Promise<PaginatedResult<SaleTransactionSummaryResponseDTO>> {
    const result = await this.repo.listSales(dto);

    return {
      data: result.data.map((sale) => this.toSummaryResponse(sale)),
      meta: result.meta,
    };
  }

  async getSaleById(id: string): Promise<SaleTransactionDetailResponseDTO> {
    return this.toDetailResponse(await this.repo.findSaleByIdOrThrow(id));
  }

  @OnEvent(PAYMENT_COMPLETED_EVENT, { async: true })
  async handlePaymentCompleted(event: PaymentCompletedEvent): Promise<void> {
    if (event.payableType !== PayableType.product) {
      return;
    }

    const sale = await this.repo.completePendingPaymongoSale(
      event.payableId,
      event.paymentId,
    );

    if (!sale) {
      return;
    }

    await this.emitSaleRecordedActivity(sale);
  }

  private normalizeAndValidateIdempotencyKey(
    idempotencyKey: string | undefined,
  ): string {
    const normalized = idempotencyKey?.trim();

    if (!normalized || !isUUID(normalized, '4')) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Invalid Idempotency Key',
          status: 422,
          detail: 'Idempotency-Key header must be a valid UUID v4.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return normalized;
  }

  private requireCustomerUserForPaymongo(
    customerUserId: string | undefined,
  ): string {
    if (customerUserId) {
      return customerUserId;
    }

    throw new HttpException(
      {
        type: 'BUSINESS_RULE_VIOLATION',
        title: 'Customer User Required',
        status: 422,
        detail: 'customer_user_id is required when payment_method is paymongo.',
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  private resolveSaleContext(
    user: Pick<JwtPayload, 'role' | 'sub'>,
    dto: CreateSaleDTO,
  ): {
    customerUserId: string | undefined;
    processedBy: string;
    source: SaleSource;
  } {
    if (user.role === UserRole.member) {
      if (dto.payment_method !== SalePaymentMethod.paymongo) {
        throw new HttpException(
          {
            type: 'BUSINESS_RULE_VIOLATION',
            title: 'Unsupported Member Sale Method',
            status: 422,
            detail:
              'Members can only start retail purchases through PayMongo checkout.',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      return {
        customerUserId: user.sub,
        processedBy: user.sub,
        source: SaleSource.mobile,
      };
    }

    return {
      customerUserId:
        dto.payment_method === SalePaymentMethod.paymongo
          ? this.requireCustomerUserForPaymongo(dto.customer_user_id)
          : dto.customer_user_id,
      processedBy: user.sub,
      source: SaleSource.manual,
    };
  }

  private async resumeExistingCheckout(
    payment: Payment,
    staffId: string,
    customerUserId: string,
  ): Promise<SaleCheckoutResponseDTO> {
    if (payment.payable_type !== PayableType.product) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Idempotency Key Already Used',
        status: 409,
        detail:
          'This Idempotency-Key is already associated with another payment request.',
      });
    }

    if (payment.provider !== PaymentProvider.paymongo) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Payment Provider Mismatch',
        status: 409,
        detail:
          'This Idempotency-Key is already associated with a non-PayMongo payment.',
      });
    }

    const sale = await this.repo.findSaleByIdOrThrow(payment.payable_id);

    if (sale.processed_by !== staffId) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Sale Ownership Conflict',
        status: 409,
        detail:
          'This Idempotency-Key is already associated with another retail sale actor.',
      });
    }

    if (sale.customer_user_id !== customerUserId) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Sale Customer Conflict',
        status: 409,
        detail:
          'This Idempotency-Key is already associated with another sale customer.',
      });
    }

    const checkoutUrl = this.extractCheckoutUrl(payment.gateway_metadata);

    if (payment.status === PaymentStatus.failed) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Payment Attempt Already Failed',
        status: 409,
        detail:
          'This Idempotency-Key belongs to a failed payment attempt. Start a new attempt with a new key.',
      });
    }

    if (payment.status === PaymentStatus.completed || checkoutUrl) {
      return this.toCheckoutResponse(
        sale.id,
        payment.id,
        sale.status,
        payment.status,
        checkoutUrl,
      );
    }

    return this.startCheckoutForPayment(payment, sale.id);
  }

  private async startCheckoutForPayment(
    payment: Payment,
    saleId: string,
  ): Promise<SaleCheckoutResponseDTO> {
    const checkout = await this.paymongoCheckoutService.createCheckoutSession({
      amount: this.toMinorAmount(payment.amount),
      description: 'Product Sale',
      idempotencyKey: payment.idempotency_key,
      metadata: {
        payment_id: payment.id,
        sale_id: saleId,
      },
    });

    const updatedPayment = await this.paymentRepository.updatePayment(
      payment.id,
      this.toCheckoutUpdateInput(checkout),
    );

    return this.toCheckoutResponse(
      saleId,
      updatedPayment.id,
      'pending',
      updatedPayment.status,
      checkout.checkoutUrl,
    );
  }

  private toCheckoutUpdateInput(
    checkout: PaymongoCheckoutResult,
  ): Prisma.PaymentUpdateInput {
    return {
      status: PaymentStatus.processing,
      provider_ref: checkout.providerRef,
      gateway_metadata: checkout.gatewayMetadata as Prisma.InputJsonValue,
    };
  }

  private toMinorAmount(amount: Prisma.Decimal | number): number {
    return Math.round(Number(amount) * 100);
  }

  private extractCheckoutUrl(
    gatewayMetadata: Prisma.JsonValue | null,
  ): string | null {
    if (
      gatewayMetadata &&
      typeof gatewayMetadata === 'object' &&
      !Array.isArray(gatewayMetadata)
    ) {
      const checkoutUrl = gatewayMetadata['checkout_url'];

      if (typeof checkoutUrl === 'string' && checkoutUrl.length > 0) {
        return checkoutUrl;
      }
    }

    return null;
  }

  private toCheckoutResponse(
    saleId: string,
    paymentId: string,
    status: SaleStatus,
    paymentStatus: PaymentStatus,
    checkoutUrl: string | null,
  ): SaleCheckoutResponseDTO {
    return {
      sale_id: saleId,
      payment_id: paymentId,
      status,
      payment_status: paymentStatus,
      checkout_url: checkoutUrl,
    };
  }

  private emitProductStockChanged(event: ProductStockChangedEvent): void {
    this.eventEmitter.emit(PRODUCT_STOCK_CHANGED_EVENT, event);
  }

  private async emitInventoryActivity(
    event: InventoryActivityEvent,
  ): Promise<void> {
    await this.eventEmitter.emitAsync(INVENTORY_ACTIVITY_EVENT, event);
  }

  private async emitSaleRecordedActivity(
    sale: SaleDetailRecord,
  ): Promise<void> {
    const itemCount = sale.items.length;
    const quantitySold = sale.items.reduce(
      (total, item) => total + item.quantity,
      0,
    );
    const productNames = sale.items
      .map((item) => item.product?.name ?? item.product_id)
      .filter(Boolean)
      .join(', ');
    const entityName =
      itemCount === 1
        ? (sale.items[0]?.product?.name ?? 'Retail sale')
        : `Retail sale (${itemCount} items)`;

    await this.emitInventoryActivity({
      action: 'product_sale_recorded',
      actorId: sale.processed_by,
      entityId: sale.id,
      entityName,
      details: {
        item_count: itemCount,
        payment_method: sale.payment_method,
        product_names: productNames || null,
        quantity_sold: quantitySold,
        sale_id: sale.id,
        source: sale.source,
        status: sale.status,
        total_amount: sale.total_amount.toFixed(2),
      },
    });
  }

  private toSummaryResponse(
    sale: SaleSummaryRecord,
  ): SaleTransactionSummaryResponseDTO {
    return {
      id: sale.id,
      customer_name: sale.customer_name ?? null,
      customer_user_id: sale.customer_user_id ?? null,
      notes: sale.notes ?? null,
      source: sale.source,
      total_amount: sale.total_amount.toFixed(2),
      payment_method: sale.payment_method,
      payment_id: sale.payment_id ?? null,
      processed_by: sale.processed_by,
      status: sale.status,
      staff: sale.staff
        ? {
            id: sale.staff.id,
            first_name: sale.staff.profile?.first_name ?? null,
            last_name: sale.staff.profile?.last_name ?? null,
          }
        : null,
      items_count: sale._count.items,
      created_at: sale.created_at.toISOString(),
      updated_at: sale.updated_at.toISOString(),
    };
  }

  private toDetailResponse(
    sale: SaleDetailRecord,
  ): SaleTransactionDetailResponseDTO {
    return {
      id: sale.id,
      customer_name: sale.customer_name ?? null,
      customer_user_id: sale.customer_user_id ?? null,
      notes: sale.notes ?? null,
      source: sale.source,
      total_amount: sale.total_amount.toFixed(2),
      payment_method: sale.payment_method,
      payment_id: sale.payment_id ?? null,
      processed_by: sale.processed_by,
      status: sale.status,
      staff: sale.staff
        ? {
            id: sale.staff.id,
            first_name: sale.staff.profile?.first_name ?? null,
            last_name: sale.staff.profile?.last_name ?? null,
          }
        : null,
      items_count: sale.items.length,
      created_at: sale.created_at.toISOString(),
      updated_at: sale.updated_at.toISOString(),
      items: sale.items.map(
        (item): SaleTransactionItemResponseDTO => ({
          id: item.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price.toFixed(2),
          subtotal: item.subtotal.toFixed(2),
          product: item.product
            ? {
                id: item.product.id,
                name: item.product.name,
                image_url: item.product.image_url ?? null,
              }
            : null,
        }),
      ),
    };
  }
}
