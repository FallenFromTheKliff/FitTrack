import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  MembershipCatalogSettings,
  MembershipPlan,
  PayableType,
  Payment,
  PaymentProvider,
  Prisma,
} from '@prisma/client';
import { isUUID } from 'class-validator';

import { AuditAction, AuditEvent } from '../../audit/audit.service';
import { PaginatedResult } from '../../common/base-repository/base-repository';
import { PaymentRepository } from '../payment/payment.repository';
import {
  CoachingCommerceService,
  CoachingCheckoutResponse,
} from '../../coaching/commerce/coaching-commerce.service';
import { PAYMENT_COMPLETED_EVENT } from '../payment/events/payment-completed.event';
import type { PaymentCompletedEvent } from '../payment/events/payment-completed.event';
import {
  PaymongoCheckoutResult,
  PaymongoCheckoutService,
} from '../payment/paymongo-checkout.service';
import {
  CancelSubscriptionDTO,
  CreatePlanDTO,
  CreateSubscriptionDTO,
  MembershipCatalogSettingsResponseDTO,
  MembershipOperationsDashboardResponseDTO,
  MembershipOperationsDashboardItemDTO,
  PaginationDTO,
  SubscriptionCheckoutResponseDTO,
  UpdateMembershipCatalogSettingsDTO,
  UpdatePlanDTO,
} from './dto/subscription.dto';
import {
  SubscriptionRepository,
  type MembershipOperationsSubscriptionRecord,
} from './subscription.repository';

type SubscriptionWithPlan = Prisma.SubscriptionGetPayload<{
  include: { plan: true };
}>;

const PLAN_DIRECT_UPDATE_FIELDS = [
  'name',
  'description',
  'price',
  'duration_days',
  'sort_order',
  'includes_coaching',
  'is_active',
] as const;

