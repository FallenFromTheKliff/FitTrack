import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationType, UserRole, type ChatContext } from '@prisma/client';

import {
  AI_SESSION_ARCHIVED_EVENT,
  type AiSessionArchivedEvent,
} from '../ai/events/ai-session-archived.event';
import {
  USER_REGISTERED_EVENT,
  type UserRegisteredEvent,
} from '../auth/events/user-registered.event';
import {
  PAYMENT_FAILED_EVENT,
  type PaymentFailedEvent,
} from '../membership/payment/events/payment-failed.event';
import {
  TDEE_RECALCULATED_EVENT,
  type TdeeRecalculatedEvent,
} from '../nutrition/events/tdee-recalculated.event';
import {
  ACCOUNT_ACTIVITY_EVENT,
  type AccountActivityEvent,
} from '../user/events/account-activity.event';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationDomainEventsListener {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationsRepository: NotificationsRepository,
  ) {}

  @OnEvent(USER_REGISTERED_EVENT, { async: true })
  async handleUserRegistered(event: UserRegisteredEvent): Promise<void> {
    const body = this.buildRegistrationBody(event.role, event.source);

    await this.notificationsService.dispatch(
      event.userId,
      NotificationType.system,
      {
        title: 'Welcome to FitTrack',
        body,
        data: {
          kind: 'user_registered',
          role: event.role,
          source: event.source,
          registered_at: event.registeredAt,
        },
        email: {
          subject: 'Welcome to FitTrack',
          html: this.wrapEmailHtml('Welcome to FitTrack', body),
        },
      },
    );
  }

  @OnEvent(TDEE_RECALCULATED_EVENT, { async: true })
  async handleTdeeRecalculated(event: TdeeRecalculatedEvent): Promise<void> {
    const body =
      'Your nutrition targets were recalculated. Review your latest calorie and macro recommendations in FitTrack.';

    await this.notificationsService.dispatch(
      event.userId,
      NotificationType.system,
      {
        title: 'Nutrition targets updated',
        body,
        data: {
          kind: 'tdee_recalculated',
          tdee_profile_id: event.tdeeProfileId,
          macro_target_id: event.macroTargetId,
          recalculated_at: event.recalculatedAt,
        },
        email: {
          subject: 'Nutrition targets updated',
          html: this.wrapEmailHtml('Nutrition targets updated', body),
        },
      },
    );
  }

  @OnEvent(AI_SESSION_ARCHIVED_EVENT, { async: true })
  async handleAiSessionArchived(event: AiSessionArchivedEvent): Promise<void> {
    const contextLabel = this.formatChatContext(event.contextType);
    const body = `Your ${contextLabel} AI chat session was archived after inactivity. Start a new session any time when you are ready to continue.`;

    await this.notificationsService.dispatch(
      event.userId,
      NotificationType.ai_session_archived,
      {
        title: 'AI chat session archived',
        body,
        data: {
          kind: 'ai_session_archived',
          session_id: event.sessionId,
          context_type: event.contextType,
          archived_at: event.archivedAt,
        },
        email: {
          subject: 'AI chat session archived',
          html: this.wrapEmailHtml('AI chat session archived', body),
        },
      },
    );
  }

  @OnEvent(PAYMENT_FAILED_EVENT, { async: true })
  async handlePaymentFailed(event: PaymentFailedEvent): Promise<void> {
    const reason = event.reason ? ` Reason: ${event.reason}` : '';
    const payableLabel = event.payableType.replace(/_/g, ' ');
    const body = `A payment for your ${payableLabel} could not be completed.${reason}`;

    await this.notificationsService.dispatch(
      event.userId,
      NotificationType.payment_failed,
      {
        title: 'Payment failed',
        body,
        data: {
          kind: 'payment_failed',
          payment_id: event.paymentId,
          payable_type: event.payableType,
          payable_id: event.payableId,
          amount: event.amount,
          reason: event.reason,
          failed_at: event.failedAt,
        },
        email: {
          subject: 'Payment failed',
          html: this.wrapEmailHtml('Payment failed', body),
        },
      },
    );
  }

  @OnEvent(ACCOUNT_ACTIVITY_EVENT, { async: true })
  async handleAccountActivity(event: AccountActivityEvent): Promise<void> {
    const recipients =
      await this.notificationsRepository.listManagementNotificationRecipients();
    const body = this.buildAccountActivityBody(event);
    const title = this.buildAccountActivityTitle(event);

    await Promise.all(
      recipients.map((recipient) =>
        this.notificationsService.dispatch(
          recipient.user_id,
          NotificationType.system,
          {
            title,
            body,
            data: {
              kind: 'account_activity',
              action: event.action,
              actor_id: event.actorId,
              target_user_id: event.targetUserId,
              target_email: event.targetEmail ?? null,
              target_name: event.targetName ?? null,
              target_role: event.targetRole ?? null,
              occurred_at: event.occurredAt,
              ...(event.details ?? {}),
            },
          },
        ),
      ),
    );
  }

  private buildRegistrationBody(
    role: UserRole,
    source: UserRegisteredEvent['source'],
  ): string {
    if (source === 'admin_create') {
      return `Your ${role} account is ready. Sign in to FitTrack to review your profile and get started.`;
    }

    return 'Your account is ready. Sign in to FitTrack to review your profile and get started.';
  }

  private formatChatContext(contextType: ChatContext): string {
    switch (contextType) {
      case 'nutrition':
        return 'nutrition';
      case 'training_plan':
        return 'training plan';
      case 'tdee_adjustment':
        return 'TDEE adjustment';
      default:
        return 'general';
    }
  }

  private buildAccountActivityTitle(event: AccountActivityEvent): string {
    const target = this.formatAccountTarget(event);

    switch (event.action) {
      case 'account_created':
        return `Account created: ${target}`;
      case 'account_updated':
        return `Account updated: ${target}`;
      case 'account_verified_non_member':
        return `Account verified: ${target}`;
      case 'account_archived':
        return `Account archived: ${target}`;
      case 'account_restored':
        return `Account restored: ${target}`;
      case 'coach_upgraded':
        return `Coach access granted: ${target}`;
      case 'attendance_check_in':
        return `Attendance check-in: ${target}`;
      case 'membership_card_granted':
        return `Member card granted: ${target}`;
      case 'membership_card_revoked':
        return `Member card revoked: ${target}`;
      case 'membership_card_removed':
        return `Membership removed: ${target}`;
      case 'payment_approved':
        return `Payment approved: ${target}`;
      case 'termination_approved':
        return `Termination approved: ${target}`;
      case 'termination_rejected':
        return `Termination denied: ${target}`;
      default:
        return `Account activity: ${target}`;
    }
  }

  private buildAccountActivityBody(event: AccountActivityEvent): string {
    const target = this.formatAccountTarget(event);
    const role = event.targetRole ? ` (${event.targetRole})` : '';

    switch (event.action) {
      case 'account_created':
        return `${target}${role} was created from the Account Module.`;
      case 'account_updated':
        return `${target}${role} had profile details updated from the Account Module.`;
      case 'account_verified_non_member':
        return `${target}${role} was manually verified from the Account Module.`;
      case 'account_archived':
        return `${target}${role} was archived and moved out of the active account directory.`;
      case 'account_restored':
        return `${target}${role} was restored to the active account directory.`;
      case 'coach_upgraded':
        return `${target}${role} was upgraded to a coach account.`;
      case 'attendance_check_in':
        return `${target}${role} was manually checked in from the Account Module.`;
      case 'membership_card_granted':
        return `${target}${role} received active membership-card access.`;
      case 'membership_card_revoked':
        return `${target}${role} had membership-card access revoked.`;
      case 'membership_card_removed':
        return `${target}${role} had membership-card access removed and is now a non-member.`;
      case 'payment_approved':
        return `${target}${role} had a payment approved from the payments review flow.`;
      case 'termination_approved':
        return `${target}${role} had a termination request approved and was soft-deleted.`;
      case 'termination_rejected':
        return `${target}${role} had a termination request denied and remains active.`;
      default:
        return `${target}${role} changed in the Account Module.`;
    }
  }

  private formatAccountTarget(event: AccountActivityEvent): string {
    return (
      event.targetName?.trim() ||
      event.targetEmail?.trim() ||
      event.targetUserId
    );
  }

  private wrapEmailHtml(title: string, body: string): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#1a1a1a">${title}</h2>
        <p style="color:#555">${body}</p>
        <hr style="border:none;border-top:1px solid #eee;margin-top:24px"/>
        <p style="color:#aaa;font-size:12px;text-align:center">FitTrack</p>
      </div>
    `;
  }
}
