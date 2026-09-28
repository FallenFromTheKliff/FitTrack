import { requireOptionalNativeModule } from "expo";
import { VisionCameraProxy } from "react-native-vision-camera";
import type { Frame, FrameProcessorPlugin } from "react-native-vision-camera";

import type { PoseSubjectCandidate } from "@fittrack/utils";

export type FitTrackMultiPoseErrorCode =
  | "module_unavailable"
  | "plugin_unavailable"
  | "native_bridge_unavailable"
  | "session_limit"
  | "model_initialization_failed"
  | "session_closed"
  | "invalid_frame"
  | "image_conversion_failed"
  | "inference_failed";

export type FitTrackMultiPoseError = {
  code: FitTrackMultiPoseErrorCode;
  message: string;
};

export type FitTrackMultiPoseSessionStatus =
  | "off"
  | "starting"
  | "ready"
  | "error"
  | "unavailable";

type NativeMultiPoseModule = {
  createSession?: () => Promise<string>;
  isAvailable?: () => boolean;
  releaseSession?: (sessionId: string) => Promise<void>;
};

type MultiPosePluginResult = {
  candidates?: Array<{
    confidence?: number;
    spatialKeypoints?: Array<{ visibility: number; x: number; y: number; z: number }>;
    keypoints?: Array<{
      visibility?: number;
      x?: number;
      y?: number;
      z?: number;
    }>;
  }>;
  code?: string;
  message?: string;
  status?: string;
};

export type FitTrackMultiPoseSession = {
  plugin: FrameProcessorPlugin;
  sessionId: string;
};

export type FitTrackMultiPoseDetection =
  | { candidates: PoseSubjectCandidate[]; status: "ok" }
  | { error: FitTrackMultiPoseError; status: "error" };

export type FitTrackMultiPoseSessionResult =
  | { error: FitTrackMultiPoseError; session: null }
  | { error: null; session: FitTrackMultiPoseSession };

function readNativeModule() {
  try {
    return requireOptionalNativeModule<NativeMultiPoseModule>(
      "FitTrackMultiPose",
    );
  } catch {
    return null;
  }
}

function normalizeErrorCode(
  value: unknown,
  fallback: FitTrackMultiPoseErrorCode = "inference_failed",
): FitTrackMultiPoseErrorCode {
  "worklet";
  if (
    value === "module_unavailable" ||
    value === "plugin_unavailable" ||
    value === "native_bridge_unavailable" ||
    value === "session_limit" ||
    value === "model_initialization_failed" ||
    value === "session_closed" ||
    value === "invalid_frame" ||
    value === "image_conversion_failed" ||
    value === "inference_failed"
  ) {
    return value;
  }
  return fallback;
}

function nativeError(
  code: unknown,
  message: unknown,
  fallback: string,
  fallbackCode?: FitTrackMultiPoseErrorCode,
): FitTrackMultiPoseError {
  "worklet";
  return {
    code: normalizeErrorCode(code, fallbackCode ?? "inference_failed"),
    message:
      typeof message === "string" && message.length > 0 ? message : fallback,
  };
}

/** Capability probing is JS-only and never allocates a detector or touches media. */
export function isFitTrackMultiPoseSupported() {
  const nativeModule = readNativeModule();
  if (!nativeModule?.isAvailable) return false;
  try {
    return nativeModule.isAvailable() === true;
  } catch {
    return false;
  }
}

