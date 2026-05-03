import type {
  CreateExerciseDraftProposalInput,
  ExerciseDraftProposalRecord,
  ExerciseAiDraftEvidenceRecord,
  ExerciseHandShapeProfileRecord,
  ExerciseMovementProfileRecord,
  ExerciseRigKeyframeKind,
  ExerciseRigKeyframeRecord,
  ExerciseRigRecord,
  FitnessExerciseCategory,
  PoseKeypointRecord,
  PoseMovementContractRecord,
  PoseRepAngleDataRecord,
  PoseSequenceFrameRecord,
} from "@fittrack/types";
import {
  buildFallbackPoseMovementContract,
  getPoseMovementContractAngle,
  toCanonicalPoseExerciseLabel,
} from "./pose";
import {
  createDefaultExerciseMuscleTargets,
  createExerciseMovementProfile,
  getPrimaryExerciseMuscleGroup,
  normalizeExerciseHandShapeProfile,
  normalizeExerciseMovementProfile,
  normalizeExerciseMuscleTargets,
} from "./exercise-editor";

const MAX_RIG_KEYPOINTS = 33;

function round(value: number, decimals = 4) {
  return Number(value.toFixed(decimals));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeLabel(value: string | null | undefined) {
  return value?.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ") || null;
}

function toTitleLabel(value: string | null | undefined) {
  const normalized = normalizeLabel(value);
  if (!normalized) return "Custom Exercise Draft";
  return normalized
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function averageFrameConfidence(frame: PoseSequenceFrameRecord) {
  if (!frame.keypoints.length) return 0;
  const visible = frame.keypoints
    .slice(0, MAX_RIG_KEYPOINTS)
    .map((point) => point.visibility)
    .filter((value) => Number.isFinite(value));
  if (!visible.length) return 0;
  return round(
    clamp(
      visible.reduce((sum, value) => sum + value, 0) / visible.length,
      0,
      1,
    ),
    3,
  );
}

function normalizeFrameKeypoints(frame: PoseSequenceFrameRecord) {
  return frame.keypoints.slice(0, MAX_RIG_KEYPOINTS).map((point) => ({
    visibility: round(clamp(point.visibility, 0, 1), 4),
    x: round(clamp(point.x, -1, 2), 5),
    y: round(clamp(point.y, -1, 2), 5),
    z: round(point.z, 5),
  }));
}

type GeneratedPoint = [number, number, number?, number?];

function createGeneratedKeypoints(
  overrides: Record<number, GeneratedPoint>,
): PoseKeypointRecord[] {
  return Array.from({ length: MAX_RIG_KEYPOINTS }, (_, index) => {
    const [x, y, z = 0, visibility = 0.08] =
      overrides[index] ?? [0.5, 0.5, 0, 0.04];
    return {
      visibility: round(clamp(visibility, 0, 1), 4),
      x: round(clamp(x, -0.2, 1.2), 5),
      y: round(clamp(y, -0.2, 1.2), 5),
      z: round(z, 5),
    };
  });
}

function createGeneratedKeyframe({
  angle,
  capturedAtMs,
  keypoints,
  kind,
}: {
  angle: number | null;
  capturedAtMs: number;
  keypoints: PoseKeypointRecord[];
  kind: ExerciseRigKeyframeKind;
}): ExerciseRigKeyframeRecord {
  return {
    angle: typeof angle === "number" ? round(angle, 3) : null,
    capturedAtMs,
    confidence: 0.82,
    keypoints,
    kind,
    label:
      kind === "peak"
        ? "Peak contraction"
        : kind === "end"
          ? "Return"
          : "Start position",
  };
}

function buildStandingBase(overrides: Record<number, GeneratedPoint>) {
  return createGeneratedKeypoints({
    11: [0.42, 0.25, 0, 0.92],
    12: [0.58, 0.25, 0, 0.92],
    13: [0.38, 0.43, 0, 0.9],
    14: [0.62, 0.43, 0, 0.9],
    15: [0.36, 0.63, 0, 0.88],
    16: [0.64, 0.63, 0, 0.88],
    23: [0.45, 0.54, 0, 0.9],
    24: [0.55, 0.54, 0, 0.9],
    25: [0.44, 0.74, 0, 0.86],
    26: [0.56, 0.74, 0, 0.86],
    27: [0.43, 0.94, 0, 0.84],
    28: [0.57, 0.94, 0, 0.84],
    ...overrides,
  });
}

function buildGeneratedRigKeypoints(exerciseLabel: string | null | undefined) {
  const canonical = toCanonicalPoseExerciseLabel(exerciseLabel);

  if (canonical === "push_up") {
    return [
      createGeneratedKeypoints({
        11: [0.28, 0.46, 0, 0.92],
        12: [0.41, 0.46, 0, 0.92],
        13: [0.29, 0.61, 0, 0.9],
        14: [0.42, 0.61, 0, 0.9],
        15: [0.3, 0.78, 0, 0.9],
        16: [0.43, 0.78, 0, 0.9],
        23: [0.62, 0.5, 0, 0.9],
        24: [0.72, 0.5, 0, 0.9],
        25: [0.82, 0.53, 0, 0.84],
        26: [0.9, 0.53, 0, 0.84],
        27: [0.98, 0.56, 0, 0.8],
        28: [1.05, 0.56, 0, 0.8],
      }),
      createGeneratedKeypoints({
        11: [0.28, 0.56, 0, 0.92],
        12: [0.41, 0.56, 0, 0.92],
        13: [0.24, 0.68, 0, 0.9],
        14: [0.45, 0.68, 0, 0.9],
        15: [0.3, 0.78, 0, 0.9],
        16: [0.43, 0.78, 0, 0.9],
        23: [0.62, 0.57, 0, 0.9],
        24: [0.72, 0.57, 0, 0.9],
        25: [0.82, 0.59, 0, 0.84],
        26: [0.9, 0.59, 0, 0.84],
        27: [0.98, 0.6, 0, 0.8],
        28: [1.05, 0.6, 0, 0.8],
      }),
      createGeneratedKeypoints({
        11: [0.28, 0.46, 0, 0.92],
        12: [0.41, 0.46, 0, 0.92],
        13: [0.29, 0.61, 0, 0.9],
        14: [0.42, 0.61, 0, 0.9],
        15: [0.3, 0.78, 0, 0.9],
        16: [0.43, 0.78, 0, 0.9],
        23: [0.62, 0.5, 0, 0.9],
        24: [0.72, 0.5, 0, 0.9],
        25: [0.82, 0.53, 0, 0.84],
        26: [0.9, 0.53, 0, 0.84],
        27: [0.98, 0.56, 0, 0.8],
        28: [1.05, 0.56, 0, 0.8],
      }),
    ];
  }

  if (canonical === "squat") {
    return [
      buildStandingBase({}),
      buildStandingBase({
        23: [0.44, 0.68, 0, 0.9],
        24: [0.56, 0.68, 0, 0.9],
        25: [0.34, 0.78, 0, 0.88],
        26: [0.66, 0.78, 0, 0.88],
        27: [0.31, 0.94, 0, 0.84],
        28: [0.69, 0.94, 0, 0.84],
      }),
      buildStandingBase({}),
    ];
  }

  if (canonical === "dip") {
    return [
      buildStandingBase({
        13: [0.32, 0.42, 0, 0.9],
        14: [0.68, 0.42, 0, 0.9],
        15: [0.3, 0.58, 0, 0.88],
        16: [0.7, 0.58, 0, 0.88],
      }),
      buildStandingBase({
        11: [0.42, 0.34, 0, 0.92],
        12: [0.58, 0.34, 0, 0.92],
        13: [0.34, 0.47, 0, 0.9],
        14: [0.66, 0.47, 0, 0.9],
        15: [0.3, 0.58, 0, 0.88],
        16: [0.7, 0.58, 0, 0.88],
      }),
      buildStandingBase({
        13: [0.32, 0.42, 0, 0.9],
        14: [0.68, 0.42, 0, 0.9],
        15: [0.3, 0.58, 0, 0.88],
        16: [0.7, 0.58, 0, 0.88],
      }),
    ];
  }

  if (canonical === "pull_up") {
    return [
      buildStandingBase({
        13: [0.34, 0.12, 0, 0.9],
        14: [0.66, 0.12, 0, 0.9],
        15: [0.28, 0.02, 0, 0.88],
        16: [0.72, 0.02, 0, 0.88],
      }),
      buildStandingBase({
        11: [0.42, 0.18, 0, 0.92],
        12: [0.58, 0.18, 0, 0.92],
        13: [0.36, 0.17, 0, 0.9],
        14: [0.64, 0.17, 0, 0.9],
        15: [0.3, 0.05, 0, 0.88],
        16: [0.7, 0.05, 0, 0.88],
        23: [0.45, 0.44, 0, 0.9],
        24: [0.55, 0.44, 0, 0.9],
        25: [0.44, 0.64, 0, 0.86],
        26: [0.56, 0.64, 0, 0.86],
        27: [0.43, 0.82, 0, 0.84],
        28: [0.57, 0.82, 0, 0.84],
      }),
      buildStandingBase({
        13: [0.34, 0.12, 0, 0.9],
        14: [0.66, 0.12, 0, 0.9],
        15: [0.28, 0.02, 0, 0.88],
        16: [0.72, 0.02, 0, 0.88],
      }),
    ];
  }

  return [
    buildStandingBase({}),
    buildStandingBase({}),
    buildStandingBase({}),
  ];
}

function createKeyframe(
  kind: ExerciseRigKeyframeKind,
  frame: PoseSequenceFrameRecord,
  angle: number | null,
): ExerciseRigKeyframeRecord {
  return {
    angle: typeof angle === "number" && Number.isFinite(angle)
      ? round(angle, 3)
      : null,
    capturedAtMs: frame.capturedAtMs,
    confidence: averageFrameConfidence(frame),
    keypoints: normalizeFrameKeypoints(frame),
    kind,
    label:
      kind === "peak"
        ? "Peak contraction"
        : kind === "end"
          ? "Return"
          : "Start position",
  };
}

function nearestFrameByTimestamp(
  frames: PoseSequenceFrameRecord[],
  timestamp: number,
) {
  return frames.reduce((best, frame) => {
    const currentDistance = Math.abs(frame.capturedAtMs - timestamp);
    const bestDistance = Math.abs(best.capturedAtMs - timestamp);
    return currentDistance < bestDistance ? frame : best;
  }, frames[0]);
}

function getFrameAngle(
  frame: PoseSequenceFrameRecord,
  contract: PoseMovementContractRecord,
) {
  return getPoseMovementContractAngle(contract, frame.keypoints);
}

function getPeakFrame(
  frames: PoseSequenceFrameRecord[],
  contract: PoseMovementContractRecord,
  repData?: PoseRepAngleDataRecord,
) {
  if (!frames.length) return null;
  if (repData) {
    const nearestLow = frames.reduce(
      (best, frame) => {
        const angle = getFrameAngle(frame, contract);
        if (angle === null) return best;
        const lowDistance = Math.abs(angle - repData.lowAngle);
        return lowDistance < best.distance ? { distance: lowDistance, frame } : best;
      },
      { distance: Number.POSITIVE_INFINITY, frame: frames[0] },
    );
    return nearestLow.frame;
  }

  return frames.reduce((best, frame) => {
    const angle = getFrameAngle(frame, contract);
    if (angle === null) return best;
    if (!best || angle < best.angle) return { angle, frame };
    return best;
  }, null as { angle: number; frame: PoseSequenceFrameRecord } | null)?.frame ?? frames[0];
}

export function buildExerciseRigFromPoseFrames({
  exerciseLabel,
  frames,
  movementContract,
  poseSessionId,
  rawAngleData,
}: {
  exerciseLabel?: string | null;
  frames: PoseSequenceFrameRecord[];
  movementContract: PoseMovementContractRecord | null;
  poseSessionId?: string | null;
  rawAngleData: PoseRepAngleDataRecord[];
}): ExerciseRigRecord {
  const warnings: string[] = [];
  const usableFrames = frames
    .filter((frame) => frame.keypoints.length >= MAX_RIG_KEYPOINTS)
    .sort((a, b) => a.capturedAtMs - b.capturedAtMs);

  if (!usableFrames.length || !movementContract) {
    warnings.push(
      !movementContract
        ? "No movement contract was armed during capture."
        : "No full pose frames were available for the rig preview.",
    );
    return {
      angleSummary: null,
      capturedFromSession: poseSessionId ?? null,
      exerciseLabel: normalizeLabel(exerciseLabel ?? movementContract?.exercise),
      keyframes: [],
      landmarkSchema: "mediapipe_pose_v1",
      repIndex: null,
      schemaVersion: "exercise_rig_v1",
      source: "pose_session",
      warnings,
    };
  }

  const latestRep = rawAngleData.at(-1);
  const startFrame = latestRep
    ? nearestFrameByTimestamp(
        usableFrames,
        Math.max(usableFrames[0].capturedAtMs, latestRep.timestamp - 900),
      )
    : usableFrames[0];
  const peakFrame = getPeakFrame(usableFrames, movementContract, latestRep);
  const endFrame = latestRep
    ? nearestFrameByTimestamp(usableFrames, latestRep.timestamp)
    : usableFrames.at(-1) ?? usableFrames[0];
  const angles = usableFrames
    .map((frame) => getFrameAngle(frame, movementContract))
    .filter((angle): angle is number => typeof angle === "number");

  if (usableFrames.length < 8) {
    warnings.push("Rig preview has a short frame window; ask for one clean retake if it looks jumpy.");
  }

  return {
    angleSummary:
      angles.length > 0
        ? {
            dominantJoint: movementContract.dominantJoint,
            maxAngle: round(Math.max(...angles), 3),
            minAngle: round(Math.min(...angles), 3),
            repCount: rawAngleData.length,
            travel: round(Math.max(...angles) - Math.min(...angles), 3),
          }
        : null,
    capturedFromSession: poseSessionId ?? null,
    exerciseLabel: normalizeLabel(exerciseLabel ?? movementContract.exercise),
    keyframes: [
      createKeyframe("start", startFrame, getFrameAngle(startFrame, movementContract)),
      createKeyframe("peak", peakFrame ?? startFrame, peakFrame ? getFrameAngle(peakFrame, movementContract) : null),
      createKeyframe("end", endFrame, getFrameAngle(endFrame, movementContract)),
    ],
    landmarkSchema: "mediapipe_pose_v1",
    repIndex: latestRep?.repNumber ?? null,
    schemaVersion: "exercise_rig_v1",
    source: "pose_session",
    warnings,
  };
}

export function createGeneratedExerciseRigFromMovementContract({
  exerciseLabel,
  movementContract,
}: {
  exerciseLabel?: string | null;
  movementContract: PoseMovementContractRecord;
}): ExerciseRigRecord {
  const [startKeypoints, peakKeypoints, endKeypoints] =
    buildGeneratedRigKeypoints(exerciseLabel ?? movementContract.exercise);
  const upAngle = movementContract.repThresholds.up.angle;
  const downAngle = movementContract.repThresholds.down.angle;
  const minAngle = Math.min(upAngle, downAngle);
  const maxAngle = Math.max(upAngle, downAngle);

  return {
    angleSummary: {
      dominantJoint: movementContract.dominantJoint,
      maxAngle: round(maxAngle, 3),
      minAngle: round(minAngle, 3),
      repCount: 0,
      travel: round(maxAngle - minAngle, 3),
    },
    capturedFromSession: null,
    exerciseLabel: normalizeLabel(exerciseLabel ?? movementContract.exercise),
    keyframes: [
      createGeneratedKeyframe({
        angle: upAngle,
        capturedAtMs: 0,
        keypoints: startKeypoints,
        kind: "start",
      }),
      createGeneratedKeyframe({
        angle: downAngle,
        capturedAtMs: 650,
        keypoints: peakKeypoints,
        kind: "peak",
      }),
      createGeneratedKeyframe({
        angle: upAngle,
        capturedAtMs: 1300,
        keypoints: endKeypoints,
        kind: "end",
      }),
    ],
    landmarkSchema: "mediapipe_pose_v1",
    repIndex: null,
    schemaVersion: "exercise_rig_v1",
    source: "generated_contract",
    warnings: [
      "Generated from the movement contract; verify joint positions before publishing.",
    ],
  };
}

export function buildExerciseAiDraftEvidence({
  confidence,
  integrityNotes,
  movementContract,
  repCount,
  rig,
}: {
  confidence?: number | null;
  integrityNotes?: string[];
  movementContract: PoseMovementContractRecord | null;
  repCount: number;
  rig: ExerciseRigRecord | null;
}): ExerciseAiDraftEvidenceRecord {
  return {
    confidence: typeof confidence === "number" ? round(clamp(confidence, 0, 1), 3) : null,
    integrityNotes: integrityNotes ?? [],
    movementContract,
    promptContractVersion: "exercise_creation_v1",
    repCount,
    rig,
    schemaVersion: "exercise_ai_draft_v1",
    source: "mobile_pose_session",
  };
}

function resolveDraftMovementProfile({
  evidence,
  exerciseLabel,
  movementProfile,
}: {
  evidence?: ExerciseAiDraftEvidenceRecord | null;
  exerciseLabel: string;
  movementProfile?: ExerciseMovementProfileRecord | null;
}) {
  const movementContract =
    movementProfile?.movementContract ??
    evidence?.movementContract ??
    buildFallbackPoseMovementContract(exerciseLabel);
  const rig =
    movementProfile?.rig ??
    evidence?.rig ??
    (movementContract
      ? createGeneratedExerciseRigFromMovementContract({
          exerciseLabel,
          movementContract,
        })
      : null);

  return normalizeExerciseMovementProfile(movementProfile, {
    movementContract,
    rig,
  }) ?? createExerciseMovementProfile({ movementContract, rig });
}

function inferDraftMuscleGroup(exerciseLabel: string) {
  const canonical = toCanonicalPoseExerciseLabel(exerciseLabel);
  if (canonical === "push_up") return "chest";
  if (canonical === "squat") return "quads";
  if (canonical === "dip") return "triceps";
  if (canonical === "pull_up") return "lats";
  if (canonical === "bicep_curl") return "biceps";
  return "custom";
}

function inferDraftCategory(_exerciseLabel: string): FitnessExerciseCategory {
  return "strength";
}

function resolveDraftHandProfile(
  value: ExerciseHandShapeProfileRecord | null | undefined,
  exerciseLabel: string,
) {
  const profile = normalizeExerciseHandShapeProfile(value);
  const requiresGrip = toCanonicalPoseExerciseLabel(exerciseLabel) === "bicep_curl";
  return {
    ...profile,
    grip: {
      ...profile.grip,
      required: profile.grip.required || requiresGrip,
    },
  };
}

export function buildDeterministicExerciseDraftProposal(
  input: CreateExerciseDraftProposalInput,
): ExerciseDraftProposalRecord {
  const proposedName = toTitleLabel(input.proposedName);
  const movementProfile = resolveDraftMovementProfile({
    evidence: input.evidence,
    exerciseLabel: proposedName,
    movementProfile: input.movementProfile,
  });
  const muscleGroup =
    getPrimaryExerciseMuscleGroup(input.muscleTargets, input.muscleGroup) ||
    inferDraftMuscleGroup(proposedName);
  const muscleTargets = normalizeExerciseMuscleTargets(
    input.muscleTargets?.length
      ? input.muscleTargets
      : createDefaultExerciseMuscleTargets(muscleGroup),
    muscleGroup,
  );
  const evidence =
    input.evidence ??
    buildExerciseAiDraftEvidence({
      confidence: 0.58,
      integrityNotes: [
        "Generated by deterministic fallback because AI output was unavailable.",
      ],
      movementContract: movementProfile.movementContract,
      repCount: 0,
      rig: movementProfile.rig,
    });
  const confidence =
    typeof input.evidence?.confidence === "number"
      ? round(clamp(input.evidence.confidence, 0, 1), 3)
      : 0.58;

  return {
    category: input.category ?? inferDraftCategory(proposedName),
    confidence,
    description:
      input.description?.trim() ||
      `${proposedName} generated from pose evidence and editable movement thresholds.`,
    evidence: {
      ...evidence,
      movementContract: movementProfile.movementContract,
      rig: movementProfile.rig,
    },
    handShapeProfile: resolveDraftHandProfile(
      input.handShapeProfile,
      proposedName,
    ),
    instructions:
      input.instructions?.trim() ||
      "Use the visual rig to confirm the start position, peak contraction, and controlled return before publishing.",
    movementProfile,
    muscleGroup,
    muscleTargets,
    proposalSource: "deterministic_fallback",
    proposedName,
    reviewWarnings: [
      "AI proposal was not treated as source of truth; validate the movement rig, thresholds, and muscle allocation before publishing.",
      ...movementProfile.warnings,
      ...(movementProfile.rig?.warnings ?? []),
    ],
    summary:
      input.summary?.trim() ||
      `${proposedName} draft with ${movementProfile.movementContract?.dominantJoint ?? "unknown"}-dominant movement evidence.`,
  };
}
