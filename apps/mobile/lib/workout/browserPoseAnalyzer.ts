import { Platform } from "react-native";

import type { PoseSequenceFrameRecord } from "@fittrack/types";

type BrowserCameraFacingMode = "user" | "environment";
type BrowserPoseFrame = PoseSequenceFrameRecord & {
  isReliable: boolean;
  visibleLandmarkCount: number;
};

type BrowserDocumentLike = {
  querySelectorAll: (selector: string) => ArrayLike<unknown>;
};

type BrowserVideoTrackLike = {
  getSettings?: () => { facingMode?: string | undefined };
};

type BrowserMediaStreamLike = {
  getVideoTracks?: () => BrowserVideoTrackLike[];
};

type BrowserVideoElementLike = {
  currentTime?: number;
  readyState?: number;
  srcObject?: BrowserMediaStreamLike | null;
  videoHeight?: number;
  videoWidth?: number;
};

type MediaPipeLandmark = {
  presence?: number;
  visibility?: number;
  x: number;
  y: number;
  z: number;
};

type MediaPipePoseResult = {
  landmarks?: MediaPipeLandmark[][];
};

type MediaPipePoseLandmarker = {
  close?: () => void;
  detectForVideo: (video: unknown, timestampMs: number) => MediaPipePoseResult;
};

type MediaPipeVisionModule = {
  FilesetResolver: {
    forVisionTasks: (wasmRoot: string) => Promise<unknown>;
  };
  PoseLandmarker: {
    createFromOptions: (
      filesetResolver: unknown,
      options: Record<string, unknown>
    ) => Promise<MediaPipePoseLandmarker>;
  };
};

export type BrowserPoseAnalyzer = {
  dispose: () => void;
  getFacingMode: () => BrowserCameraFacingMode;
  readFrame: () => Promise<BrowserPoseFrame | null>;
};

const MEDIAPIPE_LOCAL_MODULE_PATH = "/vendor/mediapipe/tasks-vision/vision_bundle.mjs";
const MEDIAPIPE_LOCAL_WASM_ROOT = "/vendor/mediapipe/tasks-vision/wasm";
const MEDIAPIPE_LOCAL_MODEL_PATH = "/vendor/mediapipe/tasks-vision/pose_landmarker_lite.task";
const MEDIAPIPE_REMOTE_MODULE_URLS = [
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs",
  "https://unpkg.com/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs"
] as const;
const MEDIAPIPE_REMOTE_WASM_ROOTS = [
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
  "https://unpkg.com/@mediapipe/tasks-vision@0.10.14/wasm"
] as const;
const MEDIAPIPE_POSE_MODEL_URLS = [
  resolveBrowserUrl(MEDIAPIPE_LOCAL_MODEL_PATH),
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
] as const;
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
const MEDIAPIPE_IGNORED_LOG_PATTERNS = [
  /INFO:\s*Created TensorFlow Lite XNNPACK delegate for CPU\./i,
  /Feedback manager requires a model with a single signature inference\./i,
  /OpenGL error checking is disabled/i
] as const;

let visionModulePromise: Promise<MediaPipeVisionModule> | null = null;
let filesetPromise: Promise<unknown> | null = null;
let loadedWasmRootPromise: Promise<string> | null = null;

function getBrowserDocument() {
  return (globalThis as typeof globalThis & { document?: BrowserDocumentLike }).document ?? null;
}

function getBrowserOrigin() {
  return (globalThis as typeof globalThis & { location?: { origin?: string } }).location?.origin ?? "";
}

function resolveBrowserUrl(path: string) {
  const origin = getBrowserOrigin();
  if (!origin) return path;
  return new URL(path, origin).toString();
}

function getActiveVideoElement() {
  const document = getBrowserDocument();
  if (!document) return null;

  const candidates = Array.from(document.querySelectorAll("video") ?? []);
  return (
    candidates.find((candidate) => {
      const video = candidate as BrowserVideoElementLike;
      return (
        typeof video.readyState === "number" &&
        video.readyState >= 2 &&
        typeof video.videoWidth === "number" &&
        video.videoWidth > 0 &&
        typeof video.videoHeight === "number" &&
        video.videoHeight > 0
      );
    }) ?? null
  ) as BrowserVideoElementLike | null;
}

function getFacingModeFromVideo(video: BrowserVideoElementLike | null): BrowserCameraFacingMode {
  const facingMode =
    video?.srcObject?.getVideoTracks?.()[0]?.getSettings?.()?.facingMode?.toLowerCase() ?? "";
  return facingMode === "user" ? "user" : "environment";
}

async function importRemoteVisionModule(moduleUrl: string) {
  const dynamicImport = new Function(
    "specifier",
    "return import(specifier);"
  ) as (specifier: string) => Promise<MediaPipeVisionModule>;

  return dynamicImport(moduleUrl);
}

