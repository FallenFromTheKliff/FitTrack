export const RELATIONSHIP_REQUESTED_EVENT = 'coaching.relationship.requested';

export interface RelationshipRequestedEvent {
  relationshipId: string;
  coachId: string;
  memberId: string;
}
