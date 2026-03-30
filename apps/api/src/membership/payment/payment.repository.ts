import { Injectable } from '@nestjs/common';
import { PayableType, Payment, PaymentStage, Prisma } from '@prisma/client';

import {
  BaseRepository,
  PaginatedResult,
} from '../../common/base-repository/base-repository';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentFilterDTO, PaymentHistoryDTO } from './dto/payment.dto';

type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: {
    user: { include: { profile: true } };
    verifier: { include: { profile: true } };
  };
}>;

type SubscriptionPaymentContext = {
  id: string;
  user_id: string;
};

type BookingPaymentContext = {
  id: string;
  user_id: string;
};

type CoachingPaymentContext = {
  id: string;
  user_id: string;
};

@Injectable()
export class PaymentRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  private readonly paymentInclude = {
    user: { include: { profile: true } },
    verifier: { include: { profile: true } },
  } as const;

  getMyPayments(
    userId: string,
    dto: PaymentHistoryDTO,
  ): Promise<PaginatedResult<Payment>> {
    return this.paginateByUserIdWithDateRange<Payment>(
      this.prisma.payment,
      userId,
      {
        start_date: dto.start_date,
        end_date: dto.end_date,
        dateField: 'created_at',
      },
      { orderBy: { created_at: 'desc' } },
      { page: dto.page, limit: dto.limit },
    );
  }

  findPaymentByIdForOwnerOrThrow(
    id: string,
    userId: string,
  ): Promise<PaymentWithRelations> {
    return this.findByIdAndAssertOwnership<PaymentWithRelations>(
      this.prisma.payment,
      id,
      userId,
      'Payment',
      this.paymentInclude,
    );
  }

  findPaymentByIdForStaffOrThrow(id: string): Promise<PaymentWithRelations> {
    return this.findByIdOrThrow<PaymentWithRelations>(
      this.prisma.payment,
      id,
      'Payment',
      this.paymentInclude,
    );
  }

  getAllPayments(
    dto: PaymentFilterDTO,
  ): Promise<PaginatedResult<PaymentWithRelations>> {
    const where: Prisma.PaymentWhereInput = {};

    if (dto.status) where.status = dto.status;
    if (dto.payable_type) where.payable_type = dto.payable_type;

    return this.paginate<PaymentWithRelations>(
      this.prisma.payment,
      {
        where,
        include: this.paymentInclude,
        orderBy: { created_at: 'desc' },
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  createPayment(data: Prisma.PaymentCreateInput): Promise<Payment> {
    return this.create<Payment>(this.prisma.payment, data);
  }

  findPaymentByIdempotencyKey(idempotencyKey: string): Promise<Payment | null> {
    return this.findUniqueWhere<Payment>(this.prisma.payment, {
      idempotency_key: idempotencyKey,
    });
  }

  findPaymentByGatewayEventId(gatewayEventId: string): Promise<Payment | null> {
    return this.findUniqueWhere<Payment>(this.prisma.payment, {
      gateway_event_id: gatewayEventId,
    });
  }

  findPaymentByProviderRefOrThrow(providerRef: string): Promise<Payment> {
    return this.findUniqueWhereOrThrow<Payment>(
      this.prisma.payment,
      { provider_ref: providerRef },
      'Payment',
    );
  }

  findPaymentByIdOrThrow(id: string): Promise<Payment> {
    return this.findByIdOrThrow<Payment>(this.prisma.payment, id, 'Payment');
  }

  findLatestPaymentForPayableStage(
    payableType: PayableType,
    payableId: string,
    paymentStage: PaymentStage,
  ): Promise<Payment | null> {
    return this.prisma.payment.findFirst({
      where: {
        payable_type: payableType,
        payable_id: payableId,
        payment_stage: paymentStage,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  updatePayment(id: string, data: Prisma.PaymentUpdateInput): Promise<Payment> {
    return this.updateById<Payment>(this.prisma.payment, id, data);
  }

  findSubscriptionPaymentContextOrThrow(
    id: string,
  ): Promise<SubscriptionPaymentContext> {
    return this.findByIdOrThrow<SubscriptionPaymentContext>(
      this.prisma.subscription,
      id,
      'Subscription',
      undefined,
      { id: true, user_id: true },
    );
  }

  findBookingPaymentContextOrThrow(id: string): Promise<BookingPaymentContext> {
    return this.findByIdOrThrow<BookingPaymentContext>(
      this.prisma.amenityBooking,
      id,
      'AmenityBooking',
      undefined,
      { id: true, user_id: true },
    );
  }

  findCoachingPaymentContextOrThrow(
    id: string,
  ): Promise<CoachingPaymentContext> {
    return this.findByIdOrThrow<CoachingPaymentContext>(
      this.prisma.coachAppointment,
      id,
      'CoachAppointment',
      undefined,
      { id: true, user_id: true },
    );
  }
}
