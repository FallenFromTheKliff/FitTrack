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
  FreeDayPassEligibilityResponseDTO,
  FreeDayPassLifecycleResponseDTO,
  GrantFreeDayPassDTO,
  MembershipAccessCandidateResponseDTO,
  MembershipAccessCandidatesQueryDTO,
  MembershipCatalogSettingsResponseDTO,
  MembershipOperationsDashboardResponseDTO,
  MembershipOperationsDashboardItemDTO,
  MembershipPlanResponseDTO,
  OnsiteMembershipCandidateFilterDTO,
  OnsiteMembershipCandidateResponseDTO,
  PaginationDTO,
  RecordCashMembershipDTO,
  RecordCashMembershipResponseDTO,
  RevokeMembershipSubscriptionDTO,
  RevokeMembershipSubscriptionResponseDTO,
  RevokeFreeDayPassDTO,
  SubscriptionCheckoutResponseDTO,
  UpdateMembershipCatalogSettingsDTO,
  UpdatePlanDTO,
} from './dto/subscription.dto';
import { MembershipCardResponseDTO } from '../card/dto/card.dto';
import { PaymentResponseDTO } from '../payment/dto/payment.dto';
import {
  SubscriptionRepository,
  type FreeDayPassLifecycleRecord,
  type MembershipAccessCandidateRecord,
  type OnsiteMembershipCandidateRecord,
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

  async listPlans(
    dto: PaginationDTO,
  ): Promise<PaginatedResult<MembershipPlanResponseDTO>> {
    const result = await this.repo.listActivePlans(dto);
    return {
      ...result,
      data: result.data.map((plan) => this.toPlanResponse(plan)),
    };
  }

  async listManagementPlans(
    dto: PaginationDTO,
  ): Promise<PaginatedResult<MembershipPlanResponseDTO>> {
    const result = await this.repo.listManagementPlans(dto);
    return {
      ...result,
      data: result.data.map((plan) => this.toPlanResponse(plan)),
    };
  }

  async listOnsiteSaleCandidates(
    dto: OnsiteMembershipCandidateFilterDTO,
  ): Promise<OnsiteMembershipCandidateResponseDTO[]> {
    const candidates = await this.repo.listOnsiteSaleCandidates({
      action: dto.action,
      purchaseType: dto.purchase_type,
      search: dto.search,
    });

    return candidates.map((candidate) => this.toOnsiteCandidateResponse(candidate));
  }

  async listMembershipAccessCandidates(
    dto: MembershipAccessCandidatesQueryDTO,
  ): Promise<MembershipAccessCandidateResponseDTO[]> {
    const candidates = await this.repo.listMembershipAccessCandidates({
      action: dto.action,
      product: dto.product,
      search: dto.search,
    });

    return candidates.map((candidate) =>
      this.toMembershipAccessCandidateResponse(candidate),
    );
  }

  async grantFreeDayPass(
    actorId: string,
    dto: GrantFreeDayPassDTO,
  ): Promise<FreeDayPassLifecycleResponseDTO> {
    const result = await this.repo.grantFreeDayPass(dto.member_id, actorId);
    this.emitFreeDayPassAudit(actorId, 'granted', result);
    return {
      message: 'Free one-day pass granted.',
      ...this.toFreeDayPassLifecycleResponse(result.user),
    };
  }

  async revokeFreeDayPass(
    actorId: string,
    memberId: string,
    dto: RevokeFreeDayPassDTO,
  ): Promise<FreeDayPassLifecycleResponseDTO> {
    const result = await this.repo.revokeFreeDayPass(
      memberId,
      dto.reason.trim(),
    );
    this.emitFreeDayPassAudit(actorId, 'revoked', result);
    return {
      message: 'Free one-day pass revoked.',
      ...this.toFreeDayPassLifecycleResponse(result.user),
    };
  }

  async getPlanById(id: string): Promise<MembershipPlanResponseDTO> {
    return this.toPlanResponse(await this.repo.findActivePlanByIdOrThrow(id));
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

  async createPlan(dto: CreatePlanDTO): Promise<MembershipPlanResponseDTO> {
    return this.toPlanResponse(
      await this.repo.createPlan(this.toCreateInput(dto)),
    );
  }

  async updatePlan(
    id: string,
    dto: UpdatePlanDTO,
  ): Promise<MembershipPlanResponseDTO> {
    return this.toPlanResponse(
      await this.repo.updatePlan(id, this.toUpdateInput(dto)),
    );
  }

  async deletePlan(id: string): Promise<void> {
    const plan = await this.repo.findPlanByIdOrThrow(id);
    const historyCount = await this.repo.countPlanHistory(id);

    if (historyCount > 0) {
      const recordLabel = historyCount === 1 ? 'record' : 'records';
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Membership Plan Has History',
        status: HttpStatus.CONFLICT,
        detail:
          'Membership plan "' +
          plan.name +
          '" cannot be deleted because it has ' +
          historyCount +
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
      returnTarget: dto.return_target,
      returnUrl: dto.return_url,
      idempotencyKey: normalizedIdempotencyKey,
      planId: plan.id,
      planCurrency: plan.currency,
      planDescription: plan.description,
      planDurationDays: plan.duration_days,
      planName: plan.name,
      userId,
    });
  }

  async getMySubscription(userId: string): Promise<SubscriptionWithPlan | null> {
    const subscription = await this.repo.findCurrentSubscriptionByUserId(userId);
    return subscription ? this.toSnapshotSubscription(subscription) : null;
  }

  async getFreeDayPassEligibility(
    userId: string,
  ): Promise<FreeDayPassEligibilityResponseDTO> {
    const result = await this.repo.getFreeDayPassEligibility(userId);
    return {
      eligible: result.eligible,
      granted_at: result.grantedAt?.toISOString() ?? null,
      expires_at: result.expiresAt?.toISOString() ?? null,
      redeemed_at: result.redeemedAt?.toISOString() ?? null,
      revoked_at: result.revokedAt?.toISOString() ?? null,
      reason: result.reason,
    };
  }

  async recordCashMembership(
    actorId: string,
    dto: RecordCashMembershipDTO,
    idempotencyKey: string | undefined,
  ): Promise<RecordCashMembershipResponseDTO> {
    const normalizedIdempotencyKey =
      this.normalizeAndValidateIdempotencyKey(idempotencyKey);
    const sale = await this.repo.recordCashMembership({
      actorId,
      idempotencyKey: normalizedIdempotencyKey,
      memberId: dto.member_id,
      planId: dto.plan_id,
      purchaseType: dto.purchase_type,
    });

    const subscription = sale.subscription
      ? this.toSnapshotSubscription(sale.subscription)
      : null;
    if (!sale.replayed) {
      this.eventEmitter.emit(PAYMENT_COMPLETED_EVENT, {
        amount: sale.payment.amount.toString(),
        membershipCardActivationCommitted: sale.membershipCard !== null,
        payableId: sale.payment.payable_id,
        payableType: sale.payment.payable_type,
        paymentId: sale.payment.id,
        userId: sale.payment.user_id,
        verifiedBy: actorId,
      });
      this.emitAudit({
        userId: actorId,
        action: AuditAction.PAYMENT_VERIFIED,
        entity: 'Payment',
        entityId: sale.payment.id,
        before: { status: 'pending' },
        after: {
          status: sale.payment.status,
          payable_type: sale.payment.payable_type,
          payable_id: sale.payment.payable_id,
          provider: sale.payment.provider,
        },
      });
    }

    return {
      payment: this.toPaymentResponse(
        sale.payment,
        dto.purchase_type,
        subscription?.plan.name ?? null,
      ),
      membership_card: sale.membershipCard
        ? this.toMembershipCardResponse(sale.membershipCard)
        : null,
      subscription: subscription
        ? this.toCurrentSubscriptionResponse(subscription)
        : null,
      can_check_in_now:
        dto.purchase_type === 'gym_membership' &&
        Boolean(subscription?.starts_at && subscription?.expires_at),
    };
  }

  async revokeMembershipSubscription(
    actorId: string,
    subscriptionId: string,
    dto: RevokeMembershipSubscriptionDTO,
  ): Promise<RevokeMembershipSubscriptionResponseDTO> {
    const reason = dto.reason?.trim() || null;
    const revokedAt = new Date();
    const result = await this.repo.revokeMembershipSubscription(
      subscriptionId,
      reason,
      revokedAt,
    );
    const before = result.before;
    const subscription = this.toSnapshotSubscription(result.subscription);

    this.emitAudit({
      userId: actorId,
      action: AuditAction.SUBSCRIPTION_SUSPENDED,
      entity: 'Subscription',
      entityId: result.subscription.id,
      before: {
        status: before.status,
        user_id: before.user_id,
        plan_id: before.plan_id,
        starts_at: before.starts_at?.toISOString() ?? null,
        expires_at: before.expires_at?.toISOString() ?? null,
        cancelled_at: before.cancelled_at?.toISOString() ?? null,
        cancellation_reason: before.cancellation_reason,
      },
      after: {
        status: result.subscription.status,
        user_id: result.subscription.user_id,
        plan_id: result.subscription.plan_id,
        starts_at: result.subscription.starts_at?.toISOString() ?? null,
        expires_at: result.subscription.expires_at?.toISOString() ?? null,
        cancelled_at: result.subscription.cancelled_at?.toISOString() ?? null,
        cancellation_reason: result.subscription.cancellation_reason,
      },
    });

    return {
      message: 'Gym membership access revoked.',
      subscription: this.toCurrentSubscriptionResponse(subscription),
    };
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
    expiresAt.setDate(
      expiresAt.getDate() +
        (subscription.duration_days_snapshot ?? subscription.plan.duration_days),
    );

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
      includes_coaching: false,
    };
  }

  private toOnsiteCandidateResponse(
    candidate: OnsiteMembershipCandidateRecord,
  ): OnsiteMembershipCandidateResponseDTO {
    return {
      member_id: candidate.id,
      display_name: candidate.displayName,
      email: candidate.email,
      membership_card_status: candidate.membershipCardStatus,
      subscription_id: candidate.subscription?.id ?? null,
      subscription_status: candidate.subscription?.status ?? null,
      plan_name: candidate.subscription?.planName ?? null,
      starts_at: candidate.subscription?.startsAt?.toISOString() ?? null,
      expires_at: candidate.subscription?.expiresAt?.toISOString() ?? null,
    };
  }

  private toMembershipAccessCandidateResponse(
    candidate: MembershipAccessCandidateRecord,
  ): MembershipAccessCandidateResponseDTO {
    return {
      member_id: candidate.memberId,
      display_name: candidate.displayName,
      email: candidate.email,
      membership_card_status: candidate.membershipCardStatus,
      subscription_id: candidate.subscription?.id ?? null,
      subscription_status: candidate.subscription?.status ?? null,
      plan_name: candidate.subscription?.planName ?? null,
      starts_at: candidate.subscription?.startsAt?.toISOString() ?? null,
      expires_at: candidate.subscription?.expiresAt?.toISOString() ?? null,
      free_pass_expires_at: candidate.freePassExpiresAt?.toISOString() ?? null,
    };
  }

  private toFreeDayPassLifecycleResponse(
    user: FreeDayPassLifecycleRecord['user'],
  ): Omit<FreeDayPassLifecycleResponseDTO, 'message'> {
    return {
      member_id: user.id,
      granted_at: user.free_day_pass_granted_at?.toISOString() ?? null,
      expires_at: user.free_day_pass_expires_at?.toISOString() ?? null,
      redeemed_at: user.free_day_pass_redeemed_at?.toISOString() ?? null,
      revoked_at: user.free_day_pass_revoked_at?.toISOString() ?? null,
      revoke_reason: user.free_day_pass_revoke_reason,
    };
  }

  private emitFreeDayPassAudit(
    actorId: string,
    operation: 'granted' | 'revoked',
    result: FreeDayPassLifecycleRecord,
  ): void {
    const snapshot = (user: FreeDayPassLifecycleRecord['user']) => ({
      id: user.id,
      granted_at: user.free_day_pass_granted_at?.toISOString() ?? null,
      expires_at: user.free_day_pass_expires_at?.toISOString() ?? null,
      granted_by: user.free_day_pass_granted_by,
      redeemed_at: user.free_day_pass_redeemed_at?.toISOString() ?? null,
      revoked_at: user.free_day_pass_revoked_at?.toISOString() ?? null,
      revoke_reason: user.free_day_pass_revoke_reason,
    });
    this.emitAudit({
      userId: actorId,
      action:
        operation === 'granted'
          ? AuditAction.FREE_DAY_PASS_GRANTED
          : AuditAction.FREE_DAY_PASS_REVOKED,
      entity: 'User',
      entityId: result.user.id,
      before: snapshot(result.before),
      after: snapshot(result.user),
    });
  }

  private toPlanResponse(plan: MembershipPlan): MembershipPlanResponseDTO {
    return {
      id: plan.id,
      name: plan.name,
      description: plan.description ?? null,
      price:
        plan.price && typeof plan.price.toString === 'function'
          ? plan.price.toString()
          : String(plan.price ?? ''),
      currency: plan.currency ?? 'PHP',
      duration_days: plan.duration_days,
      features: (plan.features ?? {}) as Record<string, unknown>,
      sort_order: plan.sort_order,
      is_active: plan.is_active,
      created_at:
        plan.created_at instanceof Date
          ? plan.created_at.toISOString()
          : String(plan.created_at ?? ''),
      updated_at:
        plan.updated_at instanceof Date
          ? plan.updated_at.toISOString()
          : String(plan.updated_at ?? ''),
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
      plan_name: subscription.plan_name_snapshot ?? subscription.plan.name,
      status: subscription.status,
      starts_at: subscription.starts_at?.toISOString() ?? null,
      expires_at: subscription.expires_at?.toISOString() ?? null,
    };
  }

  private toSnapshotSubscription(
    subscription: SubscriptionWithPlan,
  ): SubscriptionWithPlan {
    const plan = subscription.plan;
    return {
      ...subscription,
      plan: {
        ...plan,
        name: subscription.plan_name_snapshot ?? plan.name,
        description:
          subscription.plan_description_snapshot ?? plan.description,
        price: subscription.plan_price_snapshot ?? plan.price,
        currency: subscription.plan_currency_snapshot ?? plan.currency,
        duration_days:
          subscription.duration_days_snapshot ?? plan.duration_days,
      },
    };
  }

  private toPaymentResponse(
    payment: Payment,
    purchaseType: 'membership_card' | 'gym_membership',
    planName: string | null,
  ): PaymentResponseDTO {
    return {
      id: payment.id,
      user_id: payment.user_id,
      payable_type: payment.payable_type,
      payable_id: payment.payable_id,
      payment_stage: payment.payment_stage,
      amount: payment.amount.toString(),
      currency: payment.currency,
      provider: payment.provider,
      provider_ref: payment.provider_ref,
      gateway_event_id: payment.gateway_event_id,
      idempotency_key: payment.idempotency_key,
      status: payment.status,
      gateway_metadata: payment.gateway_metadata as Record<string, unknown> | null,
      screenshot_url: payment.screenshot_url,
      rejection_reason: payment.rejection_reason,
      verified_by: payment.verified_by,
      verified_at: payment.verified_at?.toISOString() ?? null,
      created_at: payment.created_at.toISOString(),
      updated_at: payment.updated_at.toISOString(),
      membership_kind: purchaseType,
      membership_item_name:
        purchaseType === 'membership_card' ? 'Membership Card' : planName,
      membership_plan_name: purchaseType === 'gym_membership' ? planName : null,
    };
  }

  private toMembershipCardResponse(
    card: NonNullable<Awaited<ReturnType<SubscriptionRepository['recordCashMembership']>>['membershipCard']>,
  ): MembershipCardResponseDTO {
    return {
      status: card.status,
      source: card.source,
      purchased_at: card.purchased_at?.toISOString() ?? null,
      verified_at: card.verified_at?.toISOString() ?? null,
      activated_at: card.activated_at?.toISOString() ?? null,
      revoked_at: card.revoked_at?.toISOString() ?? null,
      revoke_reason: card.revoke_reason,
      updated_at: card.updated_at?.toISOString() ?? null,
    };
  }

  private toCurrentSubscriptionResponse(
    subscription: SubscriptionWithPlan,
  ) {
    const snapshot = this.toSnapshotSubscription(subscription);
    const plan = snapshot.plan;
    return {
      id: snapshot.id,
      user_id: snapshot.user_id,
      plan_id: snapshot.plan_id,
      payment_id: snapshot.payment_id,
      status: snapshot.status,
      starts_at: snapshot.starts_at?.toISOString() ?? null,
      expires_at: snapshot.expires_at?.toISOString() ?? null,
      warned_7d_at: snapshot.warned_7d_at?.toISOString() ?? null,
      warned_3d_at: snapshot.warned_3d_at?.toISOString() ?? null,
      warned_1d_at: snapshot.warned_1d_at?.toISOString() ?? null,
      cancelled_at: snapshot.cancelled_at?.toISOString() ?? null,
      cancellation_reason: snapshot.cancellation_reason,
      created_at: snapshot.created_at.toISOString(),
      updated_at: snapshot.updated_at.toISOString(),
      plan: {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price: plan.price.toString(),
        currency: plan.currency,
        duration_days: plan.duration_days,
        features: (plan.features ?? {}) as Record<string, unknown>,
        sort_order: plan.sort_order,
        is_active: plan.is_active,
        created_at: plan.created_at.toISOString(),
        updated_at: plan.updated_at.toISOString(),
      },
      plan_name_snapshot: snapshot.plan_name_snapshot,
      plan_description_snapshot: snapshot.plan_description_snapshot,
      plan_price_snapshot: snapshot.plan_price_snapshot?.toString() ?? null,
      plan_currency_snapshot: snapshot.plan_currency_snapshot,
      duration_days_snapshot: snapshot.duration_days_snapshot,
      access_consumed_at: snapshot.access_consumed_at?.toISOString() ?? null,
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

    return this.startCheckoutForPayment(
      payment,
      subscription.plan_name_snapshot ?? subscription.plan.name,
    );
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
