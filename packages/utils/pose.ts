import type {
  PoseAngleFrameSignalRecord,
  PoseJointName,
  PoseKeypointRecord,
  PoseMovementContractRecord,
  PoseRepAngleDataRecord,
  PoseSequenceFrameRecord,
  PoseSequenceSignalsRecord,
} from "@fittrack/types";

type JointIndexes = {
  a: number;
  b: number;
  c: number;
};

const LANDMARK_NAMES = [
  "nose",
  "left_eye_inner",
  "left_eye",
  "left_eye_outer",
  "right_eye_inner",
  "right_eye",
  "right_eye_outer",
  "left_ear",
  "right_ear",
  "mouth_left",
  "mouth_right",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_pinky",
  "right_pinky",
  "left_index",
  "right_index",
  "left_thumb",
  "right_thumb",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
  "left_heel",
  "right_heel",
  "left_foot_index",
  "right_foot_index",
] as const;

type PoseLandmarkName = (typeof LANDMARK_NAMES)[number];

const JOINT_MAP: Record<PoseJointName, JointIndexes[]> = {
  elbow: [
    { a: 11, b: 13, c: 15 },
    { a: 12, b: 14, c: 16 },
  ],
  hip: [
    { a: 11, b: 23, c: 25 },
    { a: 12, b: 24, c: 26 },
  ],
  knee: [
    { a: 23, b: 25, c: 27 },
    { a: 24, b: 26, c: 28 },
  ],
  shoulder: [
    { a: 13, b: 11, c: 23 },
    { a: 14, b: 12, c: 24 },
  ],
};

const MIN_CONFIDENCE = 0.5;
const MIN_RELIABLE_FRAME_LANDMARKS = 16;
const POSE_EXERCISE_ALIAS_GROUPS = [
  { canonical: "push_up", aliases: ["push up", "push-up", "pushup", "push_up"] },
  { canonical: "squat", aliases: ["squat", "back squat"] },
  { canonical: "bicep_curl", aliases: ["bicep curl", "curl", "bicep_curl"] },
  { canonical: "shoulder_press", aliases: ["shoulder press", "press", "shoulder_press"] },
  { canonical: "plank", aliases: ["plank"] },
  { canonical: "bench_press", aliases: ["bench press", "bench_press"] },
] as const;
const FALLBACK_POSE_MOVEMENT_CONTRACTS: Record<
  string,
  PoseMovementContractRecord
> = {
  bench_press: {
    dominantJoint: "elbow",
    exercise: "bench_press",
    oscillatingJoints: ["elbow", "shoulder"],
    repThresholds: {
      down: { angle: 78, tolerance: 12 },
      up: { angle: 166, tolerance: 12 },
    },
    secondaryCheck: "bar_path",
  },
  bicep_curl: {
    dominantJoint: "elbow",
    exercise: "bicep_curl",
    oscillatingJoints: ["elbow"],
    repThresholds: {
      down: { angle: 58, tolerance: 10 },
      up: { angle: 154, tolerance: 10 },
    },
    secondaryCheck: "hip_stability",
  },
  plank: {
    dominantJoint: "hip",
    exercise: "plank",
    oscillatingJoints: ["hip", "shoulder"],
    repThresholds: {
      down: { angle: 165, tolerance: 8 },
      up: { angle: 178, tolerance: 8 },
    },
    secondaryCheck: "core_alignment",
  },
  push_up: {
    dominantJoint: "elbow",
    exercise: "push_up",
    oscillatingJoints: ["elbow", "shoulder"],
    repThresholds: {
      down: { angle: 98, tolerance: 18 },
      up: { angle: 148, tolerance: 18 },
    },
    secondaryCheck: "body_line",
  },
  shoulder_press: {
    dominantJoint: "shoulder",
    exercise: "shoulder_press",
    oscillatingJoints: ["shoulder", "elbow"],
    repThresholds: {
      down: { angle: 72, tolerance: 12 },
      up: { angle: 164, tolerance: 12 },
    },
    secondaryCheck: "lockout_control",
  },
  squat: {
    dominantJoint: "knee",
    exercise: "squat",
    oscillatingJoints: ["hip", "knee"],
    repThresholds: {
      down: { angle: 92, tolerance: 12 },
      up: { angle: 168, tolerance: 12 },
    },
    secondaryCheck: "hip_depth",
  },
};

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averagePoint(
  keypoints: PoseKeypointRecord[],
  leftIndex: number,
  rightIndex: number,
) {
  const left = keypoints[leftIndex];
  const right = keypoints[rightIndex];
  return {
    visibility: average([left.visibility, right.visibility]),
    x: average([left.x, right.x]),
    y: average([left.y, right.y]),
    z: average([left.z, right.z]),
  };
}

