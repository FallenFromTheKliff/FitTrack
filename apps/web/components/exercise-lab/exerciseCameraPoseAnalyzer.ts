import type {
  PoseKeypointRecord,
  PoseSequenceFrameRecord,
} from "@fittrack/types";
import type { PoseSubjectCandidate, PoseSubjectTrackingMode } from "@fittrack/utils";

type MediaPipeLandmark = {
  presence?: number;
  visibility?: number;
  x: number;
  y: number;
  z: number;
};

type MediaPipePoseResult = {
  landmarks?: MediaPipeLandmark[][];
  worldLandmarks?: MediaPipeLandmark[][];
};

type MediaPipePoseLandmarker = {
  close?: () => void;
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => MediaPipePoseResult;
};

type MediaPipeVisionModule = {
  FilesetResolver: {
    forVisionTasks: (wasmRoot: string) => Promise<unknown>;
  };
  PoseLandmarker: {
    createFromOptions: (
      filesetResolver: unknown,
      options: Record<string, unknown>,
    ) => Promise<MediaPipePoseLandmarker>;
  };
};

export type ExerciseCameraPoseFrame = PoseSequenceFrameRecord & {
  candidates: PoseSubjectCandidate[];
  frameHeight: number;
  frameWidth: number;
  isDuplicate: boolean;
  isReliable: boolean;
  visibleLandmarkCount: number;
};

export type ExerciseCameraPoseAnalyzer = {
  dispose: () => void;
  readFrame: () => Promise<ExerciseCameraPoseFrame | null>;
};

export type ExerciseCameraPoseAnalyzerOptions = {
  delegate?: "CPU" | "GPU";
  subjectTrackingMode?: PoseSubjectTrackingMode;
};

const MEDIAPIPE_LOCAL_MODULE_PATH =
  "/vendor/mediapipe/tasks-vision/vision_bundle.mjs";
const MEDIAPIPE_LOCAL_WASM_ROOT =
  "/vendor/mediapipe/tasks-vision/wasm";
const MEDIAPIPE_LOCAL_MODEL_PATH =
  "/vendor/mediapipe/tasks-vision/pose_landmarker_lite.task";

const MIN_RELIABLE_VISIBLE_LANDMARKS = 16;
const RELIABLE_CORE_LANDMARKS = [11, 12, 23, 24] as const;
const RELIABLE_SEGMENTS = [
  [13, 15],
  [14, 16],
  [25, 27],
  [26, 28],
  [27, 31],
  [28, 32],
] as const;

let visionModulePromise: Promise<MediaPipeVisionModule> | null = null;
let visionModuleRetryAttempt = 0;
let filesetResolverPromise: Promise<unknown> | null = null;

const MAX_VISION_MODULE_RETRY_VARIANTS = 8;
const MEDIAPIPE_XNNPACK_INFO_MESSAGE =
  "INFO: Created TensorFlow Lite XNNPACK delegate for CPU.";

type MediaPipeConsoleFilterLease = {
  consoleLike: Console;
  originalError: (...args: unknown[]) => void;
  originalInfo: ((...args: unknown[]) => void) | null;
  wrappedError: (...args: unknown[]) => void;
  activeScopes: number;
};

let mediaPipeConsoleFilterLease: MediaPipeConsoleFilterLease | null = null;

function resolveLocalAsset(path: string) {
  if (typeof window === "undefined" || !window.location.origin) return path;
  return new URL(path, window.location.origin).toString();
}

function importVisionModule(moduleUrl: string) {
  // Keep the local module runtime-only so Next does not try to bundle the WASM
  // files into the authoring route before a user opts into the camera.
  return import(/* webpackIgnore: true */ moduleUrl) as Promise<MediaPipeVisionModule>;
}

function getVisionModuleImportUrl(retryAttempt: number) {
  const moduleUrl = resolveLocalAsset(MEDIAPIPE_LOCAL_MODULE_PATH);
  if (retryAttempt === 0) return moduleUrl;
  const separator = moduleUrl.includes("?") ? "&" : "?";
  return `${moduleUrl}${separator}fittrack_retry=${retryAttempt}`;
}

async function loadVisionModule() {
  if (!visionModulePromise) {
    const retryAttempt = visionModuleRetryAttempt;
    const importPromise = importVisionModule(getVisionModuleImportUrl(retryAttempt));
    visionModulePromise = importPromise;
  }

  const currentPromise = visionModulePromise;
  if (!currentPromise) {
    throw new Error("Unable to start the browser pose model import.");
  }

  try {
    return await currentPromise;
  } catch (error) {
    // A transient local asset failure must not poison a later explicit retry.
    if (visionModulePromise === currentPromise) {
      visionModulePromise = null;
      visionModuleRetryAttempt = Math.min(
        visionModuleRetryAttempt + 1,
        MAX_VISION_MODULE_RETRY_VARIANTS,
      );
    }
    throw error;
  }
}

