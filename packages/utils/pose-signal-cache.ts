import type {
  PoseSequenceFrameRecord,
  PoseSequenceSignalsRecord,
} from "@fittrack/types";

import { computePoseSignals } from "./pose";

export type PoseSignalCache = ReturnType<typeof createPoseSignalCache>;

/**
 * Keeps the deliberately expensive temporal summary on a slower cadence while
 * leaving the current-frame signal available for immediate UI decisions.
 */
export function createPoseSignalCache(
  updateIntervalMs: number,
  minimumFrameCount = 1,
) {
  let bufferedSignals: PoseSequenceSignalsRecord | null = null;
  let bufferedAtMs = Number.NEGATIVE_INFINITY;

  return {
    getInstant(frame: PoseSequenceFrameRecord) {
      return computePoseSignals([frame]);
    },
    getBuffered(
      frames: PoseSequenceFrameRecord[],
      capturedAtMs: number,
    ): PoseSequenceSignalsRecord | null {
      if (frames.length < Math.max(1, minimumFrameCount)) {
        return bufferedSignals;
      }
      if (
        bufferedSignals === null ||
        capturedAtMs - bufferedAtMs >= Math.max(0, updateIntervalMs)
      ) {
        bufferedSignals = computePoseSignals(frames);
        bufferedAtMs = capturedAtMs;
      }
      return bufferedSignals;
    },
    reset() {
      bufferedSignals = null;
      bufferedAtMs = Number.NEGATIVE_INFINITY;
    },
  };
}
