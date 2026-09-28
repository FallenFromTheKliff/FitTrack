import { getQueueToken } from '@nestjs/bull';
import { Test, TestingModule } from '@nestjs/testing';
import { RelationshipStatus } from '@prisma/client';

import { QUEUE_MAIL } from '../../queue/queue.constants';
import { RelationshipRepository } from './relationship.repository';
import { RelationshipRequestedEvent } from './events/relationship-requested.event';
import { RelationshipStatusChangedEvent } from './events/relationship-status-changed.event';
import { RelationshipLifecycleService } from './relationship-lifecycle.service';

describe('RelationshipLifecycleService', () => {
  let service: RelationshipLifecycleService;

  const repo = {
    findRelationshipNotificationContextByIdOrThrow: jest.fn(),
  };

  const mailQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelationshipLifecycleService,
        { provide: RelationshipRepository, useValue: repo },
        { provide: getQueueToken(QUEUE_MAIL), useValue: mailQueue },
      ],
    }).compile();

    service = module.get<RelationshipLifecycleService>(
      RelationshipLifecycleService,
    );
    jest.clearAllMocks();
  });

  it('queues an email to the coach when a relationship is requested', async () => {
    repo.findRelationshipNotificationContextByIdOrThrow.mockResolvedValue(
      createRelationshipNotificationContext(),
    );

    await service.handleRelationshipRequested(
      createRelationshipRequestedEvent(),
    );

    expect(mailQueue.add).toHaveBeenCalledWith(
      'send-generic',
      expect.objectContaining({
        subject: 'New coaching relationship request',
        to: 'coach@example.com',
      }),
      expect.anything(),
    );
  });

  it('queues an email to the member when a relationship status changes', async () => {
    repo.findRelationshipNotificationContextByIdOrThrow.mockResolvedValue(
      createRelationshipNotificationContext(),
    );

    await service.handleRelationshipStatusChanged(
      createRelationshipStatusChangedEvent(),
    );

    expect(mailQueue.add).toHaveBeenCalledWith(
      'send-generic',
      expect.objectContaining({
        subject: 'Coaching relationship updated',
        to: 'member@example.com',
      }),
      expect.anything(),
    );
  });
});

function createRelationshipNotificationContext() {
  return {
    id: 'rel-1',
    notes: 'Looking for weekly coaching.',
    coach: {
      user: {
        auth_identities: [
          { identifier: 'coach@example.com', provider: 'email' },
        ],
        profile: {
          first_name: 'Maria',
          last_name: 'Santos',
        },
      },
    },
    member: {
      auth_identities: [
        { identifier: 'member@example.com', provider: 'email' },
      ],
      profile: {
        first_name: 'Jamie',
        last_name: 'Rivera',
      },
    },
  };
}

function createRelationshipRequestedEvent(
  overrides: Partial<RelationshipRequestedEvent> = {},
): RelationshipRequestedEvent {
  return {
    relationshipId: 'rel-1',
    coachId: 'coach-1',
    memberId: 'member-1',
    ...overrides,
  };
}

function createRelationshipStatusChangedEvent(
  overrides: Partial<RelationshipStatusChangedEvent> = {},
): RelationshipStatusChangedEvent {
  return {
    relationshipId: 'rel-1',
    coachId: 'coach-1',
    memberId: 'member-1',
    previousStatus: RelationshipStatus.pending,
    nextStatus: RelationshipStatus.active,
    ...overrides,
  };
}
