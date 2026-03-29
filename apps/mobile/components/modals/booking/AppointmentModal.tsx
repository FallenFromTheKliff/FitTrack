import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { CalendarDays, CheckCircle, Clock, Users } from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { WEEKDAY_NAMES } from "@fittrack/app-config";

import type { CoachAvailabilityResponse } from "@fittrack/api-client";
import type { CoachProfileRecord, Trainer } from "@fittrack/types";
import {
  activeCoachesQueryOptions,
  coachAvailabilityQueryOptions,
  createAppointmentMutationOptions
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
  label: string;
  startTime: string;
  durationMin: number;
};

function mapCoachToTrainer(coach: CoachRecord): Trainer {
  const firstName = coach.user?.profile?.firstName?.trim() ?? "";
  const lastName = coach.user?.profile?.lastName?.trim() ?? "";
  const fullName = `${firstName} ${lastName}`.trim() || coach.user?.email || "Coach";
  const initials = fullName
    .split(" ")
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "C";
  return {
    id: String(coach.id),
    name: fullName,
    specialty: coach.specialties?.[0] ?? "General Coaching",
    rating: 0,
    pricePerSession: coach.hourlyRate ?? 0,
    avatarInitials: initials
  };
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
  const [selectedCoach, setSelectedCoach] = useState<Trainer | null>(null);
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [selectedSlotLabel, setSelectedSlotLabel] = useState("");
  const [isCalOpen, setIsCalOpen] = useState(false);
  const [isTimeOpen, setIsTimeOpen] = useState(false);
  const [errorText, setErrorText] = useState("");

  const { data: coaches = [] } = useQuery({
    ...activeCoachesQueryOptions<CoachRecord>(mobileApiClient),
    enabled: isVisible
  });

  const trainers = useMemo(() => coaches.map(mapCoachToTrainer), [coaches]);

  const { data: availability } = useQuery({
    ...coachAvailabilityQueryOptions<CoachAvailabilityResponse>(mobileApiClient, selectedCoach?.id),
    enabled: isVisible && !!selectedCoach
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
        durationMin: getDurationMinutes(slot.startTime, slot.endTime)
      }));
  }, [availability, selectedDate]);

  const timeSlots = useMemo<TimeSlot[]>(() => slotOptions.map((slot) => ({
    time: slot.label,
    duration: `${Math.max(1, Math.round(slot.durationMin / 60))} hr`,
    status: "available",
    spots: 1
  })), [slotOptions]);

  const selectedSlot = useMemo(
    () => slotOptions.find((slot) => slot.label === selectedSlotLabel) ?? null,
    [selectedSlotLabel, slotOptions]
  );

  const createAppointmentMutation = useMutation(createAppointmentMutationOptions(mobileApiClient, queryClient));

  const bookingLabel = useLoadingText("BOOKING APPOINTMENT", createAppointmentMutation.isPending);

  const backdropStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.overlay }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    backgroundColor: ic.value.surface,
    borderColor: ic.value.border
  }));
  const headerBorderStyle = useAnimatedStyle(() => ({ borderBottomColor: ic.value.border }));
  const footerBorderStyle = useAnimatedStyle(() => ({ borderTopColor: ic.value.border }));

  const resetAndClose = () => {
    if (createAppointmentMutation.isPending) {
      return;
    }
    setStep("coach");
    setSelectedCoach(null);
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
          coachId: selectedCoach.id,
          scheduledAt: `${selectedDate}T${selectedSlot.startTime}:00`,
          duration: selectedSlot.durationMin
        }
      });
      onSuccess?.();
      resetAndClose();
    } catch (error: unknown) {
      setErrorText(error instanceof Error ? error.message : "Unable to book appointment.");
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
                  {step === "coach" ? "Step 1 of 2 - Select coach" : "Step 2 of 2 - Pick time"}
                </FitText>
              </View>
            </Animated.View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>
              {step === "coach" ? (
                <View>
                  <FitText style={s.sectionLabel}>AVAILABLE COACHES</FitText>
                  <View style={s.coachList}>
                    {trainers.map((trainer) => {
                      const isActive = selectedCoach?.id === trainer.id;
                      return (
                        <Pressable
                          key={trainer.id}
                          style={[s.coachRow, isActive && { borderColor: colors.brand, backgroundColor: colors.brand + "10" }]}
                          onPress={() => setSelectedCoach(isActive ? null : trainer)}
                        >
                          <View style={[s.coachAvatar, isActive && { backgroundColor: colors.brand }]}>
                            <FitText style={[s.coachAvatarText, isActive && { color: colors.surface }]}>
                              {trainer.avatarInitials}
                            </FitText>
                          </View>
                          <View style={s.coachInfo}>
                            <FitText style={s.coachName}>{trainer.name}</FitText>
                            <FitText style={s.coachSpecialty}>
                              {trainer.specialty} - {trainer.pricePerSession}/session
                            </FitText>
                          </View>
                          {isActive ? <CheckCircle size={16} color={colors.brand} strokeWidth={2} /> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : (
                <View>
                  <FitText style={s.sectionLabel}>SELECT DATE</FitText>
                  <Pressable style={[s.fieldBtn, { borderColor: colors.fieldBorder }]} onPress={() => setIsCalOpen(true)}>
                    <CalendarDays size={16} color={colors.textMuted} strokeWidth={2} />
                    <FitText style={s.fieldBtnText}>{formatBookingDate(selectedDate)}</FitText>
                  </Pressable>
                  <FitText style={s.sectionLabel}>SELECT TIME SLOT</FitText>
                  <Pressable
                    style={[s.fieldBtn, { borderColor: selectedSlotLabel ? colors.brand : colors.fieldBorder }]}
                    onPress={() => setIsTimeOpen(true)}
                  >
                    <Clock size={16} color={selectedSlotLabel ? colors.brand : colors.textMuted} strokeWidth={2} />
                    <FitText style={[s.fieldBtnText, selectedSlotLabel && { color: colors.textPrimary }]}>
                      {selectedSlotLabel || "Choose available slot"}
                    </FitText>
                  </Pressable>
                  <FitText style={s.helperText}>
                    {timeSlots.length > 0 ? `${timeSlots.length} available slots found.` : "No available slots for this date."}
                  </FitText>
                </View>
              )}
              {errorText ? <FitText style={s.errorText}>{errorText}</FitText> : null}
            </ScrollView>
            <Animated.View style={[s.footer, footerBorderStyle]}>
              <FitButton
                label={step === "coach" ? "Cancel" : "Back"}
                variant="ghost"
                onPress={step === "coach" ? resetAndClose : () => setStep("coach")}
                disabled={createAppointmentMutation.isPending}
                flex={1}
              />
              <FitButton
                label={step === "coach" ? "Continue" : bookingLabel}
                variant="primary"
                onPress={step === "coach" ? goToTimeStep : handleBookAppointment}
                disabled={step === "time" ? !selectedSlot || createAppointmentMutation.isPending : !selectedCoach}
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
