import type {
  PoseMovementContractRecord,
  PoseRepAngleDataRecord,
} from "@fittrack/types";
import { buildRepAngleData, toCanonicalPoseExerciseLabel } from "@fittrack/utils";

export type PoseRepPhase = "primed" | "down" | "up";

export type PoseRepEngineState = {
  currentHighAngle: number | null;
  currentLowAngle: number | null;
  downStreak: number;
  phase: PoseRepPhase;
  rawAngleData: PoseRepAngleDataRecord[];
  repCount: number;
  upStreak: number;
};

const REQUIRED_STREAK = 2;
const MIN_REP_TRAVEL = 18;

function getRepEngineThresholds(contract: PoseMovementContractRecord) {
  const canonicalExercise = toCanonicalPoseExerciseLabel(contract.exercise);

  if (canonicalExercise === "push_up") {
    return {
      minRepTravel: 8,
      requiredStreak: 1,
    };
  }

  return {
    minRepTravel: MIN_REP_TRAVEL,
    requiredStreak: REQUIRED_STREAK,
  };
}

export function createPoseRepEngineState(): PoseRepEngineState {
  return {
    currentHighAngle: null,
    currentLowAngle: null,
    downStreak: 0,
    phase: "primed",
    rawAngleData: [],
    repCount: 0,
    upStreak: 0,
  };
}

export function stepPoseRepEngine(
  state: PoseRepEngineState,
  contract: PoseMovementContractRecord,
  currentAngle: number | null,
  timestamp: number,
): {
  nextState: PoseRepEngineState;
  repCompleted: boolean;
} {
  if (currentAngle === null || !Number.isFinite(currentAngle)) {
    return {
      nextState: state,
      repCompleted: false,
    };
  }

  const downLimit =
    contract.repThresholds.down.angle + contract.repThresholds.down.tolerance;
  const upLimit =
    contract.repThresholds.up.angle - contract.repThresholds.up.tolerance;
  const { minRepTravel, requiredStreak } = getRepEngineThresholds(contract);
  const nextState: PoseRepEngineState = {
    ...state,
    currentHighAngle:
      state.currentHighAngle === null
        ? currentAngle
        : Math.max(state.currentHighAngle, currentAngle),
    currentLowAngle:
      state.currentLowAngle === null
        ? currentAngle
        : Math.min(state.currentLowAngle, currentAngle),
  };

  if (currentAngle <= downLimit) {
    nextState.downStreak += 1;
  } else {
    nextState.downStreak = 0;
  }

  if (nextState.phase !== "down" && nextState.downStreak >= requiredStreak) {
    nextState.phase = "down";
    nextState.upStreak = 0;
    nextState.currentLowAngle = currentAngle;
    nextState.currentHighAngle = currentAngle;
    return {
      nextState,
      repCompleted: false,
    };
  }

  if (nextState.phase === "down") {
    if (currentAngle >= upLimit) {
      nextState.upStreak += 1;
    } else if (currentAngle <= downLimit) {
      nextState.upStreak = 0;
    }

    const travel =
      (nextState.currentHighAngle ?? currentAngle) -
      (nextState.currentLowAngle ?? currentAngle);
    if (nextState.upStreak >= requiredStreak && travel >= minRepTravel) {
      const repNumber = nextState.repCount + 1;
      nextState.repCount = repNumber;
      nextState.phase = "up";
      nextState.downStreak = 0;
      nextState.upStreak = 0;
      nextState.rawAngleData = [
        ...nextState.rawAngleData,
        buildRepAngleData(
          repNumber,
          contract.dominantJoint,
          nextState.currentLowAngle ?? currentAngle,
          nextState.currentHighAngle ?? currentAngle,
          timestamp,
        ),
      ];
      nextState.currentLowAngle = currentAngle;
      nextState.currentHighAngle = currentAngle;
      return {
        nextState,
        repCompleted: true,
      };
    }
  }

  if (nextState.phase === "up" && currentAngle < upLimit) {
    nextState.phase = "primed";
  }

  return {
    nextState,
    repCompleted: false,
  };
}
