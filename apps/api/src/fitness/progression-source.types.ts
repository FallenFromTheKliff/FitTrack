export const progressionSourceEventType = 'progression_source_recorded';

export type ProgressionSourceEventType = typeof progressionSourceEventType;

export const progressionSourceValidationStates = [
  'validated',
  'flagged',
  'invalidated',
] as const;

export type ProgressionSourceValidationState =
  (typeof progressionSourceValidationStates)[number];

export const progressionSourceTerminalStates = [
  'accepted',
  'flagged',
  'rejected',
  'invalidated',
] as const;

export type ProgressionSourceTerminalState =
  (typeof progressionSourceTerminalStates)[number];

export const progressionSourceEligibilityStates = [
  'eligible',
  'blocked',
  'review_required',
] as const;

export type ProgressionSourceEligibilityState =
  (typeof progressionSourceEligibilityStates)[number];

export const progressionSourceIntegrityStates = [
  'clean',
  'suspicious',
  'corrected',
  'voided',
] as const;

export type ProgressionSourceIntegrityState =
  (typeof progressionSourceIntegrityStates)[number];

export const progressionProducerRuntimes = [
  'backend',
  'web',
  'ios_native',
  'android_native',
] as const;

export type ProgressionProducerRuntime =
  (typeof progressionProducerRuntimes)[number];

export interface ProgressionSourceProducerContext {
  appSurface: string;
  producerVersion: string;
  runtimeContext: Record<
    string,
    | boolean
    | number
    | string
    | null
    | readonly boolean[]
    | readonly number[]
    | readonly string[]
  >;
}

export interface ProgressionSourceCorrelation {
  exerciseLogIds: string[];
  linkedSourceIds: string[];
  planId: string | null;
  poseSessionId: string | null;
  poseSessionIds: string[];
  sessionId: string | null;
}
