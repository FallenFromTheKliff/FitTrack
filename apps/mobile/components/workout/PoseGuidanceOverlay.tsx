import type {
  PoseKeypointRecord,
  PoseMovementContractRecord,
  ThemeColors,
} from "@fittrack/types";
import { RepGatesOverlay } from "@/components/workout/RepGatesOverlay";

type PoseGuidanceOverlayProps = {
  colors: ThemeColors;
  currentAngle: number | null;
  currentPhase: string;
  guidanceLabel?: string | null;
  keypoints: PoseKeypointRecord[] | null;
  lowConfidenceLandmarks: string[];
  movementContract: PoseMovementContractRecord | null;
  reps: number;
  repPathUnblocked?: boolean;
  statusText?: string | null;
  viewportSize?: { height: number; width: number } | null;
};

/**
 * The camera owns this full-viewport overlay. Keep the historical component
 * contract stable so callers continue to provide live landmarks and pose
 * state without coupling the UI to the rep engine.
 */
export function PoseGuidanceOverlay(props: PoseGuidanceOverlayProps) {
  return <RepGatesOverlay {...props} />;
}
