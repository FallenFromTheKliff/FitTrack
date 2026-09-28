import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useMemo, useState } from "react";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { CalendarDays, CreditCard, QrCode, X } from "lucide-react-native";

import type {
  MembershipCardRecord,
  MembershipFreeDayPassEligibilityRecord,
  MembershipPlanRecord,
  MembershipSubscriptionRecord,
} from "@fittrack/types";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { FitButton, FitText } from "@/components/fit";
import FitModalScrollView from "@/components/modals/shared/FitModalScrollView";

type Props = {
  card: MembershipCardRecord | null;
  cardPriceLabel: string;
  canPurchaseCard: boolean;
  currentMembership: MembershipSubscriptionRecord | null;
  freeDayPassEligibility: MembershipFreeDayPassEligibilityRecord | null;
  isPurchasePending: boolean;
  isVisible: boolean;
  onClose: () => void;
  onPurchaseCard: () => void;
  onPurchasePlan: (planId: string) => void;
  plans: MembershipPlanRecord[];
};

const MODAL_OUTER_PADDING = 16;
const MODAL_MAX_HEIGHT_RATIO = 0.92;

function formatPlanPrice(plan: MembershipPlanRecord) {
  const amount = Number(plan.price);
  if (!Number.isFinite(amount)) return `${plan.currency} ${plan.price}`;
  return `${plan.currency} ${amount.toLocaleString("en-PH")}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function remainingDays(expiresAt: string | null | undefined) {
  if (!expiresAt) return null;
  const timestamp = new Date(expiresAt).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.ceil((timestamp - Date.now()) / 86_400_000));
}

function cardStatusLabel(status: MembershipCardRecord["status"]) {
  switch (status) {
    case "pending_verification":
      return "Pending";
    case "active":
      return "Active";
    case "revoked":
      return "Revoked";
    default:
      return "No Card";
  }
}

export default function MembershipAccessModal({
  card,
  cardPriceLabel,
  canPurchaseCard,
  currentMembership,
  freeDayPassEligibility,
  isPurchasePending,
  isVisible,
  onClose,
  onPurchaseCard,
  onPurchasePlan,
  plans,
}: Props) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");
  const { height: windowHeight } = useWindowDimensions();
  const [overlayHeight, setOverlayHeight] = useState<number | null>(null);
  const usableViewportHeight = Math.max(
    0,
    (overlayHeight ?? windowHeight) - MODAL_OUTER_PADDING * 2,
  );
  const nativeMaxCardHeight =
    usableViewportHeight > 0
      ? usableViewportHeight * MODAL_MAX_HEIGHT_RATIO
      : undefined;
  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          alignItems: "center",
          backgroundColor: colors.overlay,
          flex: 1,
          justifyContent: "center",
          padding: 16,
        },
        card: {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: 20,
          borderWidth: 1,
          maxHeight: "92%",
          width: "100%",
          maxWidth: 560,
        },
        header: {
          alignItems: "center",
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
          flexDirection: "row",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: 18,
          paddingBottom: 14,
        },
        headerText: { flex: 1, gap: 3 },
        close: {
          alignItems: "center",
          borderColor: colors.border,
          borderRadius: 20,
          borderWidth: 1,
          height: 36,
          justifyContent: "center",
          marginLeft: 12,
          width: 36,
        },
        content: { paddingHorizontal: 20, paddingBottom: 20, paddingTop: 16 },
        section: { gap: 10, marginBottom: 18 },
        sectionTitle: { fontSize: 16, fontWeight: "800" },
        sectionHint: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
        surface: {
          backgroundColor: colors.surfaceRaised,
          borderColor: colors.border,
          borderRadius: 12,
          borderWidth: 1,
          gap: 7,
          padding: 14,
        },
        row: { alignItems: "center", flexDirection: "row", gap: 10 },
        rowText: { flex: 1, gap: 3 },
        label: { fontSize: 14, fontWeight: "700" },
        detail: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
        status: { fontSize: 12, fontWeight: "800" },
        planPrice: { fontSize: 15, fontWeight: "800" },
        planButton: { marginTop: 4 },
        freeSurface: {
          backgroundColor: `${colors.brand}12`,
          borderColor: `${colors.brand}55`,
          borderRadius: 12,
          borderWidth: 1,
          gap: 7,
          padding: 14,
        },
      }),
    [colors],
  );

  const handleOverlayLayout = (event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    if (nextHeight > 0) {
      setOverlayHeight((current) =>
        current === nextHeight ? current : nextHeight,
      );
    }
  };
  const cardStatus = card?.status ?? "none";
  const remaining = remainingDays(currentMembership?.expires_at);
  const freePassStatus = !freeDayPassEligibility
    ? "Checking..."
    : freeDayPassEligibility.eligible
      ? "Available"
      : freeDayPassEligibility.redeemed_at
        ? "Redeemed"
        : "Not available";
  const freePassStatusColor = !freeDayPassEligibility
    ? colors.textMuted
    : freeDayPassEligibility.eligible
      ? colors.success
      : colors.warning;

  const backdropStyle = useAnimatedStyle(() => ({
    backgroundColor: ic.value.overlay,
    opacity: opacity.value,
  }));
  const modalStyle = useAnimatedStyle(() => ({
    backgroundColor: ic.value.surface,
    borderColor: ic.value.border,
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const modalBody = (
    <Animated.View
      onLayout={Platform.OS === "web" ? undefined : handleOverlayLayout}
      style={[styles.overlay, backdropStyle]}
    >
      <Animated.View
        style={[
          styles.card,
          Platform.OS === "web"
            ? undefined
            : {
                flexShrink: 1,
                maxHeight: nativeMaxCardHeight,
                minHeight: 0,
              },
          modalStyle,
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <FitText style={{ fontSize: 22, fontWeight: "800" }}>
              Membership Access
            </FitText>
            <FitText style={styles.sectionHint}>
              Manage your app card and gym entry in one place.
            </FitText>
          </View>
          <Pressable
            accessibilityLabel="Close Membership Access"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.close}
          >
            <X color={colors.textSecondary} size={19} />
          </Pressable>
        </View>
        <FitModalScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          resetKey={isVisible}
        >
          <View style={styles.section}>
            <FitText style={styles.sectionTitle}>Membership Card</FitText>
            <View style={styles.surface}>
              <View style={styles.row}>
                <CreditCard color={colors.brand} size={22} />
                <View style={styles.rowText}>
                  <FitText style={styles.label}>Card status</FitText>
                  <FitText
                    style={[
                      styles.status,
                      { color: cardStatus === "active" ? colors.success : colors.textMuted },
                    ]}
                  >
                    {cardStatusLabel(cardStatus)}
                  </FitText>
                </View>
              </View>
              <FitText style={styles.detail}>
                Unlocks Brodigy and premium app features. An active card does not grant gym entry.
              </FitText>
              {canPurchaseCard ? (
                <FitButton
                  disabled={isPurchasePending}
                  label={`PAY WITH PAYMONGO · ${cardPriceLabel}`}
                  loading={isPurchasePending}
                  loadingLabel="OPENING CHECKOUT..."
                  onPress={onPurchaseCard}
                  style={styles.planButton}
                />
              ) : cardStatus === "pending_verification" ? (
                <FitText style={styles.detail}>
                  Your payment is being verified. This card will activate after PayMongo confirms it.
                </FitText>
              ) : cardStatus === "revoked" ? (
                <FitText style={styles.detail}>
                  This card remains on record. Ask the front desk to restore access.
                </FitText>
              ) : null}
            </View>
          </View>

          <View style={styles.section}>
            <FitText style={styles.sectionTitle}>Gym Membership Plans</FitText>
            {currentMembership ? (
              <View style={styles.surface}>
                <View style={styles.row}>
                  <CalendarDays color={colors.brand} size={22} />
                  <View style={styles.rowText}>
                    <FitText style={styles.label}>{currentMembership.plan.name}</FitText>
                    <FitText style={styles.detail}>
                      {formatDate(currentMembership.starts_at)} – {formatDate(currentMembership.expires_at)}
                      {remaining !== null ? ` · ${remaining} days remaining` : ""}
                    </FitText>
                  </View>
                  <FitText style={[styles.status, { color: colors.success }]}>Active</FitText>
                </View>
                <FitText style={styles.detail}>
                  Your active Gym Membership can be used for QR or manual check-in until it expires.
                </FitText>
              </View>
            ) : (
              <FitText style={styles.sectionHint}>
                No active Gym Membership. Choose a plan below; a card is not required to browse or purchase.
              </FitText>
            )}
            {plans.map((plan) => (
              <View key={plan.id} style={styles.surface}>
                <View style={styles.row}>
                  <CalendarDays color={colors.brand} size={20} />
                  <View style={styles.rowText}>
                    <FitText style={styles.label}>{plan.name}</FitText>
                    <FitText style={styles.detail}>
                      {plan.duration_days} day{plan.duration_days === 1 ? "" : "s"}
                      {plan.description ? ` · ${plan.description}` : ""}
                    </FitText>
                  </View>
                  <FitText style={styles.planPrice}>{formatPlanPrice(plan)}</FitText>
                </View>
                <FitButton
                  disabled={isPurchasePending || Boolean(currentMembership)}
                  label={currentMembership ? "CURRENT MEMBERSHIP ACTIVE" : "PAY WITH PAYMONGO"}
                  loading={isPurchasePending}
                  loadingLabel="OPENING CHECKOUT..."
                  onPress={() => onPurchasePlan(plan.id)}
                  style={styles.planButton}
                  variant={currentMembership ? "ghost" : "primary"}
                />
              </View>
            ))}
            {plans.length === 0 ? (
              <FitText style={styles.sectionHint}>
                Gym Membership plans are temporarily unavailable. Try again shortly.
              </FitText>
            ) : null}
          </View>

          <View style={styles.section}>
            <FitText style={styles.sectionTitle}>Free 1-Day Pass</FitText>
            <View style={styles.freeSurface}>
              <View style={styles.row}>
                <QrCode color={colors.brand} size={22} />
                <View style={styles.rowText}>
                  <FitText style={styles.label}>Redeem on your first QR check-in</FitText>
                  <FitText style={[styles.status, { color: freePassStatusColor }]}>
                    {freePassStatus}
                  </FitText>
                  <FitText style={styles.detail}>
                    {freeDayPassEligibility?.eligible
                      ? "Eligible verified members receive one lifetime free 1-Day Pass."
                      : freeDayPassEligibility?.reason ??
                        "Checking your verified-member eligibility for the lifetime free pass."
                    }
                  </FitText>
                </View>
              </View>
              <FitText style={styles.detail}>
                There is no claim button or payment. The pass is redeemed automatically at the first eligible QR check-in; manual check-in never redeems it.
              </FitText>
            </View>
          </View>
        </FitModalScrollView>
        <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
          <FitButton label="CLOSE" onPress={onClose} variant="ghost" />
        </View>
      </Animated.View>
    </Animated.View>
  );

  return (
    <Modal
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={isVisible}
    >
      {Platform.OS === "web" ? (
        modalBody
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
          style={{ flex: 1 }}
        >
          {modalBody}
        </KeyboardAvoidingView>
      )}
    </Modal>
  );
}
