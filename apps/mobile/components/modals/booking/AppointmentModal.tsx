import { Fragment, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { CalendarDays, CheckCircle, Clock, Users } from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  isPaymongoCheckoutEnabled,
  PAYMONGO_AVAILABILITY,
  WEEKDAY_NAMES,
} from "@fittrack/app-config";

import type { CoachAvailabilityResponse } from "@fittrack/api-client";
import type { CoachProfileRecord } from "@fittrack/types";
import {
  activeCoachesQueryOptions,
  coachAvailabilityQueryOptions,
  createAppointmentMutationOptions,
  payAppointmentDownpaymentMutationOptions,
} from "@fittrack/query";
import {
  formatBookingDate,
  getDurationMinutes,
  to12HourLabel,
} from "@fittrack/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { mobileApiClient } from "@/lib/api-client";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useLoadingText } from "@fittrack/hooks";
import { getTodayString } from "@/data/bookings";
import { makeAppointmentModalStyles } from "@/styles/modals/AppointmentStyles";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
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

type CoachRecord = CoachProfileRecord;

type AppointmentStep = "coach" | "time";
type AppointmentPaymentOption =
  | "cash_downpayment"
  | "cash_full"
  | "paymongo_downpayment";
type AppointmentConfirmationState = {
  message: string;
  title: string;
  yesLabel: string;
};
type PaymentOptionCard = {
  body: string;
  disabled?: boolean;
  key: AppointmentPaymentOption;
  subtitle: string;
  title: string;
};

type SlotOption = {
  durationMin: number;
  label: string;
  startTime: string;
};

function getCoachName(coach: CoachRecord) {
  const standaloneName = coach.displayName?.trim();
  if (standaloneName && !standaloneName.includes("@")) return standaloneName;
  return "Coach Profile";
}

function getCoachInitials(coach: CoachRecord) {
  return (
    getCoachName(coach)
      .split(" ")
      .filter((part) => part.length > 0)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "C"
  );
}

function getCoachPrimarySpecialty(coach: CoachRecord) {
  return coach.specialties?.[0] ?? "General Coaching";
}

