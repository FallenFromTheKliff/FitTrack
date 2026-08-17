import { useMemo } from "react";
import { Modal, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { Clock3, Copy, QrCode, RefreshCw, ShieldX } from "lucide-react-native";
import Svg, { Path, Rect } from "react-native-svg";

import type { AttendanceQrCodeRecord } from "@fittrack/types";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { AnimatedFitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitModalScrollView from "@/components/modals/shared/FitModalScrollView";

type Props = {
  attendanceQr: AttendanceQrCodeRecord | null;
  countdownLabel: string;
  errorMessage?: string | null;
  isRefreshing: boolean;
  isLoading: boolean;
  isVisible: boolean;
  onClose: () => void;
  onCopy: () => void;
  onRefresh: () => void;
  refreshDisabled: boolean;
  refreshLabel: string;
};

type ToQrEncoder = (content: string | Uint8Array) => Uint8Array;
type TextEncoderLikeConstructor = new () => {
  encode(value?: string): Uint8Array;
};

let lazyToQr: ToQrEncoder | null = null;
const QR_RENDER_SIZE = 220;
const QR_QUIET_ZONE = 4;

function encodeUtf8(value = "") {
  const bytes: number[] = [];

  for (let index = 0; index < value.length; index += 1) {
    let codePoint = value.codePointAt(index) ?? 0;

    if (codePoint > 0xffff) {
      index += 1;
    }

    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f)
      );
    } else {
      codePoint = Math.min(codePoint, 0x10ffff);
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f)
      );
    }
  }

  return Uint8Array.from(bytes);
}

function ensureTextEncoder() {
  const runtimeGlobal = globalThis as unknown as {
    TextEncoder?: TextEncoderLikeConstructor;
  };

  if (!runtimeGlobal.TextEncoder) {
    runtimeGlobal.TextEncoder = class FitTrackTextEncoder {
      encode(value = "") {
        return encodeUtf8(value);
      }
    };
  }
}

function getToQrEncoder() {
  if (!lazyToQr) {
    ensureTextEncoder();
    lazyToQr = (require("toqr") as { toQR: ToQrEncoder }).toQR;
  }

  return lazyToQr;
}

function buildQrMatrix(value: string) {
  try {
    const matrix = getToQrEncoder()(value);
    const dimension = Math.sqrt(matrix.length);

    if (!Number.isInteger(dimension) || dimension <= 0) {
      return null;
    }

    return { dimension, matrix };
  } catch {
    return null;
  }
}

function buildQrPath(matrix: Uint8Array, dimension: number) {
  const commands: string[] = [];

  for (let rowIndex = 0; rowIndex < dimension; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < dimension; columnIndex += 1) {
      if (matrix[rowIndex * dimension + columnIndex] === 1) {
        commands.push(
          `M${columnIndex + QR_QUIET_ZONE} ${rowIndex + QR_QUIET_ZONE}h1v1h-1z`
        );
      }
    }
  }

  return commands.join("");
}

function AttendanceQrMatrix({ value }: { value: string }) {
  const qr = useMemo(() => buildQrMatrix(value), [value]);

  if (!qr) {
    return (
      <View
        style={{
          alignSelf: "stretch",
          borderRadius: 18,
          padding: 16,
          backgroundColor: "#FFFFFF",
        }}
      >
        <AnimatedFitText style={{ color: "#111111", fontSize: 13, fontWeight: "700", textAlign: "center" }}>
          QR renderer unavailable
        </AnimatedFitText>
      </View>
    );
  }

  const { dimension, matrix } = qr;
  const viewBoxSize = dimension + QR_QUIET_ZONE * 2;
  const pathData = buildQrPath(matrix, dimension);

  return (
    <View
      style={{
        alignSelf: "center",
        backgroundColor: "#FFFFFF",
        padding: 14,
        borderRadius: 20,
      }}
    >
      <Svg
        width={QR_RENDER_SIZE}
        height={QR_RENDER_SIZE}
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      >
        <Rect x="0" y="0" width={viewBoxSize} height={viewBoxSize} fill="#FFFFFF" />
        <Path d={pathData} fill="#111111" />
      </Svg>
    </View>
  );
}

