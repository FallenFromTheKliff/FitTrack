import { Fragment, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  View,
} from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { CalendarDays, CheckCircle, Clock, Users } from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { WEEKDAY_NAMES } from "@fittrack/app-config";

import type { CoachAvailabilityResponse } from "@fittrack/api-client";
import type { CoachProfileRecord } from "@fittrack/types";
import {
  activeCoachesQueryOptions,
  coachAvailabilityQueryOptions,
  createAppointmentMutationOptions,
} from "@fittrack/query";
import {
  expandCoachAvailabilitySlots,
  formatBookingDate,
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
import FitSearch from "@/components/fit/FitSearch";
import CalendarModal from "@/components/modals/shared/CalendarModal";
import ConfirmModal from "@/components/modals/shared/ConfirmModal";
import NoticeModal from "@/components/modals/shared/NoticeModal";
import FitModalScrollView from "@/components/modals/shared/FitModalScrollView";
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
type AppointmentPlanMode = "single" | "pack" | "recurring";
type AppointmentConfirmationState = {
  message: string;
  title: string;
  yesLabel: string;
};
type PlanOptionCard = {
  body: string;
  key: AppointmentPlanMode;
  sessionCount: number;
  title: string;
};

type SlotOption = {
  durationMin: number;
  label: string;
  startTime: string;
};

const COACH_SPECIALIZATION_FILTERS = [
  "All",
  "Strength",
  "Mobility",
  "Boxing",
  "Conditioning",
] as const;
const COACH_RATING_FILTERS = [
  { label: "Any rating", value: 0 },
  { label: "4+ stars", value: 4 },
] as const;
const PLAN_OPTION_CARDS: PlanOptionCard[] = [
  {
    body: "Reserve one coach session from the live availability calendar.",
    key: "single",
    sessionCount: 1,
    title: "Single Session",
  },
  {
    body: "Start with this slot and mark the booking as a multi-session pack request.",
    key: "pack",
    sessionCount: 3,
    title: "3-Session Pack",
  },
  {
    body: "Start with this slot and mark the request for a recurring coach plan.",
    key: "recurring",
    sessionCount: 4,
    title: "Recurring Plan",
  },
];

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

function getCoachRatingLabel(coach: CoachRecord) {
  if (!coach.averageRating || coach.ratingCount === 0) {
    return "New coach";
  }

  return `${coach.averageRating.toFixed(1)} stars (${coach.ratingCount ?? 0})`;
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

function timeValueToMinutes(value: string) {
  const [hour = 0, minute = 0] = value.split(":").map(Number);
  return hour * 60 + minute;
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
  const [step, setStep] = useState<AppointmentStep>("coach");
  const [planMode, setPlanMode] = useState<AppointmentPlanMode>("single");
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [selectedSlotLabel, setSelectedSlotLabel] = useState("");
  const [appointmentConfirmation, setAppointmentConfirmation] =
    useState<AppointmentConfirmationState | null>(null);
  const [successNotice, setSuccessNotice] = useState<{
    message: string;
    title: string;
  } | null>(null);
  const [isCalOpen, setIsCalOpen] = useState(false);
  const [isTimeOpen, setIsTimeOpen] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [coachSearch, setCoachSearch] = useState("");
  const [specializationFilter, setSpecializationFilter] =
    useState<(typeof COACH_SPECIALIZATION_FILTERS)[number]>("All");
  const [minimumRating, setMinimumRating] =
    useState<(typeof COACH_RATING_FILTERS)[number]["value"]>(0);

  const {
    data: coaches = [],
    isLoading: coachesLoading,
    error: coachesError,
  } = useQuery({
    ...activeCoachesQueryOptions<CoachRecord>(mobileApiClient, {
      ...(minimumRating > 0 ? { minRating: minimumRating } : {}),
      ...(specializationFilter !== "All"
        ? { specialization: specializationFilter }
        : {}),
    }),
    enabled: isVisible,
  });

  const filteredCoaches = useMemo(() => {
    const query = coachSearch.trim().toLowerCase();
    if (!query) return coaches;

    return coaches.filter((coach) => {
      const haystack = [
        getCoachName(coach),
        coach.bio ?? "",
        ...(coach.specialties ?? []),
        ...(coach.certifications ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [coachSearch, coaches]);

  useEffect(() => {
    if (!selectedCoachId) return;
    if (filteredCoaches.some((coach) => String(coach.id) === selectedCoachId)) {
      return;
    }
    setSelectedCoachId(null);
    setSelectedSlotLabel("");
  }, [filteredCoaches, selectedCoachId]);

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

  const bookedCoachDates = useMemo(
    () => availability?.bookedDates ?? [],
    [availability?.bookedDates],
  );
  const bookedCoachDateSet = useMemo(
    () => new Set(bookedCoachDates),
    [bookedCoachDates],
  );
  const isSelectedCoachDateBooked =
    selectedCoach != null && bookedCoachDateSet.has(selectedDate);
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const slotOptions = useMemo<SlotOption[]>(() => {
    if (!availability?.availability) {
      return [];
    }
    if (bookedCoachDateSet.has(selectedDate)) {
      return [];
    }
    return expandCoachAvailabilitySlots(
      availability.availability,
      "full_time",
    )
      .filter(
        (slot) =>
          slot.isAvailable &&
          matchesDay(selectedDate, slot.dayOfWeek) &&
          (selectedDate !== getTodayString() ||
            timeValueToMinutes(slot.startTime) > currentMinutes),
      )
      .map((slot) => ({
        label: to12HourLabel(slot.startTime),
        startTime: slot.startTime,
        durationMin: slot.durationMinutes,
      }));
  }, [availability, bookedCoachDateSet, currentMinutes, selectedDate]);
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

  const bookingLabel = useLoadingText(
    "SENDING REQUEST",
    createAppointmentMutation.isPending,
  );

  const selectedCoachRate = useMemo(() => {
    if (!selectedCoach || selectedCoach.hourlyRate == null) return null;
    const rate = Number(selectedCoach.hourlyRate);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  }, [selectedCoach]);
  const hasSelectedSlot = selectedSlot != null;
  const hasValidCoachRate = selectedCoachRate != null;
  const estimatedTotalAmount = useMemo(() => {
    if (!selectedSlot || selectedCoachRate == null) return 0;
    const slotHours = selectedSlot.durationMin / 60;
    return roundCurrency(selectedCoachRate * slotHours);
  }, [selectedCoachRate, selectedSlot]);
  const selectedPlan = useMemo(
    () =>
      PLAN_OPTION_CARDS.find((option) => option.key === planMode) ??
      PLAN_OPTION_CARDS[0],
    [planMode],
  );
  const splitAmountDueNow = useMemo(
    () => roundCurrency(estimatedTotalAmount * 0.3),
    [estimatedTotalAmount],
  );
  const splitRemainingBalance = useMemo(
    () => roundCurrency(Math.max(0, estimatedTotalAmount - splitAmountDueNow)),
    [estimatedTotalAmount, splitAmountDueNow],
  );
  const canShowPaymentBreakdown = hasSelectedSlot && hasValidCoachRate;
  const totalAmountLabel = canShowPaymentBreakdown
    ? formatCurrency(estimatedTotalAmount)
    : "Pending";
  const downpaymentLabel = canShowPaymentBreakdown
    ? formatCurrency(splitAmountDueNow)
    : "Pending";
  const remainingBalanceLabel = canShowPaymentBreakdown
    ? formatCurrency(splitRemainingBalance)
    : "Pending";
  const paymentEstimateSummary = useMemo(() => {
    if (!hasSelectedSlot) {
      return {
        body: "Choose a live available slot before FitTrack calculates pricing.",
        eyebrow: "Slot required",
        title: "Payment estimate pending",
      };
    }

    if (!hasValidCoachRate) {
      return {
        body: "This coach does not have a valid session rate yet. Staff must update the coach profile before members can book.",
        eyebrow: "Rate pending",
        title: "Request locked",
      };
    }

    return {
      body: `Estimated total is ${formatCurrency(estimatedTotalAmount)}. After the coach accepts, open Bookings to choose PayMongo or cash for the ${formatCurrency(splitAmountDueNow)} downpayment or full payment.`,
      eyebrow: "After coach acceptance",
      title: "Payment unlocks later",
    };
  }, [
    estimatedTotalAmount,
    hasSelectedSlot,
    hasValidCoachRate,
    splitAmountDueNow,
  ]);

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
    if (createAppointmentMutation.isPending) {
      return;
    }
    setStep("coach");
    setSelectedCoachId(null);
    setPlanMode("single");
    setSelectedDate(getTodayString());
    setSelectedSlotLabel("");
    setAppointmentConfirmation(null);
    setSuccessNotice(null);
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
    if (!hasValidCoachRate) {
      setErrorText("This coach does not have a valid session rate yet.");
      return;
    }
    if (isSelectedCoachDateBooked) {
      setErrorText("This coach already has a booking on the selected date.");
      return;
    }
    setErrorText("");
    try {
      await createAppointmentMutation.mutateAsync({
        payload: {
          coachId: String(selectedCoach.id),
          scheduledAt: toGymWallClockIso(selectedDate, selectedSlot.startTime),
          duration: selectedSlot.durationMin,
          bookingMode: planMode,
          sessionCount: selectedPlan.sessionCount,
        },
      });

      onSuccess?.();
      setSuccessNotice({
        title: "Coach request sent",
        message: `${getCoachName(selectedCoach)} received your ${selectedPlan.title.toLowerCase()} request for ${formatBookingDate(selectedDate)} at ${selectedSlot.label}. Payment options will appear in Bookings after the coach accepts.`,
      });
      setAppointmentConfirmation(null);
      setStep("coach");
      setSelectedCoachId(null);
      setPlanMode("single");
      setSelectedDate(getTodayString());
      setSelectedSlotLabel("");
      setErrorText("");
    } catch (error: unknown) {
      setErrorText(
        error instanceof Error ? error.message : "Unable to request appointment.",
      );
    }
  };

  const handleConfirm = () => {
    if (!selectedCoach || !selectedSlot) {
      setErrorText("Select both date and time.");
      return;
    }
    if (!hasValidCoachRate) {
      setErrorText("This coach does not have a valid session rate yet.");
      return;
    }
    if (isSelectedCoachDateBooked) {
      setErrorText("This coach already has a booking on the selected date.");
      return;
    }

    const scheduleLabel = `${formatBookingDate(selectedDate)} at ${selectedSlot.label}`;
    const coachName = getCoachName(selectedCoach);
    const planCopy =
      planMode === "single"
        ? "This reserves one coach session."
        : planMode === "pack"
          ? "This reserves the first session and flags the booking as a 3-session pack request for staff confirmation."
          : "This reserves the first session and flags the booking as a recurring coach plan request for admin confirmation.";

    setAppointmentConfirmation({
      title: "Send coach request?",
      message: `Request ${coachName} for ${scheduleLabel}. ${planCopy} Estimated total is ${formatCurrency(estimatedTotalAmount)}. Payment options become available in Bookings after the coach accepts.`,
      yesLabel: "Send Request",
    });
  };

  return (
    <Fragment>
      <Modal
        visible={
          isVisible &&
          appointmentConfirmation == null &&
          successNotice == null &&
          !isCalOpen &&
          !isTimeOpen
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
            <FitModalScrollView
              style={s.middle}
              contentContainerStyle={s.body}
              resetKey={`${isVisible}-${step}`}
            >
              {step === "coach" ? (
                <View style={{ gap: 12 }}>
                  <View>
                    <FitText style={s.sectionLabel}>AVAILABLE COACHES</FitText>
                    <View style={s.filterPanel}>
                      <FitSearch
                        value={coachSearch}
                        onChangeText={setCoachSearch}
                        placeholder="Search coach, skill, or credential"
                      />
                      <View style={s.filterChipRow}>
                        {COACH_SPECIALIZATION_FILTERS.map((filter) => {
                          const isActive = specializationFilter === filter;
                          return (
                            <Pressable
                              key={filter}
                              style={[
                                s.filterChip,
                                isActive && {
                                  borderColor: colors.brand,
                                  backgroundColor: colors.brand + "12",
                                },
                              ]}
                              onPress={() => {
                                setSpecializationFilter(filter);
                                setSelectedSlotLabel("");
                              }}
                            >
                              <FitText
                                style={[
                                  s.filterChipText,
                                  isActive && { color: colors.brand },
                                ]}
                              >
                                {filter}
                              </FitText>
                            </Pressable>
                          );
                        })}
                      </View>
                      <View style={s.filterChipRow}>
                        {COACH_RATING_FILTERS.map((filter) => {
                          const isActive = minimumRating === filter.value;
                          return (
                            <Pressable
                              key={filter.label}
                              style={[
                                s.filterChip,
                                isActive && {
                                  borderColor: colors.warning,
                                  backgroundColor: colors.warning + "14",
                                },
                              ]}
                              onPress={() => {
                                setMinimumRating(filter.value);
                                setSelectedSlotLabel("");
                              }}
                            >
                              <FitText
                                style={[
                                  s.filterChipText,
                                  isActive && { color: colors.warning },
                                ]}
                              >
                                {filter.label}
                              </FitText>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                    {coachesLoading ? (
                      <FitText style={s.helperText}>
                        Loading coach profiles...
                      </FitText>
                    ) : filteredCoaches.length === 0 ? (
                      <FitText style={s.helperText}>
                        No bookable coaches match those filters.
                      </FitText>
                    ) : (
                      <View style={s.coachList}>
                        {filteredCoaches.map((coach) => {
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
                                <FitText style={s.coachRating}>
                                  {getCoachRatingLabel(coach)}
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
                                {coach.recentReviews?.[0]?.comment ? (
                                  <FitText style={s.coachReviewQuote}>
                                    {coach.recentReviews[0].comment}
                                  </FitText>
                                ) : null}
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
                  <View style={s.previewCard}>
                    <FitText style={s.previewSectionTitle}>
                      SESSION PLAN
                    </FitText>
                    <View style={s.planOptionList}>
                      {PLAN_OPTION_CARDS.map((option) => {
                        const isActive = planMode === option.key;
                        return (
                          <Pressable
                            key={option.key}
                            style={[
                              s.planOptionCard,
                              isActive && {
                                borderColor: colors.brand,
                                backgroundColor: colors.brand + "12",
                              },
                            ]}
                            onPress={() => {
                              setPlanMode(option.key);
                              setErrorText("");
                            }}
                          >
                            <View style={{ flex: 1, gap: 3 }}>
                              <FitText style={s.planOptionTitle}>
                                {option.title}
                              </FitText>
                              <FitText style={s.planOptionBody}>
                                {option.sessionCount} session
                                {option.sessionCount === 1 ? "" : "s"}
                              </FitText>
                            </View>
                            {isActive ? (
                              <CheckCircle
                                size={17}
                                color={colors.brand}
                                strokeWidth={2}
                              />
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </View>
                    <FitText style={s.previewPlainText}>
                      {selectedPlan.body}
                    </FitText>
                  </View>
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
                          PAYMENT ESTIMATE
                        </FitText>
                        <FitText style={s.helperText}>
                          Payment options unlock after the coach accepts this request.
                        </FitText>
                      </View>
                    </View>
                    <View style={s.paymentSummaryCard}>
                      <FitText style={s.previewSectionTitle}>
                        {paymentEstimateSummary.eyebrow}
                      </FitText>
                      <FitText style={s.previewTitle}>
                        {paymentEstimateSummary.title}
                      </FitText>
                      <FitText style={s.previewPlainText}>
                        {paymentEstimateSummary.body}
                      </FitText>
                      <View style={s.paymentBreakdownRow}>
                        <View style={s.paymentBreakdownColumn}>
                          <FitText style={s.previewSectionTitle}>TOTAL</FitText>
                          <FitText style={s.paymentBreakdownValue}>
                            {totalAmountLabel}
                          </FitText>
                        </View>
                        <View style={s.paymentBreakdownColumn}>
                          <FitText style={s.previewSectionTitle}>
                            DOWNPAYMENT
                          </FitText>
                          <FitText style={s.paymentBreakdownValue}>
                            {downpaymentLabel}
                          </FitText>
                        </View>
                        <View style={s.paymentBreakdownColumn}>
                          <FitText style={s.previewSectionTitle}>
                            REMAINING
                          </FitText>
                          <FitText style={s.paymentBreakdownValue}>
                            {remainingBalanceLabel}
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
            </FitModalScrollView>
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
                      !hasValidCoachRate ||
                      isSelectedCoachDateBooked ||
                      createAppointmentMutation.isPending
                    : !selectedCoach || coachesLoading
                }
                loading={createAppointmentMutation.isPending}
                flex={2}
              />
            </Animated.View>
            </Animated.View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
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
        isLoading={createAppointmentMutation.isPending}
        loadingLabel={bookingLabel}
        loadingTitle="Submitting appointment"
        onNo={() => {
          if (createAppointmentMutation.isPending) {
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