/** Creates the detector outside the frame worklet and captures its plugin handle. */
export async function createFitTrackMultiPoseSession(): Promise<FitTrackMultiPoseSessionResult> {
  const nativeModule = readNativeModule();
  if (!nativeModule?.isAvailable || !nativeModule.createSession) {
    return {
      error: nativeError(
        "module_unavailable",
        "Subject tracking requires a new mobile build.",
        "Subject tracking requires a new mobile build.",
      ),
      session: null,
    };
  }

  let available: boolean;
  try {
    available = nativeModule.isAvailable();
    if (available !== true) {
      return {
        error: nativeError(
          "native_bridge_unavailable",
          "Subject tracking is unavailable in this mobile build.",
          "Subject tracking is unavailable in this mobile build.",
        ),
        session: null,
      };
    }
  } catch (error) {
    return {
      error: nativeError(
        "native_bridge_unavailable",
        error instanceof Error ? error.message : null,
        "Subject tracking could not reach the native module.",
      ),
      session: null,
    };
  }

  let sessionId: string;
  try {
    sessionId = await nativeModule.createSession();
  } catch (error) {
    const thrownCode =
      typeof error === "object" && error !== null
        ? (error as { code?: unknown; errorCode?: unknown }).code ??
          (error as { errorCode?: unknown }).errorCode
        : undefined;
    return {
      error: nativeError(
        thrownCode ?? "model_initialization_failed",
        error instanceof Error ? error.message : null,
        "Subject tracking could not initialize its pose model.",
        "model_initialization_failed",
      ),
      session: null,
    };
  }

  if (typeof sessionId !== "string" || sessionId.length === 0) {
    return {
      error: nativeError(
        "model_initialization_failed",
        null,
        "Subject tracking could not initialize its pose model.",
      ),
      session: null,
    };
  }

  let plugin: FrameProcessorPlugin | undefined;
  try {
    plugin = VisionCameraProxy.initFrameProcessorPlugin("fittrackMultiPose", {
      sessionId,
    });
  } catch {
    plugin = undefined;
  }
  if (!plugin) {
    try {
      await nativeModule.releaseSession?.(sessionId);
    } catch {
      // The native registry remains bounded and will release on teardown.
    }
    return {
      error: nativeError(
        "plugin_unavailable",
        "Subject tracking could not initialize its frame processor.",
        "Subject tracking could not initialize its frame processor.",
      ),
      session: null,
    };
  }
  return { error: null, session: { plugin, sessionId } };
}

/** Release is JS-only and idempotent at the native registry boundary. */
export function releaseFitTrackMultiPoseSession(
  session: FitTrackMultiPoseSession | null | undefined,
): Promise<void> {
  if (!session) return Promise.resolve();
  try {
    return Promise.resolve(
      readNativeModule()?.releaseSession?.(session.sessionId),
    ).then(() => undefined, () => undefined);
  } catch {
    // Native teardown is also bounded by module lifecycle cleanup.
  }
  return Promise.resolve();
}

function normalizeResult(value: unknown): FitTrackMultiPoseDetection {
  "worklet";
  if (!value || typeof value !== "object") {
    return {
      error: nativeError(
        "inference_failed",
        "Subject tracking returned no native result.",
        "Subject tracking returned no native result.",
      ),
      status: "error",
    };
  }
  const payload = value as MultiPosePluginResult;
  if (payload.status === "error") {
    return {
      error: nativeError(
        payload.code,
        payload.message,
        "Subject tracking inference failed.",
      ),
      status: "error",
    };
  }
  if (payload.status !== "ok" || !Array.isArray(payload.candidates)) {
    return {
      error: nativeError(
        "inference_failed",
        "Subject tracking returned an invalid native result.",
        "Subject tracking returned an invalid native result.",
      ),
      status: "error",
    };
  }
  const candidates = payload.candidates.slice(0, 3).flatMap((candidate) => {
    if (
      !Array.isArray(candidate.keypoints) ||
      candidate.keypoints.length !== 33
    ) {
      return [];
    }
    const keypoints = candidate.keypoints.map((point) => ({
      visibility:
        typeof point.visibility === "number" && Number.isFinite(point.visibility)
          ? Math.max(0, Math.min(1, point.visibility))
          : 0,
      x: typeof point.x === "number" && Number.isFinite(point.x) ? point.x : 0,
      y: typeof point.y === "number" && Number.isFinite(point.y) ? point.y : 0,
      z: typeof point.z === "number" && Number.isFinite(point.z) ? point.z : 0,
    }));
    const spatialKeypoints = candidate.spatialKeypoints?.length === 33 &&
      candidate.spatialKeypoints.every(point =>
        Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z))
      ? candidate.spatialKeypoints.map((point, index) => ({ ...point, visibility: keypoints[index].visibility }))
      : undefined;
    return [{ confidence: candidate.confidence, keypoints, spatialKeypoints }];
  });
  return { candidates, status: "ok" };
}

/** Worklet path accepts only the plugin captured by createFitTrackMultiPoseSession. */
export function detectFitTrackMultiPose(
  frame: Frame,
  plugin: FrameProcessorPlugin | null,
  sessionId: string,
): FitTrackMultiPoseDetection {
  "worklet";
  if (!plugin) {
    return {
      error: nativeError(
        "session_closed",
        "Subject tracking session is closed.",
        "Subject tracking session is closed.",
      ),
      status: "error",
    };
  }
  try {
    return normalizeResult(plugin.call(frame, { sessionId }));
  } catch {
    return {
      error: nativeError(
        "inference_failed",
        "Subject tracking inference failed.",
        "Subject tracking inference failed.",
      ),
      status: "error",
    };
  }
}
