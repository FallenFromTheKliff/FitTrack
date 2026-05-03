import { Fragment, useEffect, useMemo, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import {
  CalendarDays,
  CheckCircle,
  Clock,
  Plus,
  Users,
  XCircle,
} from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  PAYMONGO_AVAILABILITY,
  WEEKDAY_NAMES,
  isPaymongoCheckoutEnabled,
} from "@fittrack/app-config";
import type {
  CoachAvailabilityResponse,
  VenueAvailabilityRecord,
} from "@fittrack/api-client";
import type { CoachProfileRecord } from "@fittrack/types";

import {
  activeCoachesQueryOptions,
  coachAvailabilityQueryOptions,
  createBookingMutationOptions,
  venueAvailabilityQueryOptions,
  venuesQueryOptions,
} from "@fittrack/query";
import { TIME_SLOTS, getTodayString } from "@/data/bookings";
import { formatBookingDate } from "@fittrack/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { mobileApiClient } from "@/lib/api-client";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useLoadingText } from "@fittrack/hooks";
import { makeReservationModalStyles } from "@/styles/modals/ReservationStyles";
import { getVenuePresentation, type VenueRecord } from "@/utils/venueBookings";

import { FitButton, FitText, FitTextInput } from "@/components/fit";
import CalendarModal from "@/components/modals/shared/CalendarModal";
import ConfirmModal from "@/components/modals/shared/ConfirmModal";
import NoticeModal from "@/components/modals/shared/NoticeModal";
import TimeSlotModal, {
  type TimeSlot,
} from "@/components/modals/shared/TimeSlotModal";

type Props = {
  isVisible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

type BookingPaymentOption =
  | "cash_downpayment"
  | "cash_full"
  | "paymongo_downpayment";
type ReservationConfirmationState = {
  message: string;
  title: string;
  yesLabel: string;
};

function timeToMinutes(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();
  if (period === "AM" && hour === 12) hour = 0;
  if (period === "PM" && hour !== 12) hour += 12;
  return hour * 60 + minute;
}

function timeValueToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  return hours * 60 + minutes;
}

function matchesDay(selectedDate: string, dayValue: number | string) {
  const currentDate = new Date(`${selectedDate}T00:00:00`);
  const dayIndex = currentDate.getDay();
  if (typeof dayValue === "number") {
    return dayValue === dayIndex;
  }
  const normalized = String(dayValue).trim().toLowerCase();
  const numericDay = Number(normalized);
  if (Number.isInteger(numericDay)) {
    return numericDay === dayIndex;
  }
  return WEEKDAY_NAMES[dayIndex] === normalized;
}

function getUpcomingAvailableDates(coaches: CoachProfileRecord[]) {
  const availableDays = new Set<number>();
  coaches.forEach((coach) => {
    coach.availability?.forEach((slot) => {
      if (!slot.isAvailable) return;
      if (typeof slot.dayOfWeek === "number") {
        availableDays.add(slot.dayOfWeek);
        return;
      }
      const normalizedDay = String(slot.dayOfWeek).trim().toLowerCase();
      const numericDay = Number(normalizedDay);
      if (Number.isInteger(numericDay)) {
        availableDays.add(numericDay);
        return;
      }
      const weekdayIndex = WEEKDAY_NAMES.findIndex((day) => day === normalizedDay);
      if (weekdayIndex >= 0) availableDays.add(weekdayIndex);
    });
  });

  if (availableDays.size === 0) return [];

  const dates: string[] = [];
  const cursor = new Date(`${getTodayString()}T00:00:00`);
  for (let offset = 0; offset < 90; offset += 1) {
    const nextDate = new Date(cursor);
    nextDate.setDate(cursor.getDate() + offset);
    const year = nextDate.getFullYear();
    const month = String(nextDate.getMonth() + 1).padStart(2, "0");
    const day = String(nextDate.getDate()).padStart(2, "0");
    const dateKey = `${year}-${month}-${day}`;
    const hasOpenCoach = coaches.some(
      (coach) =>
        !(coach.bookedDates ?? []).includes(dateKey) &&
        coach.availability?.some(
          (slot) =>
            slot.isAvailable && matchesDay(dateKey, slot.dayOfWeek),
        ),
    );
    if (availableDays.has(nextDate.getDay()) && hasOpenCoach) {
      dates.push(dateKey);
    }
  }

  return dates;
}

function coachCoversReservationWindow(
  coach: CoachProfileRecord,
  selectedDate: string,
  selectedStartTime: string,
  selectedEndTime: string,
) {
  const slots = coach.availability ?? [];
  if (!slots.length) return false;
  if (coach.bookedDates?.includes(selectedDate)) return false;

  if (!selectedStartTime || !selectedEndTime) {
    return slots.some(
      (slot) => slot.isAvailable && matchesDay(selectedDate, slot.dayOfWeek),
    );
  }

  const startMinutes = timeToMinutes(selectedStartTime);
  const endMinutes = timeToMinutes(selectedEndTime);
  return slots.some(
    (slot) =>
      slot.isAvailable &&
      matchesDay(selectedDate, slot.dayOfWeek) &&
      timeValueToMinutes(slot.startTime) <= startMinutes &&
      timeValueToMinutes(slot.endTime) >= endMinutes,
  );
}

