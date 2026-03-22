import { useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { CalendarDays, Image as ImageIcon, XCircle } from "lucide-react-native";

import type { Booking } from "@fittrack/types";
import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { STATUS_COLORS } from "@/data/bookings";
import { formatBookingDate } from "@fittrack/utils";
import { makeBookingDetailModalStyles } from "@/styles/modals/BookingDetailStyles";
import { getVenuePresentation, type VenueRecord } from "@/utils/venueBookings";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";

type Props = {
  isVisible: boolean;
  booking: Booking | null;
  venue?: VenueRecord | null;
  onClose: () => void;
  onCancelReservation?: (booking: Booking) => void;
  isCancelling?: boolean;
};

function parseTimeToMinutes(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  if (period === "AM" && hour === 12) hour = 0;
  if (period === "PM" && hour !== 12) hour += 12;
  return hour * 60 + minute;
}

export default function BookingDetailModal({ isVisible, booking, venue = null, onClose, onCancelReservation, isCancelling = false }: Props) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");
  const s = useMemo(() => makeBookingDetailModalStyles(colors), [colors]);

  const backdropStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.overlay }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    backgroundColor: ic.value.surface,
    borderColor: ic.value.border
  }));
  const headerBorderStyle = useAnimatedStyle(() => ({ borderBottomColor: ic.value.border }));
  const headerIconStyle = useAnimatedStyle(() => ({
    backgroundColor: ic.value.surfaceRaised,
    borderColor: ic.value.border
  }));
  const footerBorderStyle = useAnimatedStyle(() => ({ borderTopColor: ic.value.border }));

  if (!booking) return null;

  const venuePresentation = venue ? getVenuePresentation(venue) : null;
  const timeValue = booking.startTime && booking.endTime ? `${booking.startTime} - ${booking.endTime}` : booking.time;
  const statusColor = STATUS_COLORS[booking.status] ?? colors.textMuted;
  const statusValue = booking.status.charAt(0).toUpperCase() + booking.status.slice(1);
  const coachInitials = booking.trainerName
      ? booking.trainerName
          .split(" ")
          .map((part: string) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      : "-";

  const pricing = (() => {
    const venueRate = venue?.hourlyRate ?? venuePresentation?.price ?? 0;
    if (!booking.startTime || !booking.endTime) {
      return {
        parsed: false,
        hours: 1,
        venueTotal: venueRate,
        trainerFee: 0,
        finalPrice: booking.price ?? venueRate
      };
    }
    const startTotal = parseTimeToMinutes(booking.startTime);
    const endTotal = parseTimeToMinutes(booking.endTime);
    if (startTotal === null || endTotal === null || endTotal <= startTotal) {
      return {
        parsed: false,
        hours: 1,
        venueTotal: venueRate,
        trainerFee: 0,
        finalPrice: booking.price ?? venueRate
      };
    }
    const hours = Math.max(1, Math.round((endTotal - startTotal) / 60));
    const venueTotal = venueRate * hours;
    const trainerFee = booking.trainerName && booking.price != null ? booking.price - venueTotal : 0;
    return {
      parsed: true,
      hours,
      venueTotal,
      trainerFee,
      finalPrice: booking.trainerName ? venueTotal + trainerFee : venueTotal
    };
  })();

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
                <FitText style={s.headerTitle}>Booking Details</FitText>
                <FitText style={s.headerSubtitle}>{booking.resourceName}</FitText>
              </View>
            </Animated.View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>
              <View style={s.resourceCard}>
                <View style={s.resourceImageArea}>
                  <ImageIcon size={32} color={colors.textDisabled} strokeWidth={1.5} />
                </View>
                <FitText style={s.resourceEmoji}>{venuePresentation?.emoji ?? ""}</FitText>
                <FitText style={s.resourceName}>{booking.resourceName}</FitText>
              </View>
              <View style={s.dateTimeRow}>
                <View style={s.dateTimeCell}>
                  <FitText style={s.detailLabel}>DATE</FitText>
                  <FitText style={s.detailValue}>{formatBookingDate(booking.date)}</FitText>
                </View>
                <View style={s.dateTimeDivider} />
                <View style={s.dateTimeCell}>
                  <FitText style={s.detailLabel}>TIME</FitText>
                  <FitText style={s.detailValue}>{timeValue}</FitText>
                </View>
              </View>
              <View style={s.coachCard}>
                <View style={[s.coachAvatar, booking.trainerName && { backgroundColor: colors.brand }]}>
                  <FitText style={[s.coachAvatarText, booking.trainerName && { color: colors.onBrand }]}>{coachInitials}</FitText>
                </View>
                <View style={s.coachInfo}>
                  <FitText style={s.coachName}>{booking.trainerName ?? "No Coach Assigned"}</FitText>
                  <FitText style={s.coachSub}>Coach</FitText>
                </View>
              </View>
              <View style={[s.statusBadge, { borderColor: statusColor + "44", backgroundColor: statusColor + "12" }]}>
                <View style={[s.statusDot, { backgroundColor: statusColor }]} />
                <FitText style={[s.statusText, { color: statusColor }]}>{statusValue}</FitText>
              </View>
              <View style={s.priceCard}>
                <FitText style={s.detailLabel}>PRICE</FitText>
                <FitText style={s.priceValue}>{"\u20B1"}{pricing.finalPrice.toLocaleString()}</FitText>
                <FitText style={s.priceSub}>
                  {pricing.parsed && venuePresentation
                      ? `\u20B1${venuePresentation.price}/${venuePresentation.unit} x ${pricing.hours}hr`
                      : ""}
                  {booking.trainerName ? " + coach session" : ""}
                </FitText>
              </View>
            </ScrollView>
            <Animated.View style={[s.footer, footerBorderStyle]}>
              <FitButton
                  label="CANCEL RESERVATION"
                  variant="danger"
                  icon={XCircle}
                  iconSize={18}
                  onPress={() => booking && onCancelReservation?.(booking)}
                  disabled={!onCancelReservation || isCancelling || booking.status === "cancelled"}
                  flex={1}
              />
              <FitButton label="Close" variant="ghost" onPress={onClose} flex={1} />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </Modal>
  );
}