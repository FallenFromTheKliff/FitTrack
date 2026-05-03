import { useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { CalendarDays } from "lucide-react-native";

import type { LucideIcon } from "lucide-react-native";
import type { FitButtonVariant } from "@/components/fit";
import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { STATUS_COLORS } from "@/data/bookings";
import { formatBookingDate } from "@fittrack/utils";
import { makeBookingDetailModalStyles } from "@/styles/modals/BookingDetailStyles";
import { getVenuePresentation, type VenueRecord } from "@/utils/venueBookings";
import { getVenueIcon } from "@/utils/venueMap";

import { FitButton, FitText } from "@/components/fit";

export type DetailBooking = {
  amountDueNow?: number;
  bookingType?: "recurring" | "single";
  id: string;
  nextPaymentDate?: string;
  paymentPlan?: "downpayment" | "free" | "full";
  remainingBalance?: number;
  resourceId?: string;
  resourceName: string;
  date: string;
  time: string;
  startTime?: string;
  endTime?: string;
  status: string;
  price: number;
  trainerName?: string;
  description?: string;
  participantLabel?: string;
  participantName?: string;
  detailTitle?: string;
  detailSubtitle?: string;
  totalAmount?: number;
};

type DetailAction = {
  key: string;
  label: string;
  variant: FitButtonVariant;
  icon?: LucideIcon;
  onPress: (booking: DetailBooking) => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
};

type Props = {
  isVisible: boolean;
  booking: DetailBooking | null;
  venue?: VenueRecord | null;
  onClose: () => void;
  actions?: DetailAction[];
};

function parseTimeToMinutes(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 1 ||
    hour > 12 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  if (period === "AM" && hour === 12) hour = 0;
  if (period === "PM" && hour !== 12) hour += 12;
  return hour * 60 + minute;
}

function formatStatusLabel(status: string) {
  const explicitLabels: Record<string, string> = {
    pending_downpayment: "Pending Downpayment",
    pending_payment: "Pending Payment",
    pending_full_payment: "Pending Full Payment",
    balance_pending: "Pending Full Payment",
  };

  if (explicitLabels[status]) {
    return explicitLabels[status];
  }

  return status
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatCurrency(value: number) {
  return `PHP ${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function BookingDetailModal({
  isVisible,
  booking,
  venue = null,
  onClose,
  actions = [],
}: Props) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");
  const s = useMemo(() => makeBookingDetailModalStyles(colors), [colors]);

  const backdropStyle = useAnimatedStyle(() => ({
    backgroundColor: ic.value.overlay,
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    backgroundColor: ic.value.surface,
    borderColor: ic.value.border,
  }));
  const headerBorderStyle = useAnimatedStyle(() => ({
    borderBottomColor: ic.value.border,
  }));
  const headerIconStyle = useAnimatedStyle(() => ({
    backgroundColor: ic.value.surfaceRaised,
    borderColor: ic.value.border,
  }));
  const footerBorderStyle = useAnimatedStyle(() => ({
    borderTopColor: ic.value.border,
  }));

  if (!booking) return null;

  const venuePresentation = venue ? getVenuePresentation(venue) : null;
  const timeValue =
    booking.startTime && booking.endTime
      ? `${booking.startTime} - ${booking.endTime}`
      : booking.time;
  const statusColor = STATUS_COLORS[booking.status] ?? colors.textMuted;
  const statusValue = formatStatusLabel(booking.status);
  const participantName =
    booking.participantName ?? booking.trainerName ?? "No linked person";
  const participantLabel = booking.participantLabel ?? "Coach";
  const participantInitials =
    participantName
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "-";
  const VenueIcon = venuePresentation
    ? getVenueIcon(venuePresentation.iconKey)
    : null;

  const pricing = (() => {
    const venueRate = venue?.hourlyRate ?? venuePresentation?.price ?? 0;
    if (!booking.startTime || !booking.endTime) {
      return {
        parsed: false,
        hours: 1,
        venueTotal: venueRate,
        finalPrice: booking.price ?? venueRate,
      };
    }
    const startTotal = parseTimeToMinutes(booking.startTime);
    const endTotal = parseTimeToMinutes(booking.endTime);
    if (startTotal === null || endTotal === null || endTotal <= startTotal) {
      return {
        parsed: false,
        hours: 1,
        venueTotal: venueRate,
        finalPrice: booking.price ?? venueRate,
      };
    }
    const hours = Math.max(1, Math.round((endTotal - startTotal) / 60));
    const venueTotal = venueRate * hours;
    return {
      parsed: true,
      hours,
      venueTotal,
      finalPrice: booking.price || venueTotal,
    };
  })();

  const totalPrice = booking.totalAmount ?? pricing.finalPrice;
  const showPaymentPlan =
    booking.paymentPlan === "downpayment" || booking.paymentPlan === "full";
  const amountDueNow = booking.amountDueNow ?? totalPrice;
  const remainingBalance = booking.remainingBalance ?? 0;
  const bookingTypeLabel =
    booking.bookingType === "recurring"
      ? "Recurring booking"
      : "Single booking";
  const bookingSummaryLabel =
    booking.bookingType === "recurring"
      ? "Part of a recurring coach plan."
      : "One-time booking only.";
  const paymentPlanLabel =
    booking.paymentPlan === "full"
      ? "Full payment"
      : booking.paymentPlan === "downpayment"
        ? "Split payment"
        : "Free access";

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[s.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[s.card, cardStyle]}>
          <Animated.View style={[s.header, headerBorderStyle]}>
            <Animated.View style={[s.headerIcon, headerIconStyle]}>
              <CalendarDays size={18} color={colors.brand} strokeWidth={2} />
            </Animated.View>
            <View style={s.headerText}>
              <FitText style={s.headerTitle}>
                {booking.detailTitle ?? "Booking Details"}
              </FitText>
              <FitText style={s.headerSubtitle}>
                {booking.detailSubtitle ?? booking.resourceName}
              </FitText>
            </View>
          </Animated.View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.body}
          >
            <View style={[s.resourceCard, localStyles.resourceIconCard]}>
              <View
                style={[
                  localStyles.venueIconWrap,
                  {
                    backgroundColor: `${colors.brand}18`,
                    borderColor: `${colors.brand}44`,
                  },
                ]}
              >
                {VenueIcon ? (
                  <VenueIcon
                    size={40}
                    color={colors.brand}
                    strokeWidth={1.8}
                  />
                ) : (
                  <CalendarDays
                    size={40}
                    color={colors.brand}
                    strokeWidth={1.8}
                  />
                )}
              </View>
              <FitText style={s.resourceName}>{booking.resourceName}</FitText>
            </View>

            <View style={s.dateTimeRow}>
              <View style={s.dateTimeCell}>
                <FitText style={s.detailLabel}>DATE</FitText>
                <FitText style={s.detailValue}>
                  {formatBookingDate(booking.date)}
                </FitText>
              </View>
              <View style={s.dateTimeDivider} />
              <View style={s.dateTimeCell}>
                <FitText style={s.detailLabel}>TIME</FitText>
                <FitText style={s.detailValue}>{timeValue}</FitText>
              </View>
            </View>

            <View style={s.coachCard}>
              <View
                style={[
                  s.coachAvatar,
                  participantName !== "No linked person" && {
                    backgroundColor: colors.brand,
                  },
                ]}
              >
                <FitText
                  style={[
                    s.coachAvatarText,
                    participantName !== "No linked person" && {
                      color: colors.onBrand,
                    },
                  ]}
                >
                  {participantInitials}
                </FitText>
              </View>
              <View style={s.coachInfo}>
                <FitText style={s.coachName}>{participantName}</FitText>
                <FitText style={s.coachSub}>{participantLabel}</FitText>
              </View>
            </View>

            <View
              style={[
                s.statusBadge,
                {
                  borderColor: `${statusColor}44`,
                  backgroundColor: `${statusColor}12`,
                },
              ]}
            >
              <View style={[s.statusDot, { backgroundColor: statusColor }]} />
              <FitText style={[s.statusText, { color: statusColor }]}>
                {statusValue}
              </FitText>
            </View>

            <View style={s.priceCard}>
              <FitText style={s.detailLabel}>TYPE</FitText>
              <FitText style={s.detailValue}>{bookingTypeLabel}</FitText>
              <FitText style={s.priceSub}>{bookingSummaryLabel}</FitText>
            </View>

            {booking.description ? (
              <View style={s.priceCard}>
                <FitText style={s.detailLabel}>NOTES</FitText>
                <FitText style={s.detailValue}>{booking.description}</FitText>
              </View>
            ) : null}

            {showPaymentPlan ? (
              <View style={s.priceCard}>
                <FitText style={s.detailLabel}>PAYMENT PLAN</FitText>
                <FitText style={s.detailValue}>{paymentPlanLabel}</FitText>
                <FitText style={s.priceSub}>
                  Pay now: {formatCurrency(amountDueNow)}
                </FitText>
                <FitText style={s.priceSub}>
                  {remainingBalance > 0
                    ? `Remaining balance: ${formatCurrency(remainingBalance)} on or after ${formatBookingDate(
                        booking.nextPaymentDate ?? booking.date,
                      )}`
                    : "No remaining balance after the first payment is confirmed."}
                </FitText>
              </View>
            ) : null}

            <View style={s.priceCard}>
              <FitText style={s.detailLabel}>PRICE</FitText>
              <FitText style={s.priceValue}>
                {formatCurrency(totalPrice)}
              </FitText>
              <FitText style={s.priceSub}>
                {pricing.parsed && venuePresentation
                  ? `${formatCurrency(venuePresentation.price)}/${venuePresentation.unit} x ${pricing.hours}hr`
                  : ""}
              </FitText>
            </View>
          </ScrollView>

          <Animated.View style={[s.footer, footerBorderStyle]}>
            {actions.map((action) => (
              <View key={action.key} style={s.footerActionWrap}>
                <FitButton
                  label={action.label}
                  variant={action.variant}
                  icon={action.icon}
                  onPress={() => action.onPress(booking)}
                  disabled={action.disabled}
                  loading={action.loading}
                  loadingLabel={action.loadingLabel}
                  flex={1}
                />
              </View>
            ))}
            <View style={s.footerActionWrap}>
              <FitButton
                label="Close"
                variant="ghost"
                onPress={onClose}
                flex={1}
              />
            </View>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const localStyles = StyleSheet.create({
  resourceIconCard: {
    alignItems: "center",
    gap: 10,
  },
  venueIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