function pickDefined<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Partial<Pick<T, K>> {
  const result: Partial<Pick<T, K>> = {};

  for (const key of keys) {
    const value = source[key];
    if (value !== undefined) {
      result[key] = value as T[K];
    }
  }

  return result;
}

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly repo: SubscriptionRepository,
    private readonly paymentRepo: PaymentRepository,
    private readonly commerceCheckoutService: CoachingCommerceService,
    private readonly paymongoCheckoutService: PaymongoCheckoutService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  listPlans(dto: PaginationDTO): Promise<PaginatedResult<MembershipPlan>> {
    return this.repo.listActivePlans(dto);
  }

  getPlanById(id: string): Promise<MembershipPlan> {
    return this.repo.findActivePlanByIdOrThrow(id);
  }

  async getCatalogSettings(): Promise<MembershipCatalogSettingsResponseDTO> {
    const settings = await this.repo.getCatalogSettings();
    return this.toCatalogSettingsResponse(settings);
  }

  async getOperationsDashboard(): Promise<MembershipOperationsDashboardResponseDTO> {
    const dashboard = await this.repo.getOperationsDashboard();

    return {
      generated_at: dashboard.generatedAt.toISOString(),
      total_active_members_count: dashboard.totalActiveMembersCount,
      recently_activated_count: dashboard.recentlyActivatedCount,
      recently_activated: dashboard.recentlyActivated.map((subscription) =>
        this.toOperationsDashboardItem(subscription),
      ),
      expiring_membership_count: dashboard.expiringMembershipCount,
      expiring_memberships: dashboard.expiringMemberships.map((subscription) =>
        this.toOperationsDashboardItem(subscription),
      ),
    };
  }

  createPlan(dto: CreatePlanDTO): Promise<MembershipPlan> {
    return this.repo.createPlan(this.toCreateInput(dto));
  }

  async updatePlan(id: string, dto: UpdatePlanDTO): Promise<MembershipPlan> {
    return this.repo.updatePlan(id, this.toUpdateInput(dto));
  }

  async deletePlan(id: string): Promise<void> {
    const plan = await this.repo.findPlanByIdOrThrow(id);
    const subscriptionCount = await this.repo.countSubscriptionsByPlanId(id);

    if (subscriptionCount > 0) {
      const recordLabel = subscriptionCount === 1 ? 'record' : 'records';
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Membership Plan Has History',
        status: HttpStatus.CONFLICT,
        detail:
          'Membership plan "' +
          plan.name +
          '" cannot be deleted because it has ' +
          subscriptionCount +
          ' membership ' +
          recordLabel +
          '. Deactivate it instead to preserve membership history.',
      });
    }

    try {
      await this.repo.deletePlan(id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Membership Plan Has History',
          status: HttpStatus.CONFLICT,
          detail:
            'Membership plan "' +
            plan.name +
            '" cannot be deleted because membership history was added during the request. Deactivate it instead to preserve membership history.',
        });
      }

      throw error;
    }
  }

  async updateCatalogSettings(
    dto: UpdateMembershipCatalogSettingsDTO,
  ): Promise<MembershipCatalogSettingsResponseDTO> {
    const settings = await this.repo.updateCatalogSettings(
      new Prisma.Decimal(dto.membership_card_price),
    );
    return this.toCatalogSettingsResponse(settings);
  }

  async subscribe(
    userId: string,
    dto: CreateSubscriptionDTO,
    idempotencyKey: string | undefined,
  ): Promise<CoachingCheckoutResponse> {
    const normalizedIdempotencyKey =
      this.normalizeAndValidateIdempotencyKey(idempotencyKey);
    this.assertSupportedProvider(dto.provider);

    const plan = await this.repo.findActivePlanByIdOrThrow(dto.plan_id);

    return this.commerceCheckoutService.createSubscriptionCheckout({
      amount: plan.price,
      idempotencyKey: normalizedIdempotencyKey,
      planId: plan.id,
      userId,
    });
  }

  getMySubscription(userId: string): Promise<SubscriptionWithPlan | null> {
    return this.repo.findCurrentSubscriptionByUserId(userId);
  }

  hasSubscriptionAccess(userId: string): Promise<boolean> {
    return this.repo.hasSubscriptionAccess(userId);
  }

  hasActivePlanAccess(userId: string): Promise<boolean> {
    return this.repo.hasActivePlanAccess(userId);
  }

  hasCoachingAccess(userId: string): Promise<boolean> {
    return this.repo.hasCoachingAccess(userId);
  }

  async cancelSubscription(
    userId: string,
    dto: CancelSubscriptionDTO,
  ): Promise<void> {
    const subscription =
      await this.repo.findCancellableSubscriptionByUserIdOrThrow(userId);
    const cancelledAt = new Date();

    await this.repo.updateSubscription(subscription.id, {
      status: 'cancelled',
      cancelled_at: cancelledAt,
      cancellation_reason: dto.reason ?? null,
    });

    this.emitAudit({
      userId,
      action: AuditAction.SUBSCRIPTION_CANCELLED,
      entity: 'Subscription',
      entityId: subscription.id,
      before: {
        status: subscription.status,
        cancelled_at: subscription.cancelled_at ?? null,
        cancellation_reason: subscription.cancellation_reason ?? null,
      },
      after: {
        status: 'cancelled',
        cancelled_at: cancelledAt.toISOString(),
        cancellation_reason: dto.reason ?? null,
      },
    });
  }

  @OnEvent(PAYMENT_COMPLETED_EVENT, { async: true })
  async handlePaymentCompleted(event: PaymentCompletedEvent): Promise<void> {
    if (event.payableType !== PayableType.subscription) {
      return;
    }

    const subscription = await this.repo.findSubscriptionByIdOrThrow(
      event.payableId,
    );

    if (
      subscription.status === 'active' &&
      subscription.payment_id === event.paymentId
    ) {
      return;
    }

    if (subscription.status !== 'pending_payment') {
      return;
    }

    const startsAt = new Date();
    const expiresAt = new Date(startsAt);
    expiresAt.setDate(expiresAt.getDate() + subscription.plan.duration_days);

    await this.repo.activateSubscription(
      subscription.id,
      event.paymentId,
      startsAt,
      expiresAt,
    );
  }

  private toCreateInput(dto: CreatePlanDTO): Prisma.MembershipPlanCreateInput {
    return {
      name: dto.name,
      description: dto.description ?? null,
      price: dto.price,
      duration_days: dto.duration_days,
      features: dto.features ? this.toJsonValue(dto.features) : {},
      sort_order: dto.sort_order ?? 0,
      includes_coaching: dto.includes_coaching ?? false,
    };
  }

  private toUpdateInput(dto: UpdatePlanDTO): Prisma.MembershipPlanUpdateInput {
    return {
      ...pickDefined(dto, PLAN_DIRECT_UPDATE_FIELDS),
      ...(dto.features !== undefined
        ? { features: this.toJsonValue(dto.features) }
        : {}),
    };
  }

  private toJsonValue(value: Record<string, unknown>): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  private toOperationsDashboardItem(
    subscription: MembershipOperationsSubscriptionRecord,
  ): MembershipOperationsDashboardItemDTO {
    return {
      id: subscription.id,
      user_id: subscription.user_id,
      member_name: this.formatUserName(subscription.user.profile),
      plan_name: subscription.plan.name,
      status: subscription.status,
      starts_at: subscription.starts_at?.toISOString() ?? null,
      expires_at: subscription.expires_at?.toISOString() ?? null,
    };
  }

  private toCatalogSettingsResponse(
    settings: MembershipCatalogSettings,
  ): MembershipCatalogSettingsResponseDTO {
    return {
      membership_card_price: settings.membership_card_price.toString(),
      updated_at: settings.updated_at.toISOString(),
    };
  }

  private formatUserName(
    profile: { first_name: string; last_name: string } | null,
  ): string {
    const firstName = profile?.first_name.trim() ?? '';
    const lastName = profile?.last_name.trim() ?? '';
    return [firstName, lastName].filter(Boolean).join(' ') || 'FitTrack member';
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

  private assertSupportedProvider(provider: PaymentProvider): void {
    if (provider !== PaymentProvider.paymongo) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Unsupported Subscription Provider',
          status: 422,
          detail:
            'Only PayMongo checkout is supported for subscription initiation.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private async resumeExistingCheckout(
    payment: Payment,
    userId: string,
  ): Promise<SubscriptionCheckoutResponseDTO> {
    if (payment.user_id !== userId || payment.payable_type !== 'subscription') {
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

    const subscription = await this.repo.findSubscriptionByIdOrThrow(
      payment.payable_id,
    );

    if (subscription.user_id !== userId) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Subscription Ownership Conflict',
        status: 409,
        detail:
          'This Idempotency-Key is already associated with another members subscription.',
      });
    }

    const checkoutUrl = this.extractCheckoutUrl(payment.gateway_metadata);

    if (checkoutUrl) {
      return { checkout_url: checkoutUrl };
    }

    if (payment.status === 'failed') {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Payment Attempt Already Failed',
        status: 409,
        detail:
          'This Idempotency-Key belongs to a failed payment attempt. Start a new attempt with a new key.',
      });
    }

    return this.startCheckoutForPayment(payment, subscription.plan.name);
  }

  private async startCheckoutForPayment(
    payment: Payment,
    description: string,
  ): Promise<SubscriptionCheckoutResponseDTO> {
    const checkout = await this.paymongoCheckoutService.createCheckoutSession({
      amount: this.toMinorAmount(payment.amount),
      description,
      idempotencyKey: payment.idempotency_key,
      metadata: {
        payment_id: payment.id,
        subscription_id: payment.payable_id,
      },
    });

    await this.paymentRepo.updatePayment(
      payment.id,
      this.toCheckoutUpdateInput(checkout),
    );

    return { checkout_url: checkout.checkoutUrl };
  }

  private toMinorAmount(amount: Prisma.Decimal | number): number {
    return Math.round(Number(amount) * 100);
  }

  private toCheckoutUpdateInput(
    checkout: PaymongoCheckoutResult,
  ): Prisma.PaymentUpdateInput {
    return {
      status: 'processing',
      provider_ref: checkout.providerRef,
      gateway_metadata: checkout.gatewayMetadata as Prisma.InputJsonValue,
    };
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

  private emitAudit(event: AuditEvent): void {
    this.eventEmitter.emit('audit.log', event);
  }
}
