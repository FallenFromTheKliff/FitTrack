export const TDEE_RECALCULATED_EVENT = 'nutrition.tdee-recalculated';

export interface TdeeRecalculatedEvent {
  userId: string;
  tdeeProfileId: string;
  macroTargetId: string;
  recalculatedAt: string;
}
