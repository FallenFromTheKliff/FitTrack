import type { UserRole } from '@prisma/client';

export const ACCOUNT_ACTIVITY_EVENT = 'account.activity';

export type AccountActivityAction =
  | 'account_created'
  | 'account_updated'
  | 'account_archived'
  | 'account_restored'
  | 'coach_upgraded'
  | 'attendance_check_in'
  | 'membership_card_granted'
  | 'membership_card_revoked'
  | 'termination_approved'
  | 'termination_rejected';

export type AccountActivityEvent = {
  action: AccountActivityAction;
  actorId: string;
  details?: Record<string, boolean | number | string | null>;
  occurredAt: string;
  targetEmail?: string | null;
  targetRole?: UserRole | string | null;
  targetUserId: string;
};