function angleAtPoint(
  pointA: PoseKeypointRecord,
  pointB: PoseKeypointRecord,
  pointC: PoseKeypointRecord,
) {
  const abX = pointA.x - pointB.x;
  const abY = pointA.y - pointB.y;
  const cbX = pointC.x - pointB.x;
  const cbY = pointC.y - pointB.y;
  const abMag = Math.sqrt(abX ** 2 + abY ** 2);
  const cbMag = Math.sqrt(cbX ** 2 + cbY ** 2);
  if (!abMag || !cbMag) return null;
  const cosine = Math.max(
    -1,
    Math.min(1, (abX * cbX + abY * cbY) / (abMag * cbMag)),
  );
  return (Math.acos(cosine) * 180) / Math.PI;
}

function averageJointAngle(
  keypoints: PoseKeypointRecord[],
  indexes: JointIndexes[],
): number | null {
  const values = indexes
    .map(({ a, b, c }) => {
      const pointA = keypoints[a];
      const pointB = keypoints[b];
      const pointC = keypoints[c];
      if (
        !pointA ||
        !pointB ||
        !pointC ||
        pointA.visibility < MIN_CONFIDENCE ||
        pointB.visibility < MIN_CONFIDENCE ||
        pointC.visibility < MIN_CONFIDENCE
      ) {
        return null;
      }
      return angleAtPoint(pointA, pointB, pointC);
    })
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (!values.length) return null;
  return Number(average(values).toFixed(3));
}

function summarizeAmplitude(values: Array<number | null>) {
  const usable = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!usable.length) return 0;
  return Math.max(...usable) - Math.min(...usable);
}

function normalizePoseExerciseLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function getPoseLandmarkNames() {
  return LANDMARK_NAMES;
}

export function toCanonicalPoseExerciseLabel(
  exerciseLabel: string | null | undefined,
) {
  if (!exerciseLabel) {
    return null;
  }

  const normalized = normalizePoseExerciseLabel(exerciseLabel);
  if (!normalized) {
    return null;
  }

  for (const group of POSE_EXERCISE_ALIAS_GROUPS) {
    if (group.aliases.some((alias) => normalized.includes(alias))) {
      return group.canonical;
    }
  }

  return null;
}

export function buildFallbackPoseMovementContract(
  exerciseLabel: string | null | undefined,
): PoseMovementContractRecord | null {
  const canonical = toCanonicalPoseExerciseLabel(exerciseLabel);
  if (!canonical) {
    return null;
  }

  const contract = FALLBACK_POSE_MOVEMENT_CONTRACTS[canonical];
  return contract ? { ...contract } : null;
}

export function getPoseJointAngle(
  keypoints: PoseKeypointRecord[],
  joint: PoseJointName,
) {
  return averageJointAngle(keypoints, JOINT_MAP[joint]);
}

export function computePoseAngleSignals(
  frames: PoseSequenceFrameRecord[],
): PoseAngleFrameSignalRecord[] {
  return frames.map((frame) => ({
    capturedAtMs: frame.capturedAtMs,
    elbow: getPoseJointAngle(frame.keypoints, "elbow"),
    hip: getPoseJointAngle(frame.keypoints, "hip"),
    knee: getPoseJointAngle(frame.keypoints, "knee"),
    shoulder: getPoseJointAngle(frame.keypoints, "shoulder"),
  }));
}

