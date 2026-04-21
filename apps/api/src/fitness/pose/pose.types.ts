import type { Prisma } from '@prisma/client';

import type {
  PoseAnalyzeResponse,
  PoseFinalizeResponse,
} from '../../ai/ai-python-client.service';

export type PoseConnectionState = {
  poseSessionId: string;
  userId: string;
  exerciseHint: string | null;
  repCountAi: number;
  confidenceSum: number;
  confidenceSamples: number;
  acceptedFps: number;
  subjectLockMode: 'single_subject';
};

export type PoseFrameProcessingResult = {
  nextState: PoseConnectionState;
  analysis: PoseAnalyzeResponse;
};

export type JsonObject = Record<string, unknown>;

export type PoseAnalyzePersistenceInput = {
  poseSessionId: string;
  detectedExerciseName: string | null;
  detectedProfileId: string | null;
  classificationConfidence: number | null;
  subjectLockConfidence: number | null;
  analysisSummary: Prisma.InputJsonObject | null;
};

export type PoseFinalizePersistenceInput = {
  poseSessionId: string;
  endedAt: Date;
  repCountAi: number;
  confidenceAvg: number | null;
  detectedExerciseName: string | null;
  detectedProfileId: string | null;
  classificationConfidence: number | null;
  subjectLockConfidence: number | null;
  analysisSummary: Prisma.InputJsonObject | null;
  learnedProfile?: {
    canonicalName: string;
    exerciseId: string | null;
    landmarkSignature: Prisma.InputJsonObject;
    angleSignature: Prisma.InputJsonObject;
    orientationSignature: Prisma.InputJsonObject;
    movementPattern: Prisma.InputJsonObject;
    visibilityPattern: Prisma.InputJsonObject;
    dominantJoint?: string | null;
    tolerance?: number | null;
    repThresholds?: Prisma.InputJsonObject | null;
    repRules?: Prisma.InputJsonObject | null;
  } | null;
};

export type PoseFinalizeResult = PoseFinalizeResponse;