function getCoachPriceLabel(coach: CoachRecord) {
  if (coach.hourlyRate == null || !Number.isFinite(coach.hourlyRate)) {
    return "Rate pending";
  }

  return `PHP ${coach.hourlyRate.toLocaleString("en-PH")} / session`;
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

function toGymWallClockIso(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const gymOffsetMinutes = 8 * 60;
  return new Date(
    Date.UTC(year, month - 1, day, hour, minute) -
      gymOffsetMinutes * 60 * 1000,
  ).toISOString();
}

function getUpcomingAvailableDates(dayValues: Array<number | string>) {
  const availableDays = new Set<number>();
  dayValues.forEach((dayValue) => {
    if (typeof dayValue === "number") {
      availableDays.add(dayValue);
      return;
    }

    const normalized = String(dayValue).trim().toLowerCase();
    const numericDay = Number(normalized);
    if (Number.isInteger(numericDay)) {
      availableDays.add(numericDay);
      return;
    }
    const weekdayIndex = WEEKDAY_NAMES.findIndex((day) => day === normalized);
    if (weekdayIndex >= 0) {
      availableDays.add(weekdayIndex);
    }
  });

  if (availableDays.size === 0) return [];

  const dates: string[] = [];
  const cursor = new Date(`${getTodayString()}T00:00:00`);
  for (let offset = 0; offset < 90; offset += 1) {
    const nextDate = new Date(cursor);
    nextDate.setDate(cursor.getDate() + offset);
    if (availableDays.has(nextDate.getDay())) {
      const year = nextDate.getFullYear();
      const month = String(nextDate.getMonth() + 1).padStart(2, "0");
      const day = String(nextDate.getDate()).padStart(2, "0");
      dates.push(`${year}-${month}-${day}`);
    }
  }

  return dates;
}

function formatCurrency(value: number) {
  return `PHP ${value.toLocaleString("en-PH", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export default function AppointmentModal({
  isVisible,
  onClose,
  onSuccess,
}: Props) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");
  const s = useMemo(() => makeAppointmentModalStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const canUsePaymongo = isPaymongoCheckoutEnabled();
  const defaultPaymentOption: AppointmentPaymentOption = canUsePaymongo
    ? "paymongo_downpayment"
    : "cash_downpayment";
  const [step, setStep] = useState<AppointmentStep>("coach");
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [selectedSlotLabel, setSelectedSlotLabel] = useState("");
  const [paymentOption, setPaymentOption] =
    useState<AppointmentPaymentOption>(defaultPaymentOption);
  const [appointmentConfirmation, setAppointmentConfirmation] =
    useState<AppointmentConfirmationState | null>(null);
  const [successNotice, setSuccessNotice] = useState<{
    message: string;
    title: string;
  } | null>(null);
  const [isPaymongoNoticeOpen, setIsPaymongoNoticeOpen] = useState(false);
  const [isCalOpen, setIsCalOpen] = useState(false);
  const [isTimeOpen, setIsTimeOpen] = useState(false);
  const [errorText, setErrorText] = useState("");

  const {
    data: coaches = [],
    isLoading: coachesLoading,
    error: coachesError,
  } = useQuery({
    ...activeCoachesQueryOptions<CoachRecord>(mobileApiClient),
    enabled: isVisible,
  });

  const selectedCoach = useMemo(
    () => coaches.find((coach) => String(coach.id) === selectedCoachId) ?? null,
    [coaches, selectedCoachId],
  );

  const {
    data: availability,
    isLoading: availabilityLoading,
    error: availabilityError,
  } = useQuery({
    ...coachAvailabilityQueryOptions<CoachAvailabilityResponse>(
      mobileApiClient,
      selectedCoach ? String(selectedCoach.id) : undefined,
    ),
    enabled: isVisible && !!selectedCoach,
  });

  const bookedCoachDates = availability?.bookedDates ?? [];
  const bookedCoachDateSet = useMemo(
    () => new Set(bookedCoachDates),
    [bookedCoachDates],
  );
  const isSelectedCoachDateBooked =
    selectedCoach != null && bookedCoachDateSet.has(selectedDate);

  const slotOptions = useMemo<SlotOption[]>(() => {
    if (!availability?.availability) {
      return [];
    }
    if (bookedCoachDateSet.has(selectedDate)) {
      return [];
    }
    return availability.availability
      .filter(
        (slot) => slot.isAvailable && matchesDay(selectedDate, slot.dayOfWeek),
      )
      .map((slot) => ({
        label: to12HourLabel(slot.startTime),
        startTime: slot.startTime,
        durationMin: getDurationMinutes(slot.startTime, slot.endTime),
      }));
  }, [availability, bookedCoachDateSet, selectedDate]);
  const highlightedCoachDates = useMemo(
    () =>
      getUpcomingAvailableDates(
        availability?.availability
          ?.filter((slot) => slot.isAvailable)
          .map((slot) => slot.dayOfWeek) ?? [],
      ),
    [availability?.availability],
  );

  const timeSlots = useMemo<TimeSlot[]>(
    () =>
      slotOptions.map((slot) => ({
        time: slot.label,
        duration: `${Math.max(1, Math.round(slot.durationMin / 60))} hr`,
        status: "available",
        spots: 1,
      })),
    [slotOptions],
  );

  const selectedSlot = useMemo(
    () => slotOptions.find((slot) => slot.label === selectedSlotLabel) ?? null,
    [selectedSlotLabel, slotOptions],
  );

  const createAppointmentMutation = useMutation(
    createAppointmentMutationOptions(mobileApiClient, queryClient),
  );
  const payAppointmentMutation = useMutation(
    payAppointmentDownpaymentMutationOptions(mobileApiClient, queryClient),
  );

  const bookingLabel = useLoadingText(
    "BOOKING APPOINTMENT",
    createAppointmentMutation.isPending || payAppointmentMutation.isPending,
  );

  const estimatedTotalAmount = useMemo(() => {
    if (!selectedCoach || !selectedSlot) return 0;
    const rate = Number(selectedCoach.hourlyRate ?? 0);
    if (!Number.isFinite(rate) || rate <= 0) return 0;
    const slotHours = selectedSlot.durationMin / 60;
    return roundCurrency(rate * slotHours);
  }, [selectedCoach, selectedSlot]);
  const splitAmountDueNow = useMemo(
    () => roundCurrency(estimatedTotalAmount * 0.3),
    [estimatedTotalAmount],
  );
  const splitRemainingBalance = useMemo(
    () => roundCurrency(Math.max(0, estimatedTotalAmount - splitAmountDueNow)),
    [estimatedTotalAmount, splitAmountDueNow],
  );
  const isFreeAppointment = estimatedTotalAmount <= 0;
  const amountDueNow =
    paymentOption === "cash_full"
      ? estimatedTotalAmount
      : splitAmountDueNow;
  const remainingBalance =
    paymentOption === "cash_full" ? 0 : splitRemainingBalance;
  const paymentProvider =
    paymentOption === "paymongo_downpayment" ? "paymongo" : "cash";
  const paymentStage = paymentOption === "cash_full" ? "full" : "downpayment";
  const paymentOptionSummary = useMemo(() => {
    if (isFreeAppointment) {
      return {
        body: "This coach session currently prices at PHP 0, so no upfront payment is required.",
        eyebrow: "Free access",
        title: "No checkout required",
      };
    }

    if (paymentOption === "cash_full") {
      return {
        body: `Submit a full cash payment request for ${formatCurrency(estimatedTotalAmount)}. Staff will still verify the payment before the session is treated as fully paid.`,
        eyebrow: "Cash",
        title: "Full payment",
      };
    }

    if (paymentOption === "cash_downpayment") {
      return {
        body: `Submit a cash downpayment now, then settle the remaining ${formatCurrency(splitRemainingBalance)} on or after the session date.`,
        eyebrow: "Cash",
        title: "Split payment",
      };
    }

    return {
      body: `Start PayMongo checkout for the upfront ${formatCurrency(splitAmountDueNow)} now, then settle the remaining ${formatCurrency(splitRemainingBalance)} on or after the session date.`,
      eyebrow: canUsePaymongo ? "PayMongo" : "PayMongo unavailable",
      title: "Online downpayment",
    };
  }, [
    canUsePaymongo,
    estimatedTotalAmount,
    isFreeAppointment,
    paymentOption,
    splitAmountDueNow,
    splitRemainingBalance,
  ]);
  const paymentOptionCards = useMemo<PaymentOptionCard[]>(
    () => [
      {
        body: canUsePaymongo
          ? `Pay now ${formatCurrency(splitAmountDueNow)}`
          : "PayMongo is unavailable right now.",
        disabled: !canUsePaymongo,
        key: "paymongo_downpayment",
        subtitle: `Leave ${formatCurrency(splitRemainingBalance)} for later.`,
        title: "PayMongo Downpayment",
      },
      {
        body: `Pay now ${formatCurrency(splitAmountDueNow)}`,
        key: "cash_downpayment",
        subtitle: `Settle ${formatCurrency(splitRemainingBalance)} on or after the session date.`,
        title: "Cash Downpayment",
      },
      {
        body: `Pay now ${formatCurrency(estimatedTotalAmount)}`,
        key: "cash_full",
        subtitle:
          "No remaining balance after staff verifies the payment.",
        title: "Cash Full Payment",
      },
    ],
    [
      canUsePaymongo,
      estimatedTotalAmount,
      splitAmountDueNow,
      splitRemainingBalance,
    ],
  );

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

  const coachLoadMessage =
    coachesError instanceof Error
      ? coachesError.message
      : "Unable to load coach profiles right now.";

  const availabilityStatusMessage = useMemo(() => {
    if (!selectedCoach) {
      return "Select a coach to inspect their profile and live availability.";
    }
    if (availabilityLoading) {
      return "Loading live availability for this coach.";
    }
    if (availabilityError) {
      return availabilityError instanceof Error
        ? availabilityError.message
        : "Unable to load live availability for this coach.";
    }
    if (isSelectedCoachDateBooked) {
      return `${getCoachName(selectedCoach)} already has a booking on ${formatBookingDate(selectedDate)}. Pick another highlighted day.`;
    }
    if (slotOptions.length === 0) {
      return `No active slots are available on ${formatBookingDate(selectedDate)}. Try another date or another coach.`;
    }
    return `${slotOptions.length} available slot${slotOptions.length === 1 ? "" : "s"} on ${formatBookingDate(selectedDate)}.`;
  }, [
    availabilityError,
    availabilityLoading,
    isSelectedCoachDateBooked,
    selectedCoach,
    selectedDate,
    slotOptions.length,
  ]);

  const resetAndClose = () => {
    if (
      createAppointmentMutation.isPending ||
      payAppointmentMutation.isPending
    ) {
      return;
    }
    setStep("coach");
    setSelectedCoachId(null);
    setSelectedDate(getTodayString());
    setSelectedSlotLabel("");
    setPaymentOption(defaultPaymentOption);
    setAppointmentConfirmation(null);
    setSuccessNotice(null);
    setIsPaymongoNoticeOpen(false);
    setIsCalOpen(false);
    setIsTimeOpen(false);
    setErrorText("");
    onClose();
  };

  const goToTimeStep = () => {
    if (!selectedCoach) {
      setErrorText("Select a coach to continue.");
      return;
    }
    setErrorText("");
    setStep("time");
  };

  const handleBookAppointment = async () => {
    if (!selectedCoach || !selectedSlot) {
      setErrorText("Select both date and time.");
      return;
    }
    if (isSelectedCoachDateBooked) {
      setErrorText("This coach already has a booking on the selected date.");
      return;
    }
    if (
      !isFreeAppointment &&
      paymentProvider === "paymongo" &&
      !canUsePaymongo
    ) {
      setIsPaymongoNoticeOpen(true);
      return;
    }
    setErrorText("");
    let appointmentId: string | null = null;
    try {
      const createdAppointment = await createAppointmentMutation.mutateAsync({
        payload: {
          coachId: String(selectedCoach.id),
          scheduledAt: toGymWallClockIso(selectedDate, selectedSlot.startTime),
          duration: selectedSlot.durationMin,
        },
      });
      appointmentId = createdAppointment.id;

      if (isFreeAppointment) {
        onSuccess?.();
        setSuccessNotice({
          title: "Appointment confirmed",
          message: `${getCoachName(selectedCoach)} is now reserved for ${formatBookingDate(selectedDate)} at ${selectedSlot.label}.`,
        });
        setAppointmentConfirmation(null);
        setStep("coach");
        setSelectedCoachId(null);
        setSelectedDate(getTodayString());
        setSelectedSlotLabel("");
        setPaymentOption(defaultPaymentOption);
        setErrorText("");
        return;
      }

      const paymentResult = await payAppointmentMutation.mutateAsync({
        appointmentId: createdAppointment.id,
        paymentStage,
        provider: paymentProvider,
      });

      if (paymentResult.checkoutUrl) {
        onSuccess?.();
        setAppointmentConfirmation(null);
        resetAndClose();
        void Linking.openURL(paymentResult.checkoutUrl);
        return;
      }

      const successTitle =
        paymentOption === "cash_full"
          ? "Cash payment submitted"
          : "Downpayment submitted";
      const successMessage =
        paymentOption === "cash_full"
          ? `Your coach appointment is pending staff verification for the full cash payment of ${formatCurrency(estimatedTotalAmount)}.`
          : `Your coach appointment is pending staff verification for the upfront ${formatCurrency(amountDueNow)}. The remaining ${formatCurrency(remainingBalance)} can be collected on or after ${formatBookingDate(selectedDate)}.`;

      onSuccess?.();
      setSuccessNotice({
        title: successTitle,
        message: successMessage,
      });
      setAppointmentConfirmation(null);
      setStep("coach");
      setSelectedCoachId(null);
      setSelectedDate(getTodayString());
      setSelectedSlotLabel("");
      setPaymentOption(defaultPaymentOption);
      setErrorText("");
    } catch (error: unknown) {
      setErrorText(
        appointmentId
          ? error instanceof Error
            ? `${error.message} The appointment was created, but payment did not finish. You can continue payment from the booking details.`
            : "The appointment was created, but payment did not finish. You can continue payment from the booking details."
          : error instanceof Error
            ? error.message
            : "Unable to book appointment.",
      );
    }
  };

  const handleConfirm = () => {
    if (!selectedCoach || !selectedSlot) {
      setErrorText("Select both date and time.");
      return;
    }
    if (isSelectedCoachDateBooked) {
      setErrorText("This coach already has a booking on the selected date.");
      return;
    }

    const scheduleLabel = `${formatBookingDate(selectedDate)} at ${selectedSlot.label}`;
    const coachName = getCoachName(selectedCoach);

    if (isFreeAppointment) {
      setAppointmentConfirmation({
        title: "Confirm coach appointment?",
        message: `Book ${coachName} for ${scheduleLabel}. No upfront payment will be collected for this session.`,
        yesLabel: "Confirm Appointment",
      });
      return;
    }

    if (paymentOption === "paymongo_downpayment") {
      setAppointmentConfirmation({
        title: "Continue to PayMongo?",
        message: `You are about to start PayMongo checkout for ${formatCurrency(amountDueNow)} for ${coachName} on ${scheduleLabel}. The remaining ${formatCurrency(remainingBalance)} stays due on or after the session date.`,
        yesLabel: "Continue to PayMongo",
      });
      return;
    }

    if (paymentOption === "cash_full") {
      setAppointmentConfirmation({
        title: "Submit full cash payment?",
        message: `Submit a full cash payment request for ${formatCurrency(estimatedTotalAmount)} for ${coachName} on ${scheduleLabel}. Staff will still verify the payment before it is treated as fully paid.`,
        yesLabel: "Submit Full Payment",
      });
      return;
    }

    setAppointmentConfirmation({
      title: "Submit cash downpayment?",
      message: `Submit a cash downpayment request for ${formatCurrency(amountDueNow)} for ${coachName} on ${scheduleLabel}. The remaining ${formatCurrency(remainingBalance)} will stay due on or after the session date.`,
      yesLabel: "Submit Downpayment",
    });
  };

  return (
    <Fragment>
      <Modal
        visible={
          isVisible &&
          appointmentConfirmation == null &&
          successNotice == null &&
          !isPaymongoNoticeOpen
        }
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={resetAndClose}
      >
        <KeyboardAvoidingView
          style={s.fill}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Animated.View style={[s.backdrop, backdropStyle]}>
            <Animated.View style={[s.card, cardStyle]}>
            <Animated.View style={[s.header, headerBorderStyle]}>
              <View style={s.headerIcon}>
                <Users size={18} color={colors.brand} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <FitText style={s.headerTitle}>Book a Trainer</FitText>
                <FitText style={s.headerSubtitle}>
                  {step === "coach"
                    ? "Step 1 of 2 - Review coach profile"
                    : "Step 2 of 2 - Pick a live slot"}
                </FitText>
              </View>
            </Animated.View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.body}
            >
              {step === "coach" ? (
                <View style={{ gap: 12 }}>
                  <View>
                    <FitText style={s.sectionLabel}>AVAILABLE COACHES</FitText>
                    {coachesLoading ? (
                      <FitText style={s.helperText}>
                        Loading coach profiles...
                      </FitText>
                    ) : coaches.length === 0 ? (
                      <FitText style={s.helperText}>
                        No bookable coaches are available yet.
                      </FitText>
                    ) : (
                      <View style={s.coachList}>
                        {coaches.map((coach) => {
                          const isActive = selectedCoach?.id === coach.id;
                          return (
                            <Pressable
                              key={coach.id}
                              style={[
                                s.coachRow,
                                isActive && {
                                  borderColor: colors.brand,
                                  backgroundColor: colors.brand + "10",
                                },
                              ]}
                              onPress={() => {
                                setSelectedCoachId(
                                  isActive ? null : String(coach.id),
                                );
                                setErrorText("");
                                setSelectedSlotLabel("");
                              }}
                            >
                              <View
                                style={[
                                  s.coachAvatar,
                                  isActive && { backgroundColor: colors.brand },
                                ]}
                              >
                                <FitText
                                  style={[
                                    s.coachAvatarText,
                                    isActive && { color: colors.surface },
                                  ]}
                                >
                                  {getCoachInitials(coach)}
                                </FitText>
                              </View>
                              <View style={s.coachInfo}>
                                <FitText style={s.coachName}>
                                  {getCoachName(coach)}
                                </FitText>
                                <FitText style={s.coachSpecialty}>
                                  {getCoachPrimarySpecialty(coach)} {" - "}
                                  {getCoachPriceLabel(coach)}
                                </FitText>
                                <FitText style={s.coachBio}>
                                  {coach.bio?.trim() ||
                                    "Staff has not added a coach bio yet."}
                                </FitText>
                                <View style={s.coachMetaRow}>
                                  {(coach.specialties ?? [])
                                    .slice(0, 2)
                                    .map((specialty) => (
                                      <View
                                        key={`${coach.id}-${specialty}`}
                                        style={s.coachMetaChip}
                                      >
                                        <FitText style={s.coachMetaChipText}>
                                          {specialty}
                                        </FitText>
                                      </View>
                                    ))}
                                  {(coach.certifications ?? [])
                                    .slice(0, 1)
                                    .map((certification) => (
                                      <View
                                        key={`${coach.id}-${certification}`}
                                        style={s.coachMetaChip}
                                      >
                                        <FitText style={s.coachMetaChipText}>
                                          {certification}
                                        </FitText>
                                      </View>
                                    ))}
                                </View>
                              </View>
                              {isActive ? (
                                <CheckCircle
                                  size={16}
                                  color={colors.brand}
                                  strokeWidth={2}
                                />
                              ) : null}
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                    {coachesError ? (
                      <FitText style={s.errorText}>{coachLoadMessage}</FitText>
                    ) : null}
                  </View>
                  <View style={s.previewCard}>
                    <FitText style={s.previewTitle}>
                      {selectedCoach
                        ? `Coach review: ${getCoachName(selectedCoach)}`
                        : "Coach review required"}
                    </FitText>
                    <FitText style={s.previewSubtitle}>
                      {selectedCoach
                        ? selectedCoach.bio?.trim() ||
                          "This coach profile still needs a fuller bio from staff."
                        : "Review the coach profile and the live slot summary before continuing to time selection."}
                    </FitText>
                    <View style={s.previewSection}>
                      <FitText style={s.previewSectionTitle}>
                        SPECIALTIES
                      </FitText>
                      <FitText style={s.previewPlainText}>
                        {selectedCoach?.specialties?.length
                          ? selectedCoach.specialties.join(", ")
                          : "No specialties listed yet."}
                      </FitText>
                    </View>
                    <View style={s.previewSection}>
                      <FitText style={s.previewSectionTitle}>
                        CERTIFICATIONS
                      </FitText>
                      <FitText style={s.previewPlainText}>
                        {selectedCoach?.certifications?.length
                          ? selectedCoach.certifications.join(", ")
                          : "No certifications listed yet."}
                      </FitText>
                    </View>
                    <View style={s.previewSection}>
                      <FitText style={s.previewSectionTitle}>
                        LIVE SLOT CHECK
                      </FitText>
                      <FitText style={s.previewPlainText}>
                        {availabilityStatusMessage}
                      </FitText>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  {selectedCoach ? (
                    <View style={s.previewCard}>
                      <FitText style={s.previewTitle}>
                        {getCoachName(selectedCoach)}
                      </FitText>
                      <FitText style={s.previewSubtitle}>
                        {getCoachPrimarySpecialty(selectedCoach)} {" - "}{" "}
                        {getCoachPriceLabel(selectedCoach)}
                      </FitText>
                      <View style={s.previewSection}>
                        <FitText style={s.previewSectionTitle}>
                          DAY CHECK
                        </FitText>
                        <FitText style={s.previewPlainText}>
                          {availabilityStatusMessage}
                        </FitText>
                      </View>
                    </View>
                  ) : null}
                  <View>
                    <FitText style={s.sectionLabel}>SELECT DATE</FitText>
                    <Pressable
                      style={[
                        s.fieldBtn,
                        {
                          borderColor: isSelectedCoachDateBooked
                            ? colors.danger
                            : colors.fieldBorder,
                        },
                      ]}
                      onPress={() => setIsCalOpen(true)}
                    >
                      <CalendarDays
                        size={16}
                        color={colors.textMuted}
                        strokeWidth={2}
                      />
                      <FitText style={s.fieldBtnText}>
                        {formatBookingDate(selectedDate)}
                      </FitText>
                    </Pressable>
                  </View>
                  <View>
                    <FitText style={s.sectionLabel}>SELECT TIME SLOT</FitText>
                    <Pressable
                      style={[
                        s.fieldBtn,
                        {
                          borderColor: selectedSlotLabel
                            ? colors.brand
                            : colors.fieldBorder,
                        },
                      ]}
                      onPress={() => setIsTimeOpen(true)}
                    >
                      <Clock
                        size={16}
                        color={
                          selectedSlotLabel ? colors.brand : colors.textMuted
                        }
                        strokeWidth={2}
                      />
                      <FitText
                        style={[
                          s.fieldBtnText,
                          selectedSlotLabel && { color: colors.textPrimary },
                        ]}
                      >
                        {selectedSlotLabel || "Choose available slot"}
                      </FitText>
                    </Pressable>
                    <FitText style={s.helperText}>
                      {availabilityStatusMessage}
                    </FitText>
                  </View>
                  <View style={s.previewCard}>
                    <View style={s.paymentHeaderRow}>
                      <View>
                        <FitText style={s.previewSectionTitle}>
                          PAYMENT OPTIONS
                        </FitText>
                        <FitText style={s.helperText}>
                          Choose how this coach appointment should be charged.
                        </FitText>
                      </View>
                    </View>
                    <View style={s.paymentOptionList}>
                      {paymentOptionCards.map((option) => {
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
                              if (option.disabled) return;
                              setPaymentOption(option.key);
                              setErrorText("");
                            }}
                            disabled={option.disabled}
                          >
                            <View style={{ flex: 1, gap: 4 }}>
                              <FitText
                                style={[
                                  s.paymentOptionTitle,
                                  option.disabled && s.paymentOptionTitleDisabled,
                                ]}
                              >
                                {option.title}
                              </FitText>
                              <FitText
                                style={[
                                  s.paymentOptionBody,
                                  option.disabled && s.paymentOptionBodyDisabled,
                                ]}
                              >
                                {option.body}
                              </FitText>
                              <FitText
                                style={[
                                  s.paymentOptionBody,
                                  option.disabled && s.paymentOptionBodyDisabled,
                                ]}
                              >
                                {option.subtitle}
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
                      <FitText style={s.previewSectionTitle}>
                        {paymentOptionSummary.eyebrow}
                      </FitText>
                      <FitText style={s.previewTitle}>
                        {paymentOptionSummary.title}
                      </FitText>
                      <FitText style={s.previewPlainText}>
                        {paymentOptionSummary.body}
                      </FitText>
                      <View style={s.paymentBreakdownRow}>
                        <View style={s.paymentBreakdownColumn}>
                          <FitText style={s.previewSectionTitle}>TOTAL</FitText>
                          <FitText style={s.paymentBreakdownValue}>
                            {formatCurrency(estimatedTotalAmount)}
                          </FitText>
                        </View>
                        <View style={s.paymentBreakdownColumn}>
                          <FitText style={s.previewSectionTitle}>
                            DUE NOW
                          </FitText>
                          <FitText style={s.paymentBreakdownValue}>
                            {formatCurrency(amountDueNow)}
                          </FitText>
                        </View>
                        <View style={s.paymentBreakdownColumn}>
                          <FitText style={s.previewSectionTitle}>
                            REMAINING
                          </FitText>
                          <FitText style={s.paymentBreakdownValue}>
                            {formatCurrency(remainingBalance)}
                          </FitText>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              )}
              {errorText ? (
                <FitText style={s.errorText}>{errorText}</FitText>
              ) : null}
            </ScrollView>
            <Animated.View style={[s.footer, footerBorderStyle]}>
              <FitButton
                label={step === "coach" ? "Cancel" : "Back"}
                variant="ghost"
                onPress={
                  step === "coach" ? resetAndClose : () => setStep("coach")
                }
                disabled={createAppointmentMutation.isPending}
                flex={1}
              />
              <FitButton
                label={step === "coach" ? "Continue" : bookingLabel}
                variant="primary"
                onPress={step === "coach" ? goToTimeStep : handleConfirm}
                disabled={
                  step === "time"
                    ? !selectedSlot ||
                      isSelectedCoachDateBooked ||
                      createAppointmentMutation.isPending ||
                      payAppointmentMutation.isPending
                    : !selectedCoach || coachesLoading
                }
                loading={
                  createAppointmentMutation.isPending ||
                  payAppointmentMutation.isPending
                }
                flex={2}
              />
            </Animated.View>
            </Animated.View>
          </Animated.View>
          <CalendarModal
            isVisible={isCalOpen}
            selectedDate={selectedDate}
            blockPast
            defaultYear={new Date().getFullYear()}
            defaultMonth={new Date().getMonth() + 1}
            blockedDates={bookedCoachDates}
            highlightedDates={highlightedCoachDates}
            onSelect={(date) => {
              setSelectedDate(date);
              setSelectedSlotLabel("");
              setIsCalOpen(false);
            }}
            onClose={() => setIsCalOpen(false)}
          />
          <TimeSlotModal
            isVisible={isTimeOpen}
            slots={timeSlots}
            selectedTime={selectedSlotLabel}
            onSelect={(slot) => {
              setSelectedSlotLabel(slot.time);
              setIsTimeOpen(false);
            }}
            onClose={() => setIsTimeOpen(false)}
          />
        </KeyboardAvoidingView>
      </Modal>
      <NoticeModal
        isVisible={isPaymongoNoticeOpen}
        title={PAYMONGO_AVAILABILITY.modalTitle}
        message={PAYMONGO_AVAILABILITY.modalBody}
        buttonLabel="Got it"
        onClose={() => setIsPaymongoNoticeOpen(false)}
      />
      <NoticeModal
        isVisible={successNotice != null}
        title={successNotice?.title ?? "Appointment updated"}
        message={successNotice?.message ?? ""}
        buttonLabel="OK"
        onClose={() => {
          setSuccessNotice(null);
          onClose();
        }}
      />
      <ConfirmModal
        isVisible={appointmentConfirmation != null}
        title={appointmentConfirmation?.title ?? "Confirm action"}
        message={appointmentConfirmation?.message ?? ""}
        yesLabel={appointmentConfirmation?.yesLabel ?? "Confirm"}
        noLabel="Cancel"
        isLoading={
          createAppointmentMutation.isPending || payAppointmentMutation.isPending
        }
        loadingLabel={bookingLabel}
        loadingTitle="Submitting appointment"
        onNo={() => {
          if (
            createAppointmentMutation.isPending ||
            payAppointmentMutation.isPending
          ) {
            return;
          }
          setAppointmentConfirmation(null);
        }}
        onYes={() => {
          void handleBookAppointment();
        }}
      />
    </Fragment>
  );
}
