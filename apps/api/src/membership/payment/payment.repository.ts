import { Injectable, NotFoundException } from '@nestjs/common';
import {
  MembershipCardSource,
  MembershipCardStatus,
  PayableType,
  Payment,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  Prisma,
  UserStatus,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';

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

type RecurringCoachingPaymentContext = {
  id: string;
  user_id: string;
};

export type PaymongoMembershipCardWebhookInput = {
  gatewayEventId: string;
  gatewayMetadata: Prisma.InputJsonValue;
  verifiedAt: Date;
};

export type PaymongoMembershipCardFailureInput = {
  gatewayEventId: string;
  gatewayMetadata: Prisma.InputJsonValue;
  rejectionReason: string;
};

export type PaymongoMembershipCardTransition = {
  payment: Payment;
  transitioned: boolean;
  membershipCardStateChanged: boolean;
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

  async completeOpenMembershipCardPaymentsForActiveCards(
    userId: string,
  ): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE payments AS payment
      SET
        status = 'completed',
        verified_at = COALESCE(
          payment.verified_at,
          membership_card.verified_at,
          membership_card.activated_at,
          NOW()
        ),
        verified_by = COALESCE(payment.verified_by, membership_card.verified_by),
        rejection_reason = NULL,
        updated_at = NOW()
      FROM membership_cards AS membership_card
      WHERE
        payment.payable_type = 'membership_card'
        AND payment.payable_id = membership_card.id
        AND payment.user_id = ${userId}
        AND payment.provider = 'cash'
        AND payment.status IN ('pending', 'processing', 'awaiting_verification')
        AND membership_card.status = 'active'
    `;
  }

  async completePaymongoMembershipCardPayment(
    paymentId: string,
    input: PaymongoMembershipCardWebhookInput,
  ): Promise<PaymongoMembershipCardTransition> {
    return this.transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        throw new NotFoundException({
          type: 'NOT_FOUND',
          title: 'Payment Not Found',
          status: 404,
          detail: `Payment with id "${paymentId}" does not exist.`,
        });
      }

      if (
        payment.payable_type !== PayableType.membership_card ||
        payment.provider !== PaymentProvider.paymongo
      ) {
        return {
          payment,
          transitioned: false,
          membershipCardStateChanged: false,
        };
      }

      const paymentTransition = await tx.payment.updateMany({
        where: {
          id: paymentId,
          payable_type: PayableType.membership_card,
          provider: PaymentProvider.paymongo,
          status: {
            in: [PaymentStatus.pending, PaymentStatus.processing],
          },
        },
        data: {
          status: PaymentStatus.completed,
          verified_at: input.verifiedAt,
          gateway_event_id: input.gatewayEventId,
          gateway_metadata: input.gatewayMetadata,
          rejection_reason: null,
        },
      });

      const currentPayment = await tx.payment.findUnique({
        where: { id: paymentId },
      });

      if (!currentPayment) {
        throw new NotFoundException({
          type: 'NOT_FOUND',
          title: 'Payment Not Found',
          status: 404,
          detail: `Payment with id "${paymentId}" does not exist.`,
        });
      }

      if (paymentTransition.count === 0) {
        return {
          payment: currentPayment,
          transitioned: false,
          membershipCardStateChanged: false,
        };
      }

      const card = await tx.membershipCard.findUnique({
        where: { id: payment.payable_id },
      });

      if (!card) {
        throw new NotFoundException({
          type: 'NOT_FOUND',
          title: 'Membership Card Not Found',
          status: 404,
          detail: `MembershipCard with id "${payment.payable_id}" does not exist.`,
        });
      }

      const cardTransition = await tx.membershipCard.updateMany({
        where: {
          id: card.id,
          user_id: payment.user_id,
          source: MembershipCardSource.paymongo,
          status: MembershipCardStatus.pending_verification,
        },
        data: {
          activated_at: input.verifiedAt,
          revoke_reason: null,
          revoked_at: null,
          revoked_by: null,
          status: MembershipCardStatus.active,
          verified_at: input.verifiedAt,
          verified_by: null,
        },
      });

      if (cardTransition.count > 0) {
        const owner = await tx.user.findUnique({
          where: { id: payment.user_id },
          select: { id: true, qr_code_token: true, status: true },
        });

        if (
          owner &&
          (owner.status === UserStatus.pending || !owner.qr_code_token)
        ) {
          await tx.user.update({
            where: { id: owner.id },
            data: {
              ...(owner.status === UserStatus.pending
                ? { status: UserStatus.active }
                : {}),
              ...(!owner.qr_code_token
                ? { qr_code_token: randomBytes(32).toString('hex') }
                : {}),
            },
          });
        }
      }

      return {
        payment: currentPayment,
        transitioned: true,
        membershipCardStateChanged: cardTransition.count > 0,
      };
    });
  }

  async failPaymongoMembershipCardPayment(
    paymentId: string,
    input: PaymongoMembershipCardFailureInput,
  ): Promise<PaymongoMembershipCardTransition> {
    return this.transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        throw new NotFoundException({
          type: 'NOT_FOUND',
          title: 'Payment Not Found',
          status: 404,
          detail: `Payment with id "${paymentId}" does not exist.`,
        });
      }

      if (
        payment.payable_type !== PayableType.membership_card ||
        payment.provider !== PaymentProvider.paymongo
      ) {
        return {
          payment,
          transitioned: false,
          membershipCardStateChanged: false,
        };
      }

      const paymentTransition = await tx.payment.updateMany({
        where: {
          id: paymentId,
          payable_type: PayableType.membership_card,
          provider: PaymentProvider.paymongo,
          status: {
            in: [PaymentStatus.pending, PaymentStatus.processing],
          },
        },
        data: {
          status: PaymentStatus.failed,
          gateway_event_id: input.gatewayEventId,
          gateway_metadata: input.gatewayMetadata,
          rejection_reason: input.rejectionReason,
        },
      });

      const currentPayment = await tx.payment.findUnique({
        where: { id: paymentId },
      });

      if (!currentPayment) {
        throw new NotFoundException({
          type: 'NOT_FOUND',
          title: 'Payment Not Found',
          status: 404,
          detail: `Payment with id "${paymentId}" does not exist.`,
        });
      }

      if (paymentTransition.count === 0) {
        return {
          payment: currentPayment,
          transitioned: false,
          membershipCardStateChanged: false,
        };
      }

      const cardTransition = await tx.membershipCard.updateMany({
        where: {
          id: payment.payable_id,
          user_id: payment.user_id,
          source: MembershipCardSource.paymongo,
          status: MembershipCardStatus.pending_verification,
        },
        data: {
          activated_at: null,
          revoke_reason: input.rejectionReason,
          revoked_at: new Date(),
          status: MembershipCardStatus.revoked,
        },
      });

      return {
        payment: currentPayment,
        transitioned: true,
        membershipCardStateChanged: cardTransition.count > 0,
      };
    });
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

  findLatestPaymentsForPayableIds(
    payableType: PayableType,
    payableIds: string[],
  ): Promise<Payment[]> {
    if (payableIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.prisma.payment.findMany({
      where: {
        payable_type: payableType,
        payable_id: { in: payableIds },
        status: {
          not: PaymentStatus.failed,
        },
      },
      orderBy: [{ created_at: 'desc' }],
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

  async findRecurringCoachingPaymentContextOrThrow(
    id: string,
  ): Promise<RecurringCoachingPaymentContext> {
    const cycle =
      await this.prisma.recurringCoachingBillingCycle.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          recurring_plan: {
            select: {
              member_id: true,
            },
          },
        },
      });

    return {
      id: cycle.id,
      user_id: cycle.recurring_plan.member_id,
    };
  }
}