async function loadVisionModule() {
  if (!visionModulePromise) {
    visionModulePromise = (async () => {
      let lastError: unknown = null;
      const moduleUrls = [
        resolveBrowserUrl(MEDIAPIPE_LOCAL_MODULE_PATH),
        ...MEDIAPIPE_REMOTE_MODULE_URLS
      ];

      for (const moduleUrl of moduleUrls) {
        try {
          return await importRemoteVisionModule(moduleUrl);
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError ?? new Error("Unable to load the MediaPipe browser module.");
    })();
  }

  return visionModulePromise;
}

async function loadFilesetResolver(visionModule: MediaPipeVisionModule) {
  if (!filesetPromise || !loadedWasmRootPromise) {
    filesetPromise = (async () => {
      let lastError: unknown = null;
      const wasmRoots = [
        resolveBrowserUrl(MEDIAPIPE_LOCAL_WASM_ROOT),
        ...MEDIAPIPE_REMOTE_WASM_ROOTS
      ];

      for (const wasmRoot of wasmRoots) {
        try {
          const resolver = await visionModule.FilesetResolver.forVisionTasks(wasmRoot);
          loadedWasmRootPromise = Promise.resolve(wasmRoot);
          return resolver;
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError ?? new Error("Unable to load the MediaPipe WASM assets.");
    })();
  }

  return filesetPromise;
}

function isFiniteLandmarkValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPoseKeypoint(
  value: { visibility: number; x: number; y: number; z: number } | null
): value is { visibility: number; x: number; y: number; z: number } {
  return value !== null;
}

function summarizePoseReliability(keypoints: PoseSequenceFrameRecord["keypoints"]) {
  const visibleLandmarkCount = keypoints.filter((keypoint) => keypoint.visibility >= 0.45).length;
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

function normalizeConsoleMessagePart(value: unknown) {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function shouldIgnoreMediaPipeConsoleMessage(args: unknown[]) {
  const message = args.map(normalizeConsoleMessagePart).join(" ");
  return MEDIAPIPE_IGNORED_LOG_PATTERNS.some((pattern) => pattern.test(message));
}

async function withMediaPipeConsoleFilter<T>(work: () => Promise<T> | T) {
  const consoleLike = globalThis.console;
  if (!consoleLike) {
    return await work();
  }

  const originalError = consoleLike.error?.bind(consoleLike);
  const originalWarn = consoleLike.warn?.bind(consoleLike);

  if (originalError) {
    consoleLike.error = (...args: unknown[]) => {
      if (shouldIgnoreMediaPipeConsoleMessage(args)) {
        return;
      }
      originalError(...args);
    };
  }

  if (originalWarn) {
    consoleLike.warn = (...args: unknown[]) => {
      if (shouldIgnoreMediaPipeConsoleMessage(args)) {
        return;
      }
      originalWarn(...args);
    };
  }

  try {
    return await work();
  } finally {
    if (originalError) {
      consoleLike.error = originalError;
    }
    if (originalWarn) {
      consoleLike.warn = originalWarn;
    }
  }
}

function toKeypoints(landmarks: MediaPipeLandmark[] | undefined) {
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
      z: landmark.z
    };
  });

  if (keypoints.some((point) => point === null)) return null;
  return keypoints.filter(isPoseKeypoint);
}

export async function createBrowserPoseAnalyzer(): Promise<BrowserPoseAnalyzer> {
  if (Platform.OS !== "web") {
    throw new Error("Live pose tracking currently ships on Expo web only.");
  }

  const visionModule = await loadVisionModule();
  const filesetResolver = await loadFilesetResolver(visionModule);
  const landmarker = await withMediaPipeConsoleFilter(() =>
    visionModule.PoseLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: MEDIAPIPE_POSE_MODEL_URLS[0]
      },
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      numPoses: 1,
      outputSegmentationMasks: false,
      runningMode: "VIDEO"
    })
  );

  return {
    dispose() {
      landmarker.close?.();
    },
    getFacingMode() {
      return getFacingModeFromVideo(getActiveVideoElement());
    },
    async readFrame() {
      const video = getActiveVideoElement();
      if (!video) return null;

      const timestampMs =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Math.max(0, (video.currentTime ?? 0) * 1000);

      const result = await withMediaPipeConsoleFilter(() =>
        landmarker.detectForVideo(video, timestampMs)
      );
      const keypoints = toKeypoints(result.landmarks?.[0]);
      if (!keypoints) return null;
      const { isReliable, visibleLandmarkCount } = summarizePoseReliability(keypoints);

      return {
        capturedAtMs: Date.now(),
        isReliable,
        keypoints,
        visibleLandmarkCount,
      };
    }
  };
}
