import { useMemo } from "react";
import { Modal, ScrollView, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { Clock3, Copy, QrCode, RefreshCw, ShieldX } from "lucide-react-native";
import { toQR } from "toqr";

import type { AttendanceQrCodeRecord } from "@fittrack/types";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { AnimatedFitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";

type Props = {
  attendanceQr: AttendanceQrCodeRecord | null;
  countdownLabel: string;
  isRefreshing: boolean;
  isLoading: boolean;
  isVisible: boolean;
  onClose: () => void;
  onCopy: () => void;
  onRefresh: () => void;
  refreshDisabled: boolean;
  refreshLabel: string;
};

function AttendanceQrMatrix({ value }: { value: string }) {
  const matrix = useMemo(() => toQR(value), [value]);
  const dimension = Math.sqrt(matrix.length);
  const cellSize = Math.max(4, Math.floor(196 / dimension));

  return (
    <View
      style={{
        alignSelf: "center",
        backgroundColor: "#FFFFFF",
        padding: 14,
        borderRadius: 20,
      }}
    >
      {Array.from({ length: dimension }, (_, rowIndex) => (
        <View key={`row-${rowIndex}`} style={{ flexDirection: "row" }}>
          {Array.from({ length: dimension }, (_, columnIndex) => {
            const isFilled = matrix[rowIndex * dimension + columnIndex] === 1;
            return (
              <View
                key={`cell-${rowIndex}-${columnIndex}`}
                style={{
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: isFilled ? "#111111" : "#FFFFFF",
                }}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

export default function AttendanceQrModal({
  attendanceQr,
  countdownLabel,
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

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{ padding: 18, gap: 16 }}
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
                  {attendanceQr?.reason ?? "This account does not currently have access to attendance QR check-in."}
                </AnimatedFitText>
                <FitButton
                  label="Refresh Status"
                  variant="ghost"
                  icon={RefreshCw}
                  onPress={onRefresh}
                />
              </View>
            )}
          </ScrollView>

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