async function loadFilesetResolver(visionModule: MediaPipeVisionModule) {
  if (!filesetResolverPromise) {
    filesetResolverPromise = (async () => {
      return await visionModule.FilesetResolver.forVisionTasks(
        resolveLocalAsset(MEDIAPIPE_LOCAL_WASM_ROOT),
      );
    })();
  }

  const currentPromise = filesetResolverPromise;
  if (!currentPromise) {
    throw new Error("Unable to start the browser pose runtime.");
  }

  try {
    return await currentPromise;
  } catch (error) {
    if (filesetResolverPromise === currentPromise) {
      filesetResolverPromise = null;
    }
    throw error;
  }
}

function isKnownMediaPipeInfo(args: unknown[]) {
  return (
    args.length === 1 &&
    typeof args[0] === "string" &&
    args[0] === MEDIAPIPE_XNNPACK_INFO_MESSAGE
  );
}

function acquireMediaPipeConsoleFilter() {
  const consoleLike = globalThis.console;
  if (!consoleLike || typeof consoleLike.error !== "function") return null;

  const activeLease = mediaPipeConsoleFilterLease;
  if (
    activeLease?.consoleLike === consoleLike &&
    consoleLike.error === activeLease.wrappedError
  ) {
    activeLease.activeScopes += 1;
    return activeLease;
  }

  const originalError = consoleLike.error as (...args: unknown[]) => void;
  const originalInfo =
    typeof consoleLike.info === "function"
      ? (consoleLike.info as (...args: unknown[]) => void)
      : null;
  const wrappedError = (...args: unknown[]) => {
    if (isKnownMediaPipeInfo(args)) {
      originalInfo?.apply(consoleLike, args);
      return;
    }
    originalError.apply(consoleLike, args);
  };
  const nextLease: MediaPipeConsoleFilterLease = {
    consoleLike,
    originalError,
    originalInfo,
    wrappedError,
    activeScopes: 1,
  };

  try {
    consoleLike.error = wrappedError as typeof consoleLike.error;
  } catch {
    return null;
  }
  if (consoleLike.error !== wrappedError) return null;
  mediaPipeConsoleFilterLease = nextLease;
  return nextLease;
}

function releaseMediaPipeConsoleFilter(
  lease: MediaPipeConsoleFilterLease | null,
) {
  if (!lease) return;
  lease.activeScopes -= 1;
  if (lease.activeScopes > 0) return;

  if (mediaPipeConsoleFilterLease === lease) {
    if (lease.consoleLike.error === lease.wrappedError) {
      lease.consoleLike.error = lease.originalError as typeof lease.consoleLike.error;
    }
    mediaPipeConsoleFilterLease = null;
  }
}

async function withMediaPipeConsoleFilter<T>(work: () => Promise<T> | T) {
  const lease = acquireMediaPipeConsoleFilter();
  if (!lease) return await work();

  try {
    return await work();
  } finally {
    releaseMediaPipeConsoleFilter(lease);
  }
}

function isFiniteLandmarkValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toKeypoints(landmarks: MediaPipeLandmark[] | undefined): PoseKeypointRecord[] | null {
  if (!Array.isArray(landmarks) || landmarks.length !== 33) return null;

  const keypoints = landmarks.map((landmark) => {
    if (
      !isFiniteLandmarkValue(landmark.x) ||
      !isFiniteLandmarkValue(landmark.y) ||
      !isFiniteLandmarkValue(landmark.z)
    ) {
      return null;
    }

    const visibility = isFiniteLandmarkValue(landmark.visibility)
      ? landmark.visibility
      : isFiniteLandmarkValue(landmark.presence)
        ? landmark.presence
        : 0;

    return {
      visibility,
      x: landmark.x,
      y: landmark.y,
      z: landmark.z,
    } satisfies PoseKeypointRecord;
  });

  if (keypoints.some((point) => point === null)) return null;
  return keypoints as PoseKeypointRecord[];
}

function toCandidate(landmarks: MediaPipeLandmark[] | undefined) {
  const keypoints = toKeypoints(landmarks);
  if (!keypoints) return null;
  return {
    confidence:
      keypoints.reduce((sum, keypoint) => sum + keypoint.visibility, 0) /
      Math.max(1, keypoints.length),
    keypoints,
  };
}