export default function AttendanceQrModal({
  attendanceQr,
  countdownLabel,
  errorMessage,
  isRefreshing,
  isLoading,
  isVisible,
  onClose,
  onCopy,
  onRefresh,
  refreshDisabled,
  refreshLabel,
}: Props) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");
  const qrValue = attendanceQr?.qrValue ?? "";

  const backdropStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.overlay }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    backgroundColor: ic.value.surface,
    borderColor: ic.value.border,
  }));

  const isReady = Boolean(attendanceQr?.ready && qrValue);

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View
        style={[
          {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 18,
          },
          backdropStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              width: "100%",
              maxWidth: 420,
              maxHeight: "88%",
              borderRadius: 24,
              borderWidth: 1,
              overflow: "hidden",
            },
            cardStyle,
          ]}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingHorizontal: 18,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.surfaceRaised,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <QrCode size={18} color={colors.brand} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <AnimatedFitText style={{ fontSize: 17, fontWeight: "700", color: colors.textPrimary }}>
                Attendance QR
              </AnimatedFitText>
              <AnimatedFitText style={{ fontSize: 12, color: colors.textMuted }}>
                Live member QR for front-desk check-ins and attendance scans.
              </AnimatedFitText>
            </View>
          </View>

          <FitModalScrollView
            keyboardShouldPersistTaps="handled"
            bounces={false}
            contentContainerStyle={{ padding: 18, gap: 16 }}
            resetKey={isVisible}
          >
            {isLoading && !attendanceQr ? (
              <View
                style={{
                  padding: 18,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceRaised,
                  gap: 8,
                }}
              >
                <AnimatedFitText style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }}>
                  Loading your live QR...
                </AnimatedFitText>
                <AnimatedFitText style={{ fontSize: 13, color: colors.textMuted }}>
                  FitTrack is preparing the current rotating attendance code for this member account.
                </AnimatedFitText>
              </View>
            ) : isReady ? (
              <>
                <AttendanceQrMatrix value={qrValue} />
                <View
                  style={{
                    padding: 14,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceRaised,
                    gap: 10,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Clock3 size={15} color={colors.brand} strokeWidth={2} />
                    <AnimatedFitText style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}>
                      {countdownLabel}
                    </AnimatedFitText>
                  </View>
                  <AnimatedFitText style={{ fontSize: 12, color: colors.textMuted, lineHeight: 18 }}>
                    Refreshing issues a brand-new QR immediately and invalidates the previous code.
                  </AnimatedFitText>
                </View>
                <View
                  style={{
                    padding: 14,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceRaised,
                    gap: 8,
                  }}
                >
                  <AnimatedFitText style={{ fontSize: 11, fontWeight: "800", color: colors.textMuted }}>
                    MANUAL CHECK-IN VALUE
                  </AnimatedFitText>
                  <AnimatedFitText
                    style={{
                      fontSize: 12,
                      lineHeight: 18,
                      color: colors.textPrimary,
                      fontFamily: "monospace",
                    }}
                  >
                    {qrValue}
                  </AnimatedFitText>
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <FitButton
                    label="Copy QR Value"
                    variant="ghost"
                    icon={Copy}
                    onPress={onCopy}
                    flex={1}
                  />
                  <FitButton
                    label={refreshLabel}
                    variant="primary"
                    icon={RefreshCw}
                    onPress={onRefresh}
                    disabled={refreshDisabled}
                    loading={isRefreshing}
                    flex={1}
                  />
                </View>
              </>
            ) : (
              <View
                style={{
                  padding: 18,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: `${colors.warning}44`,
                  backgroundColor: `${colors.warning}12`,
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <ShieldX size={16} color={colors.warning} strokeWidth={2} />
                  <AnimatedFitText style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }}>
                    Attendance QR unavailable
                  </AnimatedFitText>
                </View>
                <AnimatedFitText style={{ fontSize: 13, lineHeight: 19, color: colors.textMuted }}>
                  {attendanceQr?.reason ??
                    errorMessage ??
                    "FitTrack could not generate a live attendance QR right now."}
                </AnimatedFitText>
                <FitButton
                  label="Refresh Status"
                  variant="ghost"
                  icon={RefreshCw}
                  onPress={onRefresh}
                />
              </View>
            )}
          </FitModalScrollView>

          <View
            style={{
              paddingHorizontal: 18,
              paddingVertical: 16,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <FitButton label="Close" variant="primary" onPress={onClose} style={{ width: "100%" }} />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
