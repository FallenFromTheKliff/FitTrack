import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from "react-native";
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
import { formatBookingDate, getDurationMinutes, to12HourLabel } from "@fittrack/utils";
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
import TimeSlotModal, { type TimeSlot } from "@/components/modals/shared/TimeSlotModal";

type Props = {
  isVisible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

type CoachRecord = CoachProfileRecord;

type AppointmentStep = "coach" | "time";

type SlotOption = {
  durationMin: number;
  label: string;
  startTime: string;
};

function getCoachName(coach: CoachRecord) {
  const firstName = coach.user?.profile?.firstName?.trim() ?? "";
  const lastName = coach.user?.profile?.lastName?.trim() ?? "";
  return `${firstName} ${lastName}`.trim() || coach.user?.email || "Coach";
}

function getCoachInitials(coach: CoachRecord) {
  return getCoachName(coach)
    .split(" ")
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "C";
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
  const normalized = dayValue.toLowerCase();
  return WEEKDAY_NAMES[dayIndex] === normalized;
}

export default function AppointmentModal({ isVisible, onClose, onSuccess }: Props) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");
  const s = useMemo(() => makeAppointmentModalStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const [step, setStep] = useState<AppointmentStep>("coach");
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [selectedSlotLabel, setSelectedSlotLabel] = useState("");
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

  const slotOptions = useMemo<SlotOption[]>(() => {
    if (!availability?.availability) {
      return [];
    }
    return availability.availability
      .filter((slot) => slot.isAvailable && matchesDay(selectedDate, slot.dayOfWeek))
      .map((slot) => ({
        label: to12HourLabel(slot.startTime),
        startTime: slot.startTime,
        durationMin: getDurationMinutes(slot.startTime, slot.endTime),
      }));
  }, [availability, selectedDate]);

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
    "BOOKING APPOINTMENT",
    createAppointmentMutation.isPending,
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
    if (slotOptions.length === 0) {
      return `No active slots are available on ${formatBookingDate(selectedDate)}. Try another date or another coach.`;
    }
    return `${slotOptions.length} available slot${slotOptions.length === 1 ? "" : "s"} on ${formatBookingDate(selectedDate)}.`;
  }, [availabilityError, availabilityLoading, selectedCoach, selectedDate, slotOptions.length]);

  const resetAndClose = () => {
    if (createAppointmentMutation.isPending) {
      return;
    }
    setStep("coach");
    setSelectedCoachId(null);
    setSelectedDate(getTodayString());
    setSelectedSlotLabel("");
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
    setErrorText("");
    try {
      await createAppointmentMutation.mutateAsync({
        payload: {
          coachId: String(selectedCoach.id),
          scheduledAt: `${selectedDate}T${selectedSlot.startTime}:00`,
          duration: selectedSlot.durationMin,
        },
      });
      onSuccess?.();
      resetAndClose();
    } catch (error: unknown) {
      setErrorText(
        error instanceof Error ? error.message : "Unable to book appointment.",
      );
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={undefined}
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
                                  {getCoachPrimarySpecialty(coach)}{" "}
                                  {" - "}
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
                        { borderColor: colors.fieldBorder },
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
                </View>
              )}
              {errorText ? <FitText style={s.errorText}>{errorText}</FitText> : null}
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
                onPress={step === "coach" ? goToTimeStep : handleBookAppointment}
                disabled={
                  step === "time"
                    ? !selectedSlot || createAppointmentMutation.isPending
                    : !selectedCoach || coachesLoading
                }
                loading={createAppointmentMutation.isPending}
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
  );
}
