import { RelationshipStatus } from '@prisma/client';

export const RELATIONSHIP_STATUS_CHANGED_EVENT =
  'coaching.relationship.status-changed';

export interface RelationshipStatusChangedEvent {
  relationshipId: string;
  coachId: string;
  memberId: string;
  previousStatus: RelationshipStatus;
  nextStatus: RelationshipStatus;
}