function getCoachName(coach: CoachProfileRecord) {
  const standaloneName = coach.displayName?.trim();
  if (standaloneName && !standaloneName.includes("@")) return standaloneName;
  return "Coach Profile";
}

function getCoachInitials(coach: CoachProfileRecord) {
  return (
    getCoachName(coach)
      .split(" ")
      .filter((part) => part.length > 0)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "C"
  );
}

function getCoachPriceLabel(coach: CoachProfileRecord) {
  if (coach.hourlyRate == null || !Number.isFinite(coach.hourlyRate)) {
    return "Rate pending";
  }

  return `PHP ${coach.hourlyRate.toLocaleString("en-PH")} / hr`;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function toGymWallClockIso(date: string, minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const [year, month, day] = date.split("-").map(Number);
  const gymOffsetMinutes = 8 * 60;
  return new Date(
    Date.UTC(year, month - 1, day, hour, minute) -
      gymOffsetMinutes * 60 * 1000,
  ).toISOString();
}

function formatCurrency(value: number) {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function ReservationModal({
  isVisible,
  onClose,
  onSuccess,
}: Props) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");
  const s = useMemo(() => makeReservationModalStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const createBookingMutation = useMutation(
    createBookingMutationOptions(mobileApiClient, queryClient),
  );
  const canUsePaymongo = isPaymongoCheckoutEnabled();
  const defaultPaymentOption: BookingPaymentOption = canUsePaymongo
    ? "paymongo_downpayment"
    : "cash_downpayment";

  const [date, setDate] = useState(getTodayString());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [paymentOption, setPaymentOption] =
    useState<BookingPaymentOption>(defaultPaymentOption);
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<VenueRecord | null>(null);
  const [isCalOpen, setIsCalOpen] = useState(false);
  const [isTimeOpen, setIsTimeOpen] = useState(false);
  const [isPaymongoNoticeOpen, setIsPaymongoNoticeOpen] = useState(false);
  const [reservationConfirmation, setReservationConfirmation] =
    useState<ReservationConfirmationState | null>(null);
  const [successNotice, setSuccessNotice] = useState<{
    message: string;
    title: string;
  } | null>(null);
  const [timeTarget, setTimeTarget] = useState<"start" | "end">("start");
  const isSubmitting = createBookingMutation.isPending;
  const [apiError, setApiError] = useState("");
  const reservingText = useLoadingText("Reserving", isSubmitting);

  const { data: venues = [] } = useQuery({
    ...venuesQueryOptions(mobileApiClient),
    enabled: isVisible,
  });
  const {
    data: coaches = [],
    isLoading: coachesLoading,
    error: coachesError,
  } = useQuery({
    ...activeCoachesQueryOptions<CoachProfileRecord>(mobileApiClient),
    enabled: isVisible,
  });

  const bookableVenues = useMemo(
    () =>
      venues
        .filter((venue) => venue.isReservable !== false)
        .map((venue) => ({ venue, presentation: getVenuePresentation(venue) })),
    [venues],
  );
  const selectedVenuePresentation = useMemo(
    () => (selectedVenue ? getVenuePresentation(selectedVenue) : null),
    [selectedVenue],
  );
  const selectedCoach = useMemo(
    () => coaches.find((coach) => String(coach.id) === selectedCoachId) ?? null,
    [coaches, selectedCoachId],
  );
  const availableCoachAddOns = useMemo(
    () =>
      coaches.filter((coach) =>
        coachCoversReservationWindow(coach, date, startTime, endTime),
      ),
    [coaches, date, endTime, startTime],
  );
  const highlightedCoachDates = useMemo(
    () => getUpcomingAvailableDates(coaches),
    [coaches],
  );

  const { data: availability = [] } = useQuery({
    ...venueAvailabilityQueryOptions<VenueAvailabilityRecord>(
      mobileApiClient,
      selectedVenue?.id,
      date,
    ),
    enabled: isVisible && !!selectedVenue && !!date,
  });
  const {
    data: coachAvailability,
    isLoading: coachAvailabilityLoading,
    error: coachAvailabilityError,
  } = useQuery({
    ...coachAvailabilityQueryOptions<CoachAvailabilityResponse>(
      mobileApiClient,
      selectedCoach ? String(selectedCoach.id) : undefined,
    ),
    enabled: isVisible && !!selectedCoach,
  });

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
  const footerBorderStyle = useAnimatedStyle(() => ({
    borderTopColor: ic.value.border,
  }));

  useEffect(() => {
    if (
      selectedCoachId &&
      !availableCoachAddOns.some((coach) => String(coach.id) === selectedCoachId)
    ) {
      setSelectedCoachId(null);
    }
  }, [availableCoachAddOns, selectedCoachId]);

  const basePrice = useMemo(
    () => selectedVenuePresentation?.price ?? 0,
    [selectedVenuePresentation],
  );
  const coachHourlyRate = useMemo(() => {
    if (!selectedCoach || selectedCoach.hourlyRate == null) return 0;
    return Number.isFinite(selectedCoach.hourlyRate)
      ? selectedCoach.hourlyRate
      : 0;
  }, [selectedCoach]);
  const reservationHours = useMemo(() => {
    if (!startTime || !endTime) return 0;
    const totalHours = (timeToMinutes(endTime) - timeToMinutes(startTime)) / 60;
    return totalHours > 0 ? totalHours : 0;
  }, [endTime, startTime]);
  const venueTotalAmount = useMemo(
    () => roundCurrency(basePrice * reservationHours),
    [basePrice, reservationHours],
  );
  const coachAddOnAmount = useMemo(
    () => roundCurrency(coachHourlyRate * reservationHours),
    [coachHourlyRate, reservationHours],
  );
  const totalAmount = useMemo(
    () => roundCurrency(venueTotalAmount + coachAddOnAmount),
    [coachAddOnAmount, venueTotalAmount],
  );
  const isFreeReservation = totalAmount <= 0;
  const splitAmountDueNow = useMemo(
    () => roundCurrency(totalAmount * 0.3),
    [totalAmount],
  );
  const splitRemainingBalance = useMemo(
    () => roundCurrency(Math.max(0, totalAmount - splitAmountDueNow)),
    [splitAmountDueNow, totalAmount],
  );
  const amountDueNow =
    paymentOption === "cash_full" ? totalAmount : splitAmountDueNow;
  const remainingBalance =
    paymentOption === "cash_full" ? 0 : splitRemainingBalance;
  const paymentProvider =
    paymentOption === "paymongo_downpayment" ? "paymongo" : "cash";
  const paymentStage = paymentOption === "cash_full" ? "full" : "downpayment";
  const confirmButtonLabel = isFreeReservation
    ? "Confirm Reservation"
    : paymentOption === "paymongo_downpayment" && canUsePaymongo
      ? "Pay with PayMongo"
      : paymentOption === "cash_full"
        ? "Submit Full Cash Payment"
        : "Submit Downpayment";
  const paymentOptionSummary = useMemo(() => {
    if (isFreeReservation) {
      return {
        body: "This reservation currently prices at PHP 0, so no upfront payment is required.",
        eyebrow: "Free access",
        title: "No checkout required",
      };
    }

    if (paymentOption === "cash_full") {
      return {
        body: `Staff will verify your full cash payment of ${formatCurrency(totalAmount)} before the reservation is treated as fully paid.`,
        eyebrow: "Cash",
        title: "Full payment",
      };
    }

    if (paymentOption === "cash_downpayment") {
      return {
        body: `Submit a cash downpayment now, then settle the remaining ${formatCurrency(splitRemainingBalance)} on or after the booking date.`,
        eyebrow: "Cash",
        title: "Split payment",
      };
    }

    return {
      body: `Start PayMongo checkout for the upfront ${formatCurrency(splitAmountDueNow)} now, then settle the remaining ${formatCurrency(splitRemainingBalance)} on or after the booking date.`,
      eyebrow: canUsePaymongo ? "PayMongo" : "PayMongo unavailable",
      title: "Online downpayment",
    };
  }, [
    canUsePaymongo,
    isFreeReservation,
    paymentOption,
    splitAmountDueNow,
    splitRemainingBalance,
    totalAmount,
  ]);

  const endSlots = useMemo((): TimeSlot[] => {
    if (!startTime) return [];
    const startIdx = TIME_SLOTS.findIndex((slot) => slot.time === startTime);
    if (startIdx === -1) return [];
    const result: TimeSlot[] = [];
    for (let i = startIdx + 1; i < TIME_SLOTS.length; i += 1) {
      result.push(TIME_SLOTS[i]);
      if (TIME_SLOTS[i].status === "full") break;
    }
    return result;
  }, [startTime]);

  const hasConflict = useMemo(() => {
    if (!selectedVenue || !date || !startTime || !endTime) return false;
    const selStart = timeToMinutes(startTime);
    const selEnd = timeToMinutes(endTime);
    return availability.some((booking) => {
      if (booking.status !== "confirmed" && booking.status !== "pending")
        return false;
      const bookingStart = new Date(booking.startTime);
      const bookingEnd = new Date(booking.endTime);
      const bookingStartMinutes =
        bookingStart.getHours() * 60 + bookingStart.getMinutes();
      const bookingEndMinutes =
        bookingEnd.getHours() * 60 + bookingEnd.getMinutes();
      return selStart < bookingEndMinutes && selEnd > bookingStartMinutes;
    });
  }, [availability, date, endTime, selectedVenue, startTime]);

  const coachMatchesWindow = useMemo(() => {
    if (!selectedCoach) return true;
    if (!date || !startTime || !endTime) return true;
    if (!coachAvailability?.availability) return false;
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    return coachAvailability.availability.some(
      (slot) =>
        slot.isAvailable &&
        matchesDay(date, slot.dayOfWeek) &&
        timeValueToMinutes(slot.startTime) <= startMinutes &&
        timeValueToMinutes(slot.endTime) >= endMinutes,
    );
  }, [
    coachAvailability?.availability,
    date,
    endTime,
    selectedCoach,
    startTime,
  ]);

  const coachStatusMessage = useMemo(() => {
    if (!selectedCoach) {
      return "Keep this venue booking on its own, or attach a coach after reviewing their profile.";
    }
    if (!startTime || !endTime) {
      return "Pick the reservation time first to validate this coach against the selected window.";
    }
    if (coachAvailabilityLoading) {
      return "Checking this coach against the selected reservation window.";
    }
    if (coachAvailabilityError) {
      return coachAvailabilityError instanceof Error
        ? coachAvailabilityError.message
        : "Unable to load coach availability right now.";
    }
    if (!coachMatchesWindow) {
      return "This coach does not currently cover the selected reservation window.";
    }
    return `${getCoachName(selectedCoach)} is available for the selected reservation window.`;
  }, [
    coachAvailabilityError,
    coachAvailabilityLoading,
    coachMatchesWindow,
    endTime,
    selectedCoach,
    startTime,
  ]);

  const canConfirm =
    !!date &&
    !!selectedVenue &&
    !!startTime &&
    !!endTime &&
    !hasConflict &&
    coachMatchesWindow;

  const handleReset = () => {
    setDate(getTodayString());
    setStartTime("");
    setEndTime("");
    setNotes([]);
    setPaymentOption(defaultPaymentOption);
    setSelectedCoachId(null);
    setSelectedVenue(null);
    setTimeTarget("start");
    setIsCalOpen(false);
    setIsTimeOpen(false);
    setApiError("");
    setSuccessNotice(null);
    setReservationConfirmation(null);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    handleReset();
    onClose();
  };

  const handleTimePick = (slot: TimeSlot) => {
    if (timeTarget === "start") {
      setStartTime(slot.time);
      setEndTime("");
      setIsTimeOpen(false);
      return;
    }
    setEndTime(slot.time);
    setIsTimeOpen(false);
  };

  const submitReservation = async () => {
    if (!canConfirm || !selectedVenue) return;
    setApiError("");
    if (
      !isFreeReservation &&
      paymentProvider === "paymongo" &&
      !canUsePaymongo
    ) {
      setIsPaymongoNoticeOpen(true);
      return;
    }
    const startMinutes = timeToMinutes(startTime);
    const isoStart = toGymWallClockIso(date, startMinutes);
    const purpose =
      notes.filter((note) => note.trim() !== "").join("\n") || undefined;
    if (selectedCoach && !coachMatchesWindow) {
      setApiError(
        "Selected coach does not currently cover this reservation window.",
      );
      return;
    }
    try {
      const result = await Promise.all([
        createBookingMutation.mutateAsync({
          payload: {
            coachId: selectedCoach ? String(selectedCoach.id) : undefined,
            paymentStage,
            provider: isFreeReservation ? undefined : paymentProvider,
            venueId: selectedVenue.id,
            startTime: isoStart,
            durationHours: reservationHours,
            purpose,
          },
          venueId: selectedVenue.id,
          date,
        }),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]).then(([response]) => response);
      if (result?.checkout_url) {
        handleReset();
        onSuccess?.();
        onClose();
        void Linking.openURL(result.checkout_url);
        return;
      }

      const successTitle = isFreeReservation
        ? "Reservation confirmed"
        : paymentOption === "cash_full"
          ? "Cash payment submitted"
          : "Downpayment submitted";
      const successMessage = isFreeReservation
        ? `${selectedVenuePresentation?.name ?? "Your venue"} is now reserved for ${formatBookingDate(date)} at ${startTime} - ${endTime}.`
        : paymentOption === "cash_full"
          ? `Your reservation is pending staff verification for the full cash payment of ${formatCurrency(totalAmount)}.`
          : `Your reservation is pending staff verification for the upfront ${formatCurrency(amountDueNow)}. The remaining ${formatCurrency(remainingBalance)} can be collected on or after ${formatBookingDate(date)}.`;

      handleReset();
      onSuccess?.();
      setSuccessNotice({
        title: successTitle,
        message: successMessage,
      });
    } catch (err: unknown) {
      setApiError(
        err instanceof Error
          ? err.message
          : "Reservation failed. Please try again.",
      );
    }
  };

  const handleConfirm = () => {
    if (!canConfirm || !selectedVenue) return;

    const venueName = selectedVenuePresentation?.name ?? "your venue";
    const scheduleLabel = `${formatBookingDate(date)} at ${startTime} - ${endTime}`;

    if (isFreeReservation) {
      setReservationConfirmation({
        title: "Confirm reservation?",
        message: `Reserve ${venueName} for ${scheduleLabel}. No upfront payment will be collected for this booking.`,
        yesLabel: "Confirm Reservation",
      });
      return;
    }

    if (paymentOption === "paymongo_downpayment") {
      setReservationConfirmation({
        title: "Continue to PayMongo?",
        message: `You are about to start PayMongo checkout for ${formatCurrency(amountDueNow)} for ${venueName} on ${scheduleLabel}. The remaining ${formatCurrency(remainingBalance)} stays due on or after the booking date.`,
        yesLabel: "Continue to PayMongo",
      });
      return;
    }

    if (paymentOption === "cash_full") {
      setReservationConfirmation({
        title: "Submit full cash payment?",
        message: `Submit a full cash payment request for ${formatCurrency(totalAmount)} for ${venueName} on ${scheduleLabel}. Staff will still verify the payment before it is treated as fully paid.`,
        yesLabel: "Submit Full Payment",
      });
      return;
    }

    setReservationConfirmation({
      title: "Submit cash downpayment?",
      message: `Submit a cash downpayment request for ${formatCurrency(amountDueNow)} for ${venueName} on ${scheduleLabel}. The remaining ${formatCurrency(remainingBalance)} will stay due on or after the booking date.`,
      yesLabel: "Submit Downpayment",
    });
  };

  return (
    <Fragment>
      <Modal
        visible={
          isVisible &&
          reservationConfirmation == null &&
          successNotice == null &&
          !isPaymongoNoticeOpen
        }
        transparent
        animationType="none"
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        <Animated.View style={[s.backdrop, backdropStyle]}>
          <Animated.View style={[s.card, cardStyle]}>
          <Animated.View style={[s.header, headerBorderStyle]}>
            <View style={s.headerIcon}>
              <CalendarDays size={18} color={colors.brand} strokeWidth={2} />
            </View>
            <View style={s.headerText}>
              <FitText style={s.headerTitle}>Make a Reservation</FitText>
              <FitText style={s.headerSubtitle}>
                {selectedVenuePresentation
                  ? `${selectedVenuePresentation.emoji} ${selectedVenuePresentation.name} · ₱${selectedVenuePresentation.price}/${selectedVenuePresentation.unit}`
                  : "Book a reservable venue"}
              </FitText>
            </View>
          </Animated.View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.body}
          >
            <FitText style={s.sectionLabel}>DATE</FitText>
            <Pressable
              style={[
                s.fieldBtn,
                { borderColor: date ? colors.brand : colors.fieldBorder },
              ]}
              onPress={() => setIsCalOpen(true)}
            >
              <CalendarDays
                size={16}
                color={date ? colors.brand : colors.textMuted}
                strokeWidth={2}
              />
              <FitText
                style={[s.fieldBtnText, date && { color: colors.textPrimary }]}
              >
                {date ? formatBookingDate(date) : "Select a date"}
              </FitText>
            </Pressable>
            <FitText style={[s.sectionLabel, { marginTop: 16 }]}>
              TIME RANGE
            </FitText>
            <View style={s.twoFieldRow}>
              <Pressable
                style={[
                  s.fieldBtn,
                  s.fieldBtnFlex,
                  {
                    borderColor: startTime ? colors.brand : colors.fieldBorder,
                  },
                ]}
                onPress={() => {
                  setTimeTarget("start");
                  setIsTimeOpen(true);
                }}
              >
                <Clock
                  size={16}
                  color={startTime ? colors.brand : colors.textMuted}
                  strokeWidth={2}
                />
                <FitText
                  style={[
                    s.fieldBtnText,
                    startTime && { color: colors.textPrimary },
                  ]}
                >
                  {startTime || "Start Time"}
                </FitText>
              </Pressable>
              <Pressable
                style={[
                  s.fieldBtn,
                  s.fieldBtnFlex,
                  {
                    borderColor: endTime ? colors.brand : colors.fieldBorder,
                    opacity: !startTime ? 0.45 : 1,
                  },
                ]}
                onPress={() => {
                  if (!startTime) return;
                  setTimeTarget("end");
                  setIsTimeOpen(true);
                }}
                disabled={!startTime}
              >
                <Clock
                  size={16}
                  color={endTime ? colors.brand : colors.textMuted}
                  strokeWidth={2}
                />
                <FitText
                  style={[
                    s.fieldBtnText,
                    endTime && { color: colors.textPrimary },
                  ]}
                >
                  {endTime || "End Time"}
                </FitText>
              </Pressable>
            </View>
            {startTime === "" || endTime === "" ? (
              <FitText style={s.validationHint}>
                Start and end time are required
              </FitText>
            ) : null}
            {hasConflict ? (
              <FitText style={s.unavailableText}>
                The selected time overlaps an active booking.
              </FitText>
            ) : null}
            {apiError !== "" ? (
              <FitText style={s.unavailableText}>{apiError}</FitText>
            ) : null}
            <FitText style={[s.sectionLabel, { marginTop: 16 }]}>VENUE</FitText>
            <View style={s.amenityGrid}>
              {bookableVenues.map(({ venue, presentation }) => {
                const isActive = selectedVenue?.id === venue.id;
                return (
                  <Pressable
                    key={venue.id}
                    style={[
                      s.amenityCard,
                      isActive && {
                        borderColor: colors.brand,
                        backgroundColor: colors.brand + "12",
                      },
                    ]}
                    onPress={() => setSelectedVenue(isActive ? null : venue)}
                  >
                    <FitText style={s.amenityEmoji}>
                      {presentation.name.slice(0, 1)}
                    </FitText>
                    <FitText
                      style={[
                        s.amenityName,
                        isActive && { color: colors.brand, fontWeight: "600" },
                      ]}
                      numberOfLines={2}
                    >
                      {presentation.name}
                    </FitText>
                    <FitText
                      style={[
                        s.amenityPrice,
                        isActive && { color: colors.brand },
                      ]}
                    >
                      ₱{presentation.price}/{presentation.unit}
                    </FitText>
                    {isActive ? (
                      <View style={s.amenityCheck}>
                        <CheckCircle
                          size={14}
                          color={colors.brand}
                          strokeWidth={2}
                        />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            <View style={s.notesSectionHeader}>
              <FitText
                style={[s.sectionLabel, { marginTop: 16, marginBottom: 0 }]}
              >
                COACH ADD-ON
              </FitText>
              <FitText style={s.optionalLabel}>Optional</FitText>
            </View>
            <FitText style={s.validationHint}>
              Review a coach profile here if you want to attach one to this
              venue reservation.
            </FitText>
            {coachesLoading ? (
              <FitText style={s.validationHint}>
                Loading coach profiles...
              </FitText>
            ) : coachesError ? (
              <FitText style={s.unavailableText}>
                {coachesError instanceof Error
                  ? coachesError.message
                  : "Unable to load coach profiles."}
              </FitText>
            ) : coaches.length === 0 || availableCoachAddOns.length === 0 ? (
              <FitText style={s.validationHint}>
                No coach add-ons are available for the selected date and time.
              </FitText>
            ) : (
              <View style={s.trainerList}>
                {availableCoachAddOns.map((coach) => {
                  const isActive = selectedCoach?.id === coach.id;
                  return (
                    <Pressable
                      key={coach.id}
                      style={[
                        s.trainerRow,
                        isActive && {
                          borderColor: colors.brand,
                          backgroundColor: colors.brand + "12",
                        },
                      ]}
                      onPress={() => {
                        setApiError("");
                        setSelectedCoachId(isActive ? null : String(coach.id));
                      }}
                    >
                      <View
                        style={[
                          s.trainerAvatar,
                          isActive && { backgroundColor: colors.brand },
                        ]}
                      >
                        <FitText
                          style={[
                            s.trainerAvatarText,
                            isActive && { color: colors.surface },
                          ]}
                        >
                          {getCoachInitials(coach)}
                        </FitText>
                      </View>
                      <View style={s.trainerInfo}>
                        <FitText style={s.trainerName}>
                          {getCoachName(coach)}
                        </FitText>
                        <FitText style={s.trainerSpecialty}>
                          {coach.specialties?.[0] ?? "General Coaching"} {" - "}{" "}
                          {getCoachPriceLabel(coach)}
                        </FitText>
                        <FitText style={s.validationHint}>
                          {coach.bio?.trim() ||
                            "Staff has not added a coach bio yet."}
                        </FitText>
                      </View>
                      {isActive ? (
                        <Users size={18} color={colors.brand} strokeWidth={2} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            )}
            <FitText
              style={coachMatchesWindow ? s.validationHint : s.unavailableText}
            >
              {coachStatusMessage}
            </FitText>
            <FitText style={[s.sectionLabel, { marginTop: 16 }]}>
              VENUE RATE
            </FitText>
            <View style={[s.inputFieldWrap, { opacity: 0.6 }]}>
              <FitText style={s.inputPrefix}>₱</FitText>
              <FitText style={s.inputField}>
                {basePrice > 0 ? String(basePrice) : "—"}
              </FitText>
            </View>
            {startTime && endTime ? (
              <>
                <FitText style={[s.sectionLabel, { marginTop: 16 }]}>
                  PAYMENT OPTIONS
                </FitText>
                {isFreeReservation ? (
                  <View style={s.paymentSummaryCard}>
                    <FitText style={s.paymentSummaryEyebrow}>
                      Free access
                    </FitText>
                    <FitText style={s.paymentSummaryTitle}>
                      No upfront payment required
                    </FitText>
                    <FitText style={s.paymentSummaryBody}>
                      This reservation currently prices at{" "}
                      {formatCurrency(totalAmount)} for {reservationHours} hour
                      {reservationHours === 1 ? "" : "s"}.
                    </FitText>
                  </View>
                ) : (
                  <>
                    <View style={s.paymentOptionList}>
                      {[
                        {
                          key: "paymongo_downpayment" as const,
                          label: "PayMongo Downpayment",
                          meta: `Pay now ${formatCurrency(splitAmountDueNow)}`,
                          body: canUsePaymongo
                            ? `Leave ${formatCurrency(splitRemainingBalance)} for later.`
                            : "Temporarily unavailable on this local stack.",
                          disabled: !canUsePaymongo,
                        },
                        {
                          key: "cash_downpayment" as const,
                          label: "Cash Downpayment",
                          meta: `Pay now ${formatCurrency(splitAmountDueNow)}`,
                          body: `Settle ${formatCurrency(splitRemainingBalance)} on or after the booking date.`,
                          disabled: false,
                        },
                        {
                          key: "cash_full" as const,
                          label: "Cash Full Payment",
                          meta: `Pay now ${formatCurrency(totalAmount)}`,
                          body: "No remaining balance after staff verifies the payment.",
                          disabled: false,
                        },
                      ].map((option) => {
                        const isActive = paymentOption === option.key;
                        return (
                          <Pressable
                            key={option.key}
                            style={[
                              s.paymentOptionCard,
                              isActive && {
                                borderColor: colors.brand,
                                backgroundColor: colors.brand + "12",
                              },
                              option.disabled && s.paymentOptionCardDisabled,
                            ]}
                            onPress={() => {
                              if (option.disabled) {
                                setIsPaymongoNoticeOpen(true);
                                return;
                              }
                              setPaymentOption(option.key);
                            }}
                          >
                            <View style={s.paymentOptionText}>
                              <FitText
                                style={[
                                  s.paymentOptionLabel,
                                  isActive && { color: colors.brand },
                                ]}
                              >
                                {option.label}
                              </FitText>
                              <FitText style={s.paymentOptionMeta}>
                                {option.meta}
                              </FitText>
                              <FitText style={s.paymentOptionBody}>
                                {option.body}
                              </FitText>
                            </View>
                            {isActive ? (
                              <CheckCircle
                                size={18}
                                color={colors.brand}
                                strokeWidth={2}
                              />
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </View>
                    <View style={s.paymentSummaryCard}>
                      <FitText style={s.paymentSummaryEyebrow}>
                        {paymentOptionSummary.eyebrow}
                      </FitText>
                      <FitText style={s.paymentSummaryTitle}>
                        {paymentOptionSummary.title}
                      </FitText>
                      <FitText style={s.paymentSummaryBody}>
                        {paymentOptionSummary.body}
                      </FitText>
                      <View style={s.paymentSummaryRow}>
                        <FitText style={s.paymentSummaryLabel}>
                          Venue subtotal
                        </FitText>
                        <FitText style={s.paymentSummaryValue}>
                          {formatCurrency(venueTotalAmount)}
                        </FitText>
                      </View>
                      {selectedCoach ? (
                        <View style={s.paymentSummaryRow}>
                          <FitText style={s.paymentSummaryLabel}>
                            Coach add-on
                          </FitText>
                          <FitText style={s.paymentSummaryValue}>
                            {formatCurrency(coachAddOnAmount)}
                          </FitText>
                        </View>
                      ) : null}
                      <View style={s.paymentSummaryRow}>
                        <FitText style={s.paymentSummaryLabel}>
                          Reservation total
                        </FitText>
                        <FitText style={s.paymentSummaryValue}>
                          {formatCurrency(totalAmount)}
                        </FitText>
                      </View>
                      <View style={s.paymentSummaryRow}>
                        <FitText style={s.paymentSummaryLabel}>Pay now</FitText>
                        <FitText style={s.paymentSummaryValue}>
                          {formatCurrency(amountDueNow)}
                        </FitText>
                      </View>
                      <View style={s.paymentSummaryRow}>
                        <FitText style={s.paymentSummaryLabel}>
                          Remaining later
                        </FitText>
                        <FitText style={s.paymentSummaryValue}>
                          {formatCurrency(remainingBalance)}
                        </FitText>
                      </View>
                      <FitText style={s.paymentSummaryDeadline}>
                        {remainingBalance > 0
                          ? `Next payment window: on or after ${formatBookingDate(date)}.`
                          : "No later payment is scheduled for this reservation."}
                      </FitText>
                    </View>
                  </>
                )}
              </>
            ) : null}
            <View style={s.notesSectionHeader}>
              <FitText
                style={[s.sectionLabel, { marginTop: 16, marginBottom: 0 }]}
              >
                NOTES
              </FitText>
              <FitButton
                variant="link"
                icon={Plus}
                iconOnly
                iconSize={18}
                onPress={() => setNotes((prev) => [...prev, ""])}
                disabled={notes.length >= 10}
              />
            </View>
            {notes.map((note, idx) => {
              const atLimit = note.length >= 50;
              const counterColor =
                note.length === 50
                  ? colors.danger
                  : note.length >= 40
                    ? colors.warning
                    : colors.textMuted;
              return (
                <View key={idx} style={s.noteRow}>
                  <View style={s.noteContent}>
                    <View style={[s.inputFieldWrap, s.noteFieldWrap]}>
                      <FitText style={s.noteBullet}>•</FitText>
                      <FitTextInput
                        value={note}
                        onChangeText={(text) => {
                          if (text.length > 50) return;
                          setNotes((prev) =>
                            prev.map((currentNote, noteIndex) =>
                              noteIndex === idx ? text : currentNote,
                            ),
                          );
                        }}
                        placeholder="Add a note..."
                        multiline
                        style={[
                          s.noteInput,
                          atLimit && { color: colors.warning },
                        ]}
                      />
                    </View>
                    <FitText style={[s.noteCounter, { color: counterColor }]}>
                      {note.length}/50
                    </FitText>
                  </View>
                  <Pressable
                    onPress={() =>
                      setNotes((prev) =>
                        prev.filter((_, noteIndex) => noteIndex !== idx),
                      )
                    }
                    hitSlop={8}
                    style={s.noteRemoveBtn}
                  >
                    <XCircle
                      size={16}
                      color={colors.textMuted}
                      strokeWidth={2}
                    />
                  </Pressable>
                </View>
              );
            })}
            {notes.length === 0 ? (
              <FitText style={s.notesEmptyHint}>Tap + to add a note</FitText>
            ) : null}
          </ScrollView>
          <Animated.View style={[s.footer, footerBorderStyle]}>
            <FitButton
              label="Cancel"
              variant="ghost"
              onPress={handleClose}
              disabled={isSubmitting}
              flex={1}
            />
            <FitButton
              label={isSubmitting ? reservingText : confirmButtonLabel}
              variant="primary"
              onPress={handleConfirm}
              disabled={!canConfirm || isSubmitting}
              loading={isSubmitting}
              flex={2}
            />
          </Animated.View>
        </Animated.View>
      </Animated.View>
      </Modal>
      <NoticeModal
        isVisible={isPaymongoNoticeOpen}
        title={PAYMONGO_AVAILABILITY.modalTitle}
        message={PAYMONGO_AVAILABILITY.modalBody}
        onClose={() => setIsPaymongoNoticeOpen(false)}
      />
      <NoticeModal
        isVisible={successNotice != null}
        title={successNotice?.title ?? "Reservation updated"}
        message={successNotice?.message ?? ""}
        onClose={() => {
          setSuccessNotice(null);
          onClose();
        }}
      />
      <ConfirmModal
        isVisible={reservationConfirmation != null}
        title={reservationConfirmation?.title ?? "Confirm action"}
        message={reservationConfirmation?.message ?? ""}
        yesLabel={reservationConfirmation?.yesLabel ?? "Confirm"}
        noLabel="Cancel"
        isLoading={isSubmitting}
        loadingLabel={confirmButtonLabel.toUpperCase()}
        loadingTitle="Submitting reservation"
        onNo={() => {
          if (isSubmitting) return;
          setReservationConfirmation(null);
        }}
        onYes={() => {
          void submitReservation();
        }}
      />
      <CalendarModal
        isVisible={isCalOpen}
        selectedDate={date}
        blockPast
        defaultYear={new Date().getFullYear()}
        defaultMonth={new Date().getMonth() + 1}
        highlightedDates={highlightedCoachDates}
        onSelect={(selectedDate) => {
          setDate(selectedDate);
          setIsCalOpen(false);
        }}
        onClose={() => setIsCalOpen(false)}
      />
      <TimeSlotModal
        isVisible={isTimeOpen}
        slots={timeTarget === "start" ? TIME_SLOTS : endSlots}
        selectedTime={timeTarget === "start" ? startTime : endTime}
        onSelect={handleTimePick}
        onClose={() => setIsTimeOpen(false)}
      />
    </Fragment>
  );
}