function summarizeReliability(keypoints: PoseKeypointRecord[]) {
  const visibleLandmarkCount = keypoints.filter(
    (keypoint) => keypoint.visibility >= 0.45,
  ).length;
  const coreVisible = RELIABLE_CORE_LANDMARKS.every(
    (index) => (keypoints[index]?.visibility ?? 0) >= 0.35,
  );
  const visibleSegments = RELIABLE_SEGMENTS.filter(
    ([start, end]) =>
      (keypoints[start]?.visibility ?? 0) >= 0.3 &&
      (keypoints[end]?.visibility ?? 0) >= 0.3,
  ).length;

  return {
    isReliable:
      visibleLandmarkCount >= MIN_RELIABLE_VISIBLE_LANDMARKS &&
      coreVisible &&
      visibleSegments >= 2,
    visibleLandmarkCount,
  };
}

export async function createExerciseCameraPoseAnalyzer(
  video: HTMLVideoElement,
  options: ExerciseCameraPoseAnalyzerOptions = {},
): Promise<ExerciseCameraPoseAnalyzer> {
  const visionModule = await loadVisionModule();
  const filesetResolver = await loadFilesetResolver(visionModule);
  const subjectTrackingMode = options.subjectTrackingMode ?? "off";
  const createLandmarker = (delegate?: "CPU" | "GPU") =>
    withMediaPipeConsoleFilter(() =>
      visionModule.PoseLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          ...(delegate ? { delegate } : {}),
          modelAssetPath: resolveLocalAsset(MEDIAPIPE_LOCAL_MODEL_PATH),
        },
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        numPoses: subjectTrackingMode === "on" ? 3 : 1,
        outputSegmentationMasks: false,
        runningMode: "VIDEO",
      }),
    );
  let landmarker: MediaPipePoseLandmarker;
  try {
    landmarker = await createLandmarker(options.delegate ?? "GPU");
  } catch (error) {
    if ((options.delegate ?? "GPU") !== "GPU") throw error;
    landmarker = await createLandmarker("CPU");
  }
  let disposed = false;
  let lastDecodedTimeMs = Number.NEGATIVE_INFINITY;
  let lastFrame: ExerciseCameraPoseFrame | null = null;
  let lastDecodedHadNoPose = false;

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      landmarker.close?.();
    },
    async readFrame() {
      if (
        disposed ||
        video.readyState < 2 ||
        video.videoWidth <= 0 ||
        video.videoHeight <= 0
      ) {
        return null;
      }

      const decodedTimeMs = Number.isFinite(video.currentTime)
        ? video.currentTime * 1000
        : null;
      // Without the media clock there is no honest way to distinguish a new
      // decoded frame from a frozen one. Treat that input as unavailable
      // instead of inventing a fresh timestamp for every read.
      if (decodedTimeMs === null) return null;
      if (decodedTimeMs <= lastDecodedTimeMs) {
        return lastFrame && !lastDecodedHadNoPose
          ? { ...lastFrame, isDuplicate: true }
          : null;
      }

      const timestampMs =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Math.max(0, video.currentTime * 1000);
      const result = await withMediaPipeConsoleFilter(() =>
        landmarker.detectForVideo(video, timestampMs),
      );
      const candidates = (result.landmarks ?? [])
        .slice(0, subjectTrackingMode === "on" ? 3 : 1)
        .map((landmarks, index) => {
          const candidate = toCandidate(landmarks);
          const world = result.worldLandmarks?.[index];
          return candidate ? { ...candidate, spatialKeypoints: world?.length === 33 ? world.map((point, i) => ({
            x: point.x, y: point.y, z: point.z, visibility: candidate.keypoints[i]!.visibility,
          })) : undefined } : null;
        })
        .filter(candidate => candidate !== null);
      const keypoints = candidates[0]?.keypoints ?? null;
      lastDecodedTimeMs = decodedTimeMs;
      if (!keypoints || disposed) {
        lastDecodedHadNoPose = true;
        return null;
      }
      lastDecodedHadNoPose = false;
      const { isReliable, visibleLandmarkCount } = summarizeReliability(keypoints);

      const frame = {
        // Date.now() is sampled only for a newly decoded media timestamp.
        // Repeated timestamps return the cached frame above, so frozen input
        // cannot advance either the subject lock or movement engines.
        capturedAtMs: Date.now(),
        spatialKeypoints: candidates[0]?.spatialKeypoints,
        candidates,
        frameHeight: video.videoHeight,
        frameWidth: video.videoWidth,
        isDuplicate: false,
        isReliable,
        keypoints,
        visibleLandmarkCount,
      };
      lastFrame = frame;
      return frame;
    },
  };
}
