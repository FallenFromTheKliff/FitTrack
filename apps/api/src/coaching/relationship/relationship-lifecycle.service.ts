import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { Queue } from 'bull';
import { RelationshipStatus } from '@prisma/client';

import { QUEUE_MAIL } from '../../queue/queue.constants';
import { SendGenericMailJobData } from '../../queue/processors/mail.processor';
import { RelationshipRepository } from './relationship.repository';
import {
  RELATIONSHIP_REQUESTED_EVENT,
  type RelationshipRequestedEvent,
} from './events/relationship-requested.event';
import {
  RELATIONSHIP_STATUS_CHANGED_EVENT,
  type RelationshipStatusChangedEvent,
} from './events/relationship-status-changed.event';

type RelationshipNotificationTarget = Awaited<
  ReturnType<
    RelationshipRepository['findRelationshipNotificationContextByIdOrThrow']
  >
>;

@Injectable()
export class RelationshipLifecycleService {
  private readonly logger = new Logger(RelationshipLifecycleService.name);

  constructor(
    private readonly repo: RelationshipRepository,
    @InjectQueue(QUEUE_MAIL) private readonly mailQueue: Queue,
  ) {}

  @OnEvent(RELATIONSHIP_REQUESTED_EVENT, { async: true })
  async handleRelationshipRequested(
    event: RelationshipRequestedEvent,
  ): Promise<void> {
    const relationship =
      await this.repo.findRelationshipNotificationContextByIdOrThrow(
        event.relationshipId,
      );

    await this.queueGenericMail({
      html: this.buildRelationshipRequestedHtml(relationship),
      subject: 'New coaching relationship request',
      to: this.getPreferredEmail(relationship.coach.user),
    });
  }

  @OnEvent(RELATIONSHIP_STATUS_CHANGED_EVENT, { async: true })
  async handleRelationshipStatusChanged(
    event: RelationshipStatusChangedEvent,
  ): Promise<void> {
    const relationship =
      await this.repo.findRelationshipNotificationContextByIdOrThrow(
        event.relationshipId,
      );

    await this.queueGenericMail({
      html: this.buildRelationshipStatusChangedHtml(
        relationship,
        event.previousStatus,
        event.nextStatus,
      ),
      subject: 'Coaching relationship updated',
      to: this.getPreferredEmail(relationship.member),
    });
  }

  private async queueGenericMail(
    data: Omit<SendGenericMailJobData, 'to'> & { to?: string },
  ): Promise<void> {
    if (!data.to) {
      this.logger.warn(
        'Skipped coaching relationship email because no email was found for the recipient.',
      );
      return;
    }

    await this.mailQueue.add('send-generic', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
    });
  }

  private getPreferredEmail(
    user:
      | RelationshipNotificationTarget['coach']['user']
      | RelationshipNotificationTarget['member'],
  ): string | undefined {
    return user?.auth_identities.find((identity) =>
      ['email', 'google'].includes(identity.provider),
    )?.identifier;
  }

  private buildRelationshipRequestedHtml(
    relationship: RelationshipNotificationTarget,
  ): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#1a1a1a">New coaching relationship request</h2>
        <p style="color:#555">
          Hi ${this.getDisplayName(relationship.coach.user)}, ${this.getDisplayName(
            relationship.member,
          )} requested a formal coaching relationship.
        </p>
        ${
          relationship.notes
            ? `<p style="color:#555">Member note: ${relationship.notes}</p>`
            : ''
        }
        <hr style="border:none;border-top:1px solid #eee;margin-top:24px"/>
        <p style="color:#aaa;font-size:12px;text-align:center">FitTrack</p>
      </div>
    `;
  }

  private buildRelationshipStatusChangedHtml(
    relationship: RelationshipNotificationTarget,
    previousStatus: RelationshipStatus,
    nextStatus: RelationshipStatus,
  ): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#1a1a1a">Coaching relationship updated</h2>
        <p style="color:#555">
          Hi ${this.getDisplayName(relationship.member)}, your coaching relationship with
          <strong>${this.getDisplayName(relationship.coach.user)}</strong> moved from
          <strong>${previousStatus}</strong> to <strong>${nextStatus}</strong>.
        </p>
        ${
          relationship.notes
            ? `<p style="color:#555">Coach note: ${relationship.notes}</p>`
            : ''
        }
        <hr style="border:none;border-top:1px solid #eee;margin-top:24px"/>
        <p style="color:#aaa;font-size:12px;text-align:center">FitTrack</p>
      </div>
    `;
  }

  private getDisplayName(
    user:
      | RelationshipNotificationTarget['coach']['user']
      | RelationshipNotificationTarget['member'],
  ): string {
    const firstName = user?.profile?.first_name ?? 'member';
    const lastName = user?.profile?.last_name ?? '';
    return `${firstName} ${lastName}`.trim();
  }
}
