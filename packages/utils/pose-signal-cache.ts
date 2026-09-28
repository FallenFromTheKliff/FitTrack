import type {
  PoseSequenceFrameRecord,
  PoseSequenceSignalsRecord,
} from "@fittrack/types";

import {
  computePoseSignals,
  type PoseCoordinateDimensions,
} from "./pose";

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
  let lastCapturedAtMs = Number.NEGATIVE_INFINITY;
  let geometryKey: string | null = null;

  const getGeometryKey = (dimensions?: PoseCoordinateDimensions) =>
    dimensions &&
    Number.isFinite(dimensions.width) &&
    Number.isFinite(dimensions.height) &&
    dimensions.width > 0 &&
    dimensions.height > 0
      ? `${dimensions.width}x${dimensions.height}`
      : "default";

  const prepareFrameContext = (
    capturedAtMs: number,
    dimensions?: PoseCoordinateDimensions,
  ) => {
    const nextGeometryKey = getGeometryKey(dimensions);
    if (
      (geometryKey !== null && geometryKey !== nextGeometryKey) ||
      capturedAtMs < lastCapturedAtMs
    ) {
      bufferedSignals = null;
      bufferedAtMs = Number.NEGATIVE_INFINITY;
    }
    geometryKey = nextGeometryKey;
    lastCapturedAtMs = capturedAtMs;
  };

  return {
    getInstant(
      frame: PoseSequenceFrameRecord,
      coordinateDimensions?: PoseCoordinateDimensions,
    ) {
      prepareFrameContext(frame.capturedAtMs, coordinateDimensions);
      return computePoseSignals([frame], coordinateDimensions);
    },
    getBuffered(
      frames: PoseSequenceFrameRecord[],
      capturedAtMs: number,
      coordinateDimensions?: PoseCoordinateDimensions,
    ): PoseSequenceSignalsRecord | null {
      prepareFrameContext(capturedAtMs, coordinateDimensions);
      if (frames.length < Math.max(1, minimumFrameCount)) {
        return bufferedSignals;
      }
      if (
        bufferedSignals === null ||
        capturedAtMs - bufferedAtMs >= Math.max(0, updateIntervalMs)
      ) {
        bufferedSignals = computePoseSignals(frames, coordinateDimensions);
        bufferedAtMs = capturedAtMs;
      }
      return bufferedSignals;
    },
    reset() {
      bufferedSignals = null;
      bufferedAtMs = Number.NEGATIVE_INFINITY;
      lastCapturedAtMs = Number.NEGATIVE_INFINITY;
      geometryKey = null;
    },
  };
}
