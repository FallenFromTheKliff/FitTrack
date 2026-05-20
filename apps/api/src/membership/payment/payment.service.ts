import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  PayableType,
  Prisma,
  Payment,
  PaymentProvider,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'crypto';

import { AuditAction, AuditEvent } from '../../audit/audit.service';
import { PaginatedResult } from '../../common/base-repository/base-repository';
import { ACCOUNT_ACTIVITY_EVENT } from '../../user/events/account-activity.event';
import {
  ManualPaymentDTO,
  PaymentFilterDTO,
  PaymentHistoryDTO,
  PaymentWebhookAckDTO,
  VerifyPaymentDTO,
} from './dto/payment.dto';
import {
  PAYMENT_COMPLETED_EVENT,
  PaymentCompletedEvent,
} from './events/payment-completed.event';
import {
  PAYMENT_FAILED_EVENT,
  type PaymentFailedEvent,
} from './events/payment-failed.event';
import {
  PAYMONGO_CHECKOUT_SESSION_PAID_EVENT,
  PAYMONGO_PAYMENT_FAILED_EVENT,
  PaymongoWebhookEvent,
  PaymongoWebhookService,
} from './paymongo-webhook.service';
import { PaymentRepository } from './payment.repository';

type PaymentDetails = Awaited<
  ReturnType<PaymentRepository['findPaymentByIdForStaffOrThrow']>
>;

function getPaymentUserDisplayName(payment: PaymentDetails) {
  return [payment.user?.profile?.first_name, payment.user?.profile?.last_name]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .trim();
}