export function computePoseSignals(
  frames: PoseSequenceFrameRecord[],
): PoseSequenceSignalsRecord {
  const angles = computePoseAngleSignals(frames);
  const lastFrame = frames.at(-1);
  const latestKeypoints = lastFrame?.keypoints ?? [];
  const leftHip = latestKeypoints[23];
  const rightHip = latestKeypoints[24];
  const leftWrist = latestKeypoints[15];
  const rightWrist = latestKeypoints[16];
  const leftFoot = latestKeypoints[31];
  const rightFoot = latestKeypoints[32];
  const nose = latestKeypoints[0];
  const hipCenter =
    latestKeypoints.length >= 25 ? averagePoint(latestKeypoints, 23, 24) : null;
  const shoulderCenter =
    latestKeypoints.length >= 13 ? averagePoint(latestKeypoints, 11, 12) : null;

  const hipYValues = frames
    .map((frame) =>
      average(
        [frame.keypoints[23], frame.keypoints[24]]
          .filter(Boolean)
          .map((point) => point.y),
      ),
    )
    .filter((value) => Number.isFinite(value));

  const averageVisibility = average(
    frames.flatMap((frame) => frame.keypoints.map((point) => point.visibility)),
  );
  const lowConfidenceLandmarks = latestKeypoints
    .map((point, index) =>
      point.visibility < MIN_CONFIDENCE ? LANDMARK_NAMES[index] : null,
    )
    .filter((name): name is PoseLandmarkName => name !== null);

  const elbowSeries = angles.map((entry) => entry.elbow);
  const shoulderSeries = angles.map((entry) => entry.shoulder);
  const hipSeries = angles.map((entry) => entry.hip);
  const kneeSeries = angles.map((entry) => entry.knee);
  const amplitudes = {
    elbow: Number(summarizeAmplitude(elbowSeries).toFixed(4)),
    hip: Number(summarizeAmplitude(hipSeries).toFixed(4)),
    knee: Number(summarizeAmplitude(kneeSeries).toFixed(4)),
    shoulder: Number(summarizeAmplitude(shoulderSeries).toFixed(4)),
  };
  const oscillatingJoints = Object.entries(amplitudes)
    .filter(([, value]) => value >= 10)
    .map(([joint]) => joint);

  const reliableFrameCount = frames.filter((frame) => {
    const visible = frame.keypoints.filter((point) => point.visibility >= MIN_CONFIDENCE);
    return visible.length >= MIN_RELIABLE_FRAME_LANDMARKS;
  }).length;

  const torsoVector = nose && hipCenter
    ? {
        x: Number((hipCenter.x - nose.x).toFixed(4)),
        y: Number((hipCenter.y - nose.y).toFixed(4)),
      }
    : { x: 0, y: 0 };
  const torsoSlopeDeg =
    shoulderCenter && hipCenter
      ? Number(
          (
            (Math.atan2(
              Math.abs(hipCenter.y - shoulderCenter.y),
              Math.abs(hipCenter.x - shoulderCenter.x) + 1e-6,
            ) *
              180) /
            Math.PI
          ).toFixed(3),
        )
      : 0;
  const bodyOrientation =
    torsoSlopeDeg > 55 ? "upright" : torsoSlopeDeg < 35 ? "horizontal" : "inclined";

  const hipRange = hipYValues.length ? Math.max(...hipYValues) - Math.min(...hipYValues) : 0;

  return {
    angles,
    hip: {
      averageY: Number(average(hipYValues).toFixed(4)),
      rangeY: Number(hipRange.toFixed(4)),
      stable: hipRange < 0.05,
    },
    orientation: {
      bodyOrientation,
      torsoSlopeDeg,
      vector: torsoVector,
    },
    temporal: {
      amplitudes,
      oscillatingJoints,
    },
    visibility: {
      averageVisibility: Number(averageVisibility.toFixed(4)),
      feetVisibility: Number(
        average([leftFoot?.visibility ?? 0, rightFoot?.visibility ?? 0]).toFixed(4),
      ),
      lowConfidenceLandmarks: [...lowConfidenceLandmarks],
      reliableFrameCount,
      wristVisibility: Number(
        average([leftWrist?.visibility ?? 0, rightWrist?.visibility ?? 0]).toFixed(4),
      ),
    },
  };
}

export function summarizeMovementGuidance(
  contract: PoseMovementContractRecord | null,
  keypoints: PoseKeypointRecord[] | null,
  currentPhase: string,
  lowConfidenceLandmarks: string[],
) {
  const tips: string[] = [];
  if (lowConfidenceLandmarks.length > 0) {
    tips.push("Keep your full body visible for reliable rep tracking.");
  }

  if (!contract || !keypoints) {
    return tips;
  }

  const hipCenter = averagePoint(keypoints, 23, 24);
  const shoulderCenter = averagePoint(keypoints, 11, 12);
  const torsoSlopeDeg =
    (Math.atan2(
      Math.abs(hipCenter.y - shoulderCenter.y),
      Math.abs(hipCenter.x - shoulderCenter.x) + 1e-6,
    ) *
      180) /
    Math.PI;

  if (contract.secondaryCheck === "body_line" && torsoSlopeDeg < 35) {
    tips.push("Keep your torso and hips moving together.");
  }
  if (contract.secondaryCheck === "hip_depth" && currentPhase === "down") {
    tips.push("Sit deeper and keep your knees tracking over your toes.");
  }
  if (contract.secondaryCheck === "elbow_stack" && currentPhase === "up") {
    tips.push("Keep your elbows stacked under the load.");
  }

  return tips;
}

export function buildRepAngleData(
  repNumber: number,
  dominantJoint: PoseJointName,
  lowAngle: number,
  highAngle: number,
  timestamp: number,
): PoseRepAngleDataRecord {
  return {
    dominantJoint,
    highAngle: Number(highAngle.toFixed(3)),
    lowAngle: Number(lowAngle.toFixed(3)),
    repNumber,
    timestamp,
  };
}
