"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CircleAlert,
  Keyboard,
  QrCode,
  ScanLine,
  SwitchCamera,
} from "lucide-react";

import FitButton from "@/components/fit/FitButton";
import { FitText, FitTextInput } from "@/components/fit/FitText";
import { FitModal } from "@/components/modals";
import { useTheme } from "@/contexts/ThemeContext";

type ZXingReadResult = {
  text?: string | null;
};

type ZXingReaderModule = {
  prepareZXingModule: (options: {
    overrides?: {
      locateFile?: (path: string, prefix: string) => string;
    };
    fireImmediately?: boolean;
  }) => Promise<unknown> | void;
  readBarcodes: (
    imageData: ImageData,
    options: {
      formats: string[];
      maxNumberOfSymbols: number;
      tryHarder?: boolean;
      tryDownscale?: boolean;
      tryRotate?: boolean;
      tryInvert?: boolean;
    },
  ) => Promise<ZXingReadResult[]>;
};

declare global {
  interface Window {
    ZXingWASM?: ZXingReaderModule;
    __fittrackZxingReaderLoader?: Promise<ZXingReaderModule>;
    __fittrackZxingReaderPrepared?: Promise<ZXingReaderModule>;
  }
}

export type AttendanceScanFeedback = {
  tone: "success" | "warning" | "error";
  title: string;
  detail?: string;
};

type CameraDevice = {
  deviceId: string;
  label: string;
};

type Props = {
  isOpen: boolean;
  isSubmitting: boolean;
  feedback?: AttendanceScanFeedback | null;
  onClearFeedback?: () => void;
  onClose: () => void;
  onSubmitToken: (token: string) => Promise<void> | void;
};

const DETECTION_INTERVAL_MS = 220;
const DUPLICATE_SCAN_WINDOW_MS = 4000;
const POST_SCAN_PAUSE_MS = 1800;
const SCANNER_RUNTIME_TIMEOUT_MS = 5000;
const ZXING_READER_SCRIPT_PATH = "/vendor/zxing/reader/index.js";
const ZXING_READER_WASM_PATH = "/vendor/zxing/reader/zxing_reader.wasm";

function getFeedbackColors(
  tone: AttendanceScanFeedback["tone"],
  colors: ReturnType<typeof useTheme>["colors"],
) {
  switch (tone) {
    case "success":
      return {
        background: `${colors.success}12`,
        border: `${colors.success}40`,
        text: colors.success,
      };
    case "warning":
      return {
        background: `${colors.warning}12`,
        border: `${colors.warning}40`,
        text: colors.warning,
      };
    default:
      return {
        background: `${colors.danger}12`,
        border: `${colors.danger}40`,
        text: colors.danger,
      };
  }
}

function normalizeCameraLabel(device: MediaDeviceInfo, index: number) {
  const label = device.label?.trim();
  if (label) return label;
  return index === 0 ? "Default camera" : `Camera ${index + 1}`;
}

function sortCameraDevices(devices: MediaDeviceInfo[]) {
  return devices
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: normalizeCameraLabel(device, index),
    }))
    .sort((left, right) => {
      const leftScore = /(rear|back|environment)/i.test(left.label) ? 0 : 1;
      const rightScore = /(rear|back|environment)/i.test(right.label) ? 0 : 1;
      return leftScore - rightScore;
    });
}

function buildCameraConstraints(selectedDeviceId?: string) {
  if (selectedDeviceId) {
    return {
      deviceId: { exact: selectedDeviceId },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    };
  }

  return {
    facingMode: { ideal: "environment" },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  };
}

function withScannerTimeout<T>(promise: Promise<T>, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(message));
    }, SCANNER_RUNTIME_TIMEOUT_MS);

    promise
      .then(resolve, reject)
      .finally(() => {
        window.clearTimeout(timeoutId);
      });
  });
}