@Injectable()
export class PaymentService {
  constructor(
    private readonly repo: PaymentRepository,
    private readonly paymongoWebhookService: PaymongoWebhookService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getMyPayments(
    userId: string,
    dto: PaymentHistoryDTO,
  ): Promise<PaginatedResult<Payment>> {
    await this.repo.completeOpenMembershipCardPaymentsForActiveCards(userId);
    return this.repo.getMyPayments(userId, dto);
  }

  getPaymentById(
    paymentId: string,
    requesterId: string,
    role: UserRole,
  ): Promise<PaymentDetails> {
    if (role === UserRole.admin || role === UserRole.staff) {
      return this.repo.findPaymentByIdForStaffOrThrow(paymentId);
    }

    return this.repo.findPaymentByIdForOwnerOrThrow(paymentId, requesterId);
  }

  getAllPayments(
    dto: PaymentFilterDTO,
  ): Promise<PaginatedResult<PaymentDetails>> {
    return this.repo.getAllPayments(dto);
  }

  async submitManualPayment(
    requesterId: string,
    requesterRole: UserRole,
    dto: ManualPaymentDTO,
  ): Promise<Payment> {
    const paymentOwnerId = await this.resolvePaymentOwnerId(dto);
    const isStaffReviewer = this.isStaffReviewer(requesterRole);

    if (!isStaffReviewer && paymentOwnerId !== requesterId) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Forbidden',
        status: 403,
        detail: 'You can only submit manual payments for your own records.',
      });
    }

    return this.repo.createPayment(
      this.toManualPaymentCreateInput(dto, paymentOwnerId),
    );
  }

  async verifyPayment(
    paymentId: string,
    dto: VerifyPaymentDTO,
    adminId: string,
  ): Promise<void> {
    this.assertRejectionReason(dto);

    const payment = await this.repo.findPaymentByIdForStaffOrThrow(paymentId);
    this.assertAwaitingVerification(payment);

    const nextStatus = dto.action === 'approve' ? 'completed' : 'failed';
    const verifiedAt = new Date();

    await this.repo.updatePayment(
      paymentId,
      this.toVerificationUpdateInput(adminId, dto, nextStatus, verifiedAt),
    );

    this.emitAudit({
      userId: adminId,
      action: AuditAction.PAYMENT_VERIFIED,
      entity: 'Payment',
      entityId: paymentId,
      before: { status: payment.status },
      after: {
        status: nextStatus,
        rejection_reason:
          dto.action === 'reject' ? (dto.rejection_reason ?? null) : null,
      },
    });

    if (dto.action === 'approve') {
      this.emitPaymentCompleted({
        paymentId,
        userId: payment.user_id,
        payableType: payment.payable_type,
        payableId: payment.payable_id,
        amount: payment.amount.toString(),
        verifiedBy: adminId,
      });
      this.eventEmitter.emit(ACCOUNT_ACTIVITY_EVENT, {
        action: 'payment_approved',
        actorId: adminId,
        details: {
          amount: payment.amount.toString(),
          payable_id: payment.payable_id,
          payable_type: payment.payable_type,
          payment_id: paymentId,
        },
        occurredAt: verifiedAt.toISOString(),
        targetName: getPaymentUserDisplayName(payment),
        targetRole: UserRole.member,
        targetUserId: payment.user_id,
      });
      return;
    }

    this.emitPaymentFailed({
      paymentId,
      userId: payment.user_id,
      payableType: payment.payable_type,
      payableId: payment.payable_id,
      amount: payment.amount.toString(),
      reason: dto.rejection_reason ?? null,
      failedAt: verifiedAt.toISOString(),
    });
  }

  async handleWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): Promise<PaymentWebhookAckDTO> {
    const event = this.paymongoWebhookService.parseAndVerify(
      rawBody,
      signature,
    );

    if (event.data.attributes.type === PAYMONGO_CHECKOUT_SESSION_PAID_EVENT) {
      return this.handleCheckoutSessionPaidWebhook(event);
    }

    if (event.data.attributes.type === PAYMONGO_PAYMENT_FAILED_EVENT) {
      return this.handlePaymentFailedWebhook(event);
    }

    return this.successAck();
  }

  private async handleCheckoutSessionPaidWebhook(
    event: PaymongoWebhookEvent,
  ): Promise<PaymentWebhookAckDTO> {
    const existingEvent = await this.repo.findPaymentByGatewayEventId(
      event.data.id,
    );

    if (existingEvent) {
      return this.successAck();
    }

    const checkoutSession = event.data.attributes.data;
    const payment = await this.repo.findPaymentByProviderRefOrThrow(
      checkoutSession.id,
    );

    try {
      await this.repo.updatePayment(
        payment.id,
        this.toWebhookCompletionUpdateInput(payment, event),
      );
    } catch (error) {
      if (this.isDuplicateGatewayEventConflict(error)) {
        return this.successAck();
      }

      throw error;
    }

    if (payment.status !== 'completed') {
      this.emitPaymentCompleted({
        paymentId: payment.id,
        userId: payment.user_id,
        payableType: payment.payable_type,
        payableId: payment.payable_id,
        amount: payment.amount.toString(),
        verifiedBy: null,
      });
    }

    return this.successAck();
  }

  private async handlePaymentFailedWebhook(
    event: PaymongoWebhookEvent,
  ): Promise<PaymentWebhookAckDTO> {
    const existingEvent = await this.repo.findPaymentByGatewayEventId(
      event.data.id,
    );

    if (existingEvent) {
      return this.successAck();
    }

    const payment = await this.findWebhookPayment(event);

    if (payment.status === 'completed' || payment.status === 'failed') {
      return this.successAck();
    }

    const failedAt = new Date().toISOString();
    const failureReason =
      this.extractPaymongoFailureReason(event) ??
      'PayMongo reported that this payment failed.';

    try {
      await this.repo.updatePayment(
        payment.id,
        this.toWebhookFailureUpdateInput(payment, event, failureReason),
      );
    } catch (error) {
      if (this.isDuplicateGatewayEventConflict(error)) {
        return this.successAck();
      }

      throw error;
    }

    this.emitPaymentFailed({
      paymentId: payment.id,
      userId: payment.user_id,
      payableType: payment.payable_type,
      payableId: payment.payable_id,
      amount: payment.amount.toString(),
      reason: failureReason,
      failedAt,
    });

    return this.successAck();
  }

  private async resolvePaymentOwnerId(dto: ManualPaymentDTO): Promise<string> {
    if (dto.payable_type === PayableType.subscription) {
      const subscription =
        await this.repo.findSubscriptionPaymentContextOrThrow(dto.payable_id);
      return subscription.user_id;
    }

    if (dto.payable_type === PayableType.booking) {
      const booking = await this.repo.findBookingPaymentContextOrThrow(
        dto.payable_id,
      );
      return booking.user_id;
    }

    if (dto.payable_type === PayableType.coaching) {
      const appointment = await this.repo.findCoachingPaymentContextOrThrow(
        dto.payable_id,
      );
      return appointment.user_id;
    }

    if (dto.payable_type === PayableType.recurring_coaching) {
      const cycle =
        await this.repo.findRecurringCoachingPaymentContextOrThrow(
          dto.payable_id,
        );
      return cycle.user_id;
    }

    throw new HttpException(
      {
        type: 'BUSINESS_RULE_VIOLATION',
        title: 'Unsupported Manual Payment Type',
        status: 422,
        detail: `Manual payments for payable_type "${dto.payable_type}" are not available yet.`,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  private isStaffReviewer(role: UserRole): boolean {
    return role === UserRole.admin || role === UserRole.staff;
  }

  private toManualPaymentCreateInput(
    dto: ManualPaymentDTO,
    paymentOwnerId: string,
  ): Prisma.PaymentCreateInput {
    return {
      user: { connect: { id: paymentOwnerId } },
      payable_type: dto.payable_type,
      payable_id: dto.payable_id,
      payment_stage: dto.payment_stage,
      amount: dto.amount,
      provider: PaymentProvider.cash,
      provider_ref: dto.reference_no,
      idempotency_key: randomUUID(),
      status: 'awaiting_verification',
      screenshot_url: dto.screenshot_url,
    };
  }

  private toVerificationUpdateInput(
    adminId: string,
    dto: VerifyPaymentDTO,
    nextStatus: 'completed' | 'failed',
    verifiedAt: Date,
  ): Prisma.PaymentUpdateInput {
    return {
      status: nextStatus,
      verifier: { connect: { id: adminId } },
      verified_at: verifiedAt,
      rejection_reason: dto.action === 'reject' ? dto.rejection_reason : null,
    };
  }

  private assertRejectionReason(dto: VerifyPaymentDTO): void {
    if (dto.action === 'reject' && !dto.rejection_reason) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Rejection Reason Required',
          status: 422,
          detail: 'rejection_reason is required when action is reject',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private assertAwaitingVerification(payment: Payment): void {
    if (payment.status !== 'awaiting_verification') {
      throw new ForbiddenException({
        type: 'BUSINESS_RULE_VIOLATION',
        title: 'Payment Not Awaiting Verification',
        status: 403,
        detail:
          'Only payments awaiting verification can be approved or rejected.',
      });
    }
  }

  private emitAudit(event: AuditEvent): void {
    this.eventEmitter.emit('audit.log', event);
  }

  private emitPaymentCompleted(event: PaymentCompletedEvent): void {
    this.eventEmitter.emit(PAYMENT_COMPLETED_EVENT, event);
  }

  private emitPaymentFailed(event: PaymentFailedEvent): void {
    this.eventEmitter.emit(PAYMENT_FAILED_EVENT, event);
  }

  private toWebhookCompletionUpdateInput(
    payment: Payment,
    event: PaymongoWebhookEvent,
  ): Prisma.PaymentUpdateInput {
    return {
      status: 'completed',
      verified_at: this.extractWebhookPaidAt(event) ?? new Date(),
      gateway_event_id: event.data.id,
      gateway_metadata: this.toWebhookGatewayMetadata(payment, event),
    };
  }

  private toWebhookFailureUpdateInput(
    payment: Payment,
    event: PaymongoWebhookEvent,
    failureReason: string,
  ): Prisma.PaymentUpdateInput {
    return {
      status: 'failed',
      gateway_event_id: event.data.id,
      gateway_metadata: this.toWebhookGatewayMetadata(payment, event),
      rejection_reason: failureReason,
    };
  }

  private async findWebhookPayment(
    event: PaymongoWebhookEvent,
  ): Promise<Payment> {
    const paymentId = this.extractWebhookMetadataString(event, 'payment_id');

    if (paymentId) {
      return this.repo.findPaymentByIdOrThrow(paymentId);
    }

    return this.repo.findPaymentByProviderRefOrThrow(
      event.data.attributes.data.id,
    );
  }

  private extractPaymongoFailureReason(
    event: PaymongoWebhookEvent,
  ): string | null {
    const attributes = event.data.attributes.data.attributes;

    return (
      attributes.failed_message ??
      attributes.reason ??
      attributes.failure_code ??
      (typeof attributes.status === 'string' ? attributes.status : null)
    );
  }

  private extractWebhookPaidAt(event: PaymongoWebhookEvent): Date | null {
    const attributes = event.data.attributes.data.attributes;
    const paidAt =
      attributes.paid_at ?? attributes.payments?.find(Boolean)?.attributes
        .paid_at;

    if (typeof paidAt !== 'number' || !Number.isFinite(paidAt)) {
      return null;
    }

    return new Date(paidAt * 1000);
  }

  private extractWebhookMetadataString(
    event: PaymongoWebhookEvent,
    key: string,
  ): string | null {
    const value = event.data.attributes.data.attributes.metadata?.[key];
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private toWebhookGatewayMetadata(
    payment: Payment,
    event: PaymongoWebhookEvent,
  ): Prisma.InputJsonValue {
    const existingMetadata = this.asJsonObject(payment.gateway_metadata);
    const gatewayResource = event.data.attributes.data;
    const gatewayAttributes = gatewayResource.attributes;
    const firstPayment = gatewayAttributes.payments?.[0];
    const paymentAttributes =
      gatewayResource.type === 'payment'
        ? gatewayAttributes
        : firstPayment?.attributes;
    const existingCheckoutSession =
      existingMetadata.checkout_session &&
      typeof existingMetadata.checkout_session === 'object' &&
      !Array.isArray(existingMetadata.checkout_session)
        ? existingMetadata.checkout_session
        : null;

    return {
      ...existingMetadata,
      checkout_url:
        gatewayAttributes.checkout_url ??
        (typeof existingMetadata.checkout_url === 'string'
          ? existingMetadata.checkout_url
          : null),
      checkout_session:
        gatewayResource.type === 'checkout_session'
          ? {
              id: gatewayResource.id,
              paid_at: gatewayAttributes.paid_at ?? null,
              payment_method_used: gatewayAttributes.payment_method_used ?? null,
              reference_number: gatewayAttributes.reference_number ?? null,
              status: gatewayAttributes.status ?? null,
            }
          : existingCheckoutSession,
      last_webhook: {
        event_id: event.data.id,
        event_type: event.data.attributes.type,
      },
      payment: paymentAttributes
        ? {
            amount: paymentAttributes.amount ?? null,
            currency: paymentAttributes.currency ?? null,
            external_reference_number:
              paymentAttributes.external_reference_number ?? null,
            id:
              gatewayResource.type === 'payment'
                ? gatewayResource.id
                : (firstPayment?.id ?? null),
            paid_at: paymentAttributes.paid_at ?? null,
            status: paymentAttributes.status ?? null,
          }
        : null,
    } as Prisma.InputJsonValue;
  }

  private asJsonObject(
    value: Prisma.JsonValue | null,
  ): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }

  private isDuplicateGatewayEventConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      String(error.message).includes('gateway_event_id')
    );
  }

  private successAck(): PaymentWebhookAckDTO {
    return { message: 'SUCCESS' };
  }
}