export default function AttendanceScanModal({
  isOpen,
  isSubmitting,
  feedback,
  onClearFeedback,
  onClose,
  onSubmitToken,
}: Props) {
  const { colors } = useTheme();
  const [cameraState, setCameraState] = useState<
    "idle" | "starting" | "ready" | "unsupported" | "error"
  >("idle");
  const [cameraMessage, setCameraMessage] = useState("");
  const [manualToken, setManualToken] = useState("");
  const [cameraDevices, setCameraDevices] = useState<CameraDevice[]>([]);
  const [requestedDeviceId, setRequestedDeviceId] = useState("");
  const [activeDeviceId, setActiveDeviceId] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const isSubmittingRef = useRef(isSubmitting);
  const recentScanRef = useRef<{ token: string; at: number } | null>(null);
  const pauseUntilRef = useRef(0);
  const onSubmitTokenRef = useRef(onSubmitToken);
  const onClearFeedbackRef = useRef(onClearFeedback);

  const attachStreamToVideo = useCallback(
    (video: HTMLVideoElement | null) => {
      if (!video || cameraState !== "ready" || !streamRef.current) return;
      video.srcObject = streamRef.current;
      void video.play().catch(() => undefined);
    },
    [cameraState],
  );

  const handleVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      attachStreamToVideo(node);
    },
    [attachStreamToVideo],
  );

  useEffect(() => {
    const video = videoRef.current;
    attachStreamToVideo(video);

    return () => {
      if (video && streamRef.current && video.srcObject === streamRef.current) {
        video.pause();
        video.srcObject = null;
      }
    };
  }, [attachStreamToVideo]);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  useEffect(() => {
    onSubmitTokenRef.current = onSubmitToken;
  }, [onSubmitToken]);

  useEffect(() => {
    onClearFeedbackRef.current = onClearFeedback;
  }, [onClearFeedback]);

  useEffect(() => {
    let cancelled = false;

    const cleanup = () => {
      cancelled = true;

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;

      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
    };

    if (!isOpen) {
      cleanup();
      setCameraState("idle");
      setCameraMessage("");
      setManualToken("");
      setCameraDevices([]);
      setActiveDeviceId("");
      pauseUntilRef.current = 0;
      return cleanup;
    }

    onClearFeedbackRef.current?.();
    setCameraState("starting");
    setCameraMessage("Opening the front-desk camera for live QR scanning...");

    const scheduleNext = (delay = DETECTION_INTERVAL_MS, callback: () => void) => {
      if (cancelled) return;
      timerRef.current = window.setTimeout(callback, delay);
    };

    const loadScanner = async (): Promise<ZXingReaderModule> => {
      if (!window.__fittrackZxingReaderLoader) {
        window.__fittrackZxingReaderLoader = new Promise<ZXingReaderModule>(
          (resolve, reject) => {
            if (window.ZXingWASM) {
              resolve(window.ZXingWASM);
              return;
            }

            document
              .querySelectorAll<HTMLScriptElement>(
                'script[data-fittrack-zxing="reader"]',
              )
              .forEach((scriptNode) => {
                scriptNode.remove();
              });

            const script = document.createElement("script");
            script.async = true;
            script.dataset.fittrackZxing = "reader";
            script.src = ZXING_READER_SCRIPT_PATH;
            script.onload = () => {
              if (window.ZXingWASM) {
                resolve(window.ZXingWASM);
                return;
              }

              window.__fittrackZxingReaderLoader = undefined;
              reject(
                new Error("ZXing reader loaded without exposing the decoder API."),
              );
            };
            script.onerror = () => {
              window.__fittrackZxingReaderLoader = undefined;
              reject(new Error("Unable to load the QR scanner runtime."));
            };

            document.head.appendChild(script);
          },
        );
      }

      if (!window.__fittrackZxingReaderPrepared) {
        window.__fittrackZxingReaderPrepared = withScannerTimeout(
          window.__fittrackZxingReaderLoader
            .then(async (scannerModule) => {
              await scannerModule.prepareZXingModule({
                overrides: {
                  locateFile: (path, prefix) =>
                    path.endsWith(".wasm")
                      ? ZXING_READER_WASM_PATH
                      : `${prefix}${path}`,
                },
                fireImmediately: true,
              });

              return scannerModule;
            }),
          "QR scanner runtime timed out. Use the paste field below, then refresh the page before trying camera scan again.",
        ).catch((error) => {
          window.__fittrackZxingReaderPrepared = undefined;
          throw error;
        });
      }

      return window.__fittrackZxingReaderPrepared;
    };

    const syncCameraDevices = async (preferredDeviceId?: string) => {
      if (!navigator.mediaDevices?.enumerateDevices) return;

      const devices = await navigator.mediaDevices.enumerateDevices();
      if (cancelled) return;

      const videoInputs = sortCameraDevices(
        devices.filter((device) => device.kind === "videoinput"),
      );
      setCameraDevices(videoInputs);

      if (!requestedDeviceId) {
        const preferredDevice =
          preferredDeviceId ||
          videoInputs[0]?.deviceId ||
          "";
        if (preferredDevice) {
          setActiveDeviceId(preferredDevice);
        }
      }
    };

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState("unsupported");
        setCameraMessage(
          "This browser cannot access a camera for live QR scanning. Use Chrome or Edge on desktop, or paste the QR code value below.",
        );
        return;
      }

      try {
        const scanner = await loadScanner();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: buildCameraConstraints(requestedDeviceId || undefined),
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const trackDeviceId =
          stream.getVideoTracks()[0]?.getSettings?.()?.deviceId ?? "";

        await syncCameraDevices(trackDeviceId);
        if (cancelled) return;

        if (trackDeviceId) {
          setActiveDeviceId(trackDeviceId);
        }

        setCameraState("ready");
        setCameraMessage(
          "Point the laptop camera at the QR shown on the member phone. Manual paste stays available below.",
        );

        const detectFrame = async () => {
          if (cancelled) return;

          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (!video || !canvas) {
            scheduleNext(DETECTION_INTERVAL_MS, () => {
              void detectFrame();
            });
            return;
          }

          if (
            isSubmittingRef.current ||
            Date.now() < pauseUntilRef.current ||
            video.readyState < 2 ||
            video.videoWidth === 0 ||
            video.videoHeight === 0
          ) {
            scheduleNext(140, () => {
              void detectFrame();
            });
            return;
          }

          const context = canvas.getContext("2d", {
            willReadFrequently: true,
          });

          if (!context) {
            setCameraState("error");
            setCameraMessage(
              "Camera preview is available, but the browser could not prepare the QR decoder. Use manual paste below.",
            );
            return;
          }

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);

          try {
            const imageData = context.getImageData(
              0,
              0,
              canvas.width,
              canvas.height,
            );
            const results = await scanner.readBarcodes(imageData, {
              formats: ["QRCode"],
              maxNumberOfSymbols: 1,
              tryHarder: true,
              tryDownscale: true,
              tryRotate: true,
              tryInvert: true,
            });
            const token = results.find((result) => result.text?.trim())?.text?.trim();

            if (token) {
              const now = Date.now();
              const recent = recentScanRef.current;
              if (
                !recent ||
                recent.token !== token ||
                now - recent.at > DUPLICATE_SCAN_WINDOW_MS
              ) {
                recentScanRef.current = { token, at: now };
                pauseUntilRef.current = now + POST_SCAN_PAUSE_MS;
                await onSubmitTokenRef.current(token);
              }
            }
          } catch {
            // Ignore transient frame decode failures while the camera refocuses on the phone screen.
          }

          scheduleNext(DETECTION_INTERVAL_MS, () => {
            void detectFrame();
          });
        };

        scheduleNext(160, () => {
          void detectFrame();
        });
      } catch (error) {
        const detail =
          error instanceof Error
            ? error.message
            : "Camera access was denied.";
        setCameraState("error");
        setCameraMessage(
          `Camera access failed. ${detail} Use Chrome or Edge and allow camera access, or paste the QR code value below.`,
        );
      }
    };

    void startCamera();

    return cleanup;
  }, [isOpen, requestedDeviceId]);

  const handleManualSubmit = async () => {
    const trimmed = manualToken.trim();
    if (!trimmed) return;
    await onSubmitToken(trimmed);
    setManualToken("");
  };

  const feedbackColors = feedback
    ? getFeedbackColors(feedback.tone, colors)
    : null;
  const scanHint =
    cameraState === "ready"
      ? "Live scan is active. Keep the member phone inside the frame, or paste the QR token below if glare blocks the camera."
      : "If the desk camera is unavailable, paste the QR token below to use the same attendance check-in path.";

  return (
    <FitModal
      isOpen={isOpen}
      onClose={onClose}
      title="Scan attendance"
      subtitle="Scan the QR shown on the member phone. Manual paste stays available if glare or camera access blocks the live view."
      icon={ScanLine}
      maxWidth={620}
      noScroll
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            minHeight: 300,
            borderRadius: 18,
            border: `1px solid ${colors.border}`,
            background: cameraState === "ready" ? "#080808" : colors.surface,
          }}
        >
          {cameraState === "ready" ? (
            <>
              <video
                ref={handleVideoRef}
                muted
                playsInline
                autoPlay
                style={{
                  width: "100%",
                  height: 300,
                  objectFit: "cover",
                  display: "block",
                }}
              />
              <canvas ref={canvasRef} style={{ display: "none" }} />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    width: 220,
                    height: 220,
                    borderRadius: 28,
                    border: `2px solid ${colors.success}`,
                    boxShadow: "0 0 0 999px rgba(8, 8, 8, 0.24)",
                  }}
                />
              </div>
            </>
          ) : (
            <div
              style={{
                minHeight: 300,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: 24,
                textAlign: "center",
              }}
            >
              <Camera size={26} color={colors.textMuted} />
              <FitText
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: colors.textPrimary,
                }}
              >
                {cameraState === "starting"
                  ? "Preparing camera scan..."
                  : cameraState === "unsupported"
                    ? "Camera scan unavailable"
                    : cameraState === "error"
                      ? "Camera access failed"
                      : "Camera scan paused"}
              </FitText>
              <FitText
                style={{
                  fontSize: 13,
                  color: colors.textMuted,
                  maxWidth: 420,
                }}
              >
                {cameraMessage}
              </FitText>
            </div>
          )}
        </div>

        {cameraDevices.length > 0 ? (
          <div
            style={{
              display: "grid",
              gap: 8,
              padding: 12,
              borderRadius: 14,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surface,
            }}
          >
            <FitText
              as="label"
              htmlFor="attendance_camera_source"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                fontWeight: 700,
                color: colors.textMuted,
                letterSpacing: "0.08em",
              }}
            >
              <SwitchCamera size={14} />
              CAMERA SOURCE
            </FitText>
            <select
              id="attendance_camera_source"
              value={activeDeviceId}
              onChange={(event) => {
                const nextDeviceId = event.target.value;
                setActiveDeviceId(nextDeviceId);
                setRequestedDeviceId(nextDeviceId);
              }}
              style={{
                minHeight: 42,
                borderRadius: 14,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surfaceRaised,
                color: colors.textPrimary,
                padding: "0 14px",
                fontSize: 14,
              }}
            >
              {cameraDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
            borderRadius: 14,
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.surface,
          }}
        >
          <QrCode size={16} color={colors.brand} />
          <FitText style={{ fontSize: 13, color: colors.textMuted }}>
            {scanHint}
          </FitText>
        </div>

        {feedback && feedbackColors ? (
          <div
            style={{
              display: "grid",
              gap: 4,
              padding: 12,
              borderRadius: 14,
              border: `1px solid ${feedbackColors.border}`,
              backgroundColor: feedbackColors.background,
            }}
          >
            <FitText
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                fontWeight: 700,
                color: feedbackColors.text,
              }}
            >
              <CircleAlert size={14} />
              {feedback.title}
            </FitText>
            {feedback.detail ? (
              <FitText style={{ fontSize: 13, color: colors.textMuted }}>
                {feedback.detail}
              </FitText>
            ) : null}
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gap: 10,
            padding: 14,
            borderRadius: 16,
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.surface,
          }}
        >
          <FitText
            as="label"
            htmlFor="attendance_qr_token"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              fontWeight: 700,
              color: colors.textMuted,
              letterSpacing: "0.08em",
            }}
          >
            <Keyboard size={14} />
            PASTE QR CODE VALUE
          </FitText>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 8,
            }}
          >
            <FitTextInput
              id="attendance_qr_token"
              name="attendance_qr_token"
              value={manualToken}
              onChange={(event) => setManualToken(event.target.value)}
              placeholder="Paste the QR code value if live camera scanning is unavailable"
              style={{
                minHeight: 44,
                borderRadius: 14,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surface,
                padding: "0 14px",
              }}
            />
            <FitButton
              variant="primary"
              label="SUBMIT QR"
              loading={isSubmitting}
              disabled={isSubmitting || !manualToken.trim()}
              onClick={() => {
                void handleManualSubmit();
              }}
            />
          </div>
          <FitText style={{ fontSize: 12, color: colors.textMuted }}>
            Keep this modal open for continuous front-desk scanning. Camera scan and manual paste use the same attendance check-in path.
          </FitText>
        </div>
      </div>
    </FitModal>
  );
}
