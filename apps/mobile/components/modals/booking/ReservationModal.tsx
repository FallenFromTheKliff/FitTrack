import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { CalendarDays, Clock, CheckCircle, Plus, XCircle } from "lucide-react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { Trainer } from "@fittrack/types";
import { useTheme } from "@/contexts/ThemeContext";
import { mobileApi } from "@/lib/api";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { useLoadingText } from "@fittrack/hooks";
import { TIME_SLOTS, getTodayString } from "@/data/bookings";
import { formatBookingDate } from "@fittrack/utils";
import { makeReservationModalStyles } from "@/styles/modals/ReservationStyles";
import { getVenuePresentation, type VenueRecord } from "@/utils/venueBookings";

import { FitText, FitTextInput } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import CalendarModal from "@/components/modals/shared/CalendarModal";
import TimeSlotModal, { type TimeSlot } from "@/components/modals/shared/TimeSlotModal";

type Props = {
  isVisible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

type CoachRecord = {
  id: string | number;
  specialties?: string[];
  bio?: string;
  hourlyRate?: number;
  user?: {
    email?: string;
    profile?: {
      firstName?: string | null;
      lastName?: string | null;
    } | null;
  } | null;
};

function timeToMinutes(time: string) {
  const [clock, suffix] = time.split(" ");
  const [hStr, mStr] = clock.split(":");
  let hour = parseInt(hStr, 10);
  const minute = parseInt(mStr, 10);
  if (suffix === "PM" && hour !== 12) hour += 12;
  if (suffix === "AM" && hour === 12) hour = 0;
  return hour * 60 + minute;
}

export default function ReservationModal({ isVisible, onClose, onSuccess }: Props) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");
  const s = useMemo(() => makeReservationModalStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const [date, setDate] = useState(getTodayString());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<VenueRecord | null>(null);
  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null);
  const [isCalOpen, setIsCalOpen] = useState(false);
  const [isTimeOpen, setIsTimeOpen] = useState(false);
  const [timeTarget, setTimeTarget] = useState<"start" | "end">("start");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const reservingText = useLoadingText("Reserving", isSubmitting);

  const { data: coaches = [] } = useQuery<CoachRecord[]>({
    queryKey: ["coaches"],
    queryFn: async () => {
      const { data } = await mobileApi.get<CoachRecord[]>("/coaches?active=true");
      return data;
    },
    enabled: isVisible
  });

  const trainers = useMemo<Trainer[]>(() => coaches.map((coach) => {
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
  }), [coaches]);

  const { data: venues = [] } = useQuery<VenueRecord[]>({
    queryKey: ["venues"],
    queryFn: async () => {
      const { data } = await mobileApi.get<VenueRecord[]>("/venues?active=true");
      return data;
    },
    enabled: isVisible
  });

  const bookableVenues = useMemo(
      () =>
          venues
              .filter((venue) => venue.isReservable !== false)
              .map((venue) => ({ venue, presentation: getVenuePresentation(venue) })),
      [venues]
  );
  const selectedVenuePresentation = useMemo(
      () => (selectedVenue ? getVenuePresentation(selectedVenue) : null),
      [selectedVenue]
  );

  const { data: availability = [] } = useQuery<{ startTime: string; endTime: string; status: string }[]>({
    queryKey: ["venue-availability", selectedVenue?.id, date],
    queryFn: async () => {
      if (!selectedVenue) return [];
      const { data } = await mobileApi.get<{ bookings: { startTime: string; endTime: string; status: string }[] }>(
          `/venues/${selectedVenue.id}/availability?date=${date}`
      );
      return data.bookings ?? [];
    },
    enabled: isVisible && !!selectedVenue && !!date
  });

  const backdropStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.overlay }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    backgroundColor: ic.value.surface,
    borderColor: ic.value.border
  }));
  const headerBorderStyle = useAnimatedStyle(() => ({ borderBottomColor: ic.value.border }));
  const footerBorderStyle = useAnimatedStyle(() => ({ borderTopColor: ic.value.border }));

  const basePrice = useMemo(() => {
    if (!selectedVenuePresentation) return 0;
    return selectedVenuePresentation.price + (selectedTrainer?.pricePerSession ?? 0);
  }, [selectedTrainer, selectedVenuePresentation]);

  const endSlots = useMemo((): TimeSlot[] => {
    if (!startTime) return [];
    const startIdx = TIME_SLOTS.findIndex((slot) => slot.time === startTime);
    if (startIdx === -1) return [];
    const result: TimeSlot[] = [];
    for (let i = startIdx + 1; i < TIME_SLOTS.length; i++) {
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
      if (booking.status !== "confirmed" && booking.status !== "pending") return false;
      const bStartDate = new Date(booking.startTime);
      const bEndDate = new Date(booking.endTime);
      const bStart = bStartDate.getHours() * 60 + bStartDate.getMinutes();
      const bEnd = bEndDate.getHours() * 60 + bEndDate.getMinutes();
      return selStart < bEnd && selEnd > bStart;
    });
  }, [availability, date, endTime, selectedVenue, startTime]);

  const canConfirm = !!date && !!selectedVenue && !!startTime && !!endTime && !hasConflict;

  const handleReset = () => {
    setDate(getTodayString());
    setStartTime("");
    setEndTime("");
    setNotes([]);
    setSelectedVenue(null);
    setSelectedTrainer(null);
    setTimeTarget("start");
    setIsCalOpen(false);
    setIsTimeOpen(false);
    setApiError("");
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

  const handleConfirm = async () => {
    if (!canConfirm || !selectedVenue) return;
    setIsSubmitting(true);
    setApiError("");
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    const durationHours = (endMinutes - startMinutes) / 60;
    const startHour24 = Math.floor(startMinutes / 60);
    const startMin = startMinutes % 60;
    const isoStart = `${date}T${String(startHour24).padStart(2, "0")}:${String(startMin).padStart(2, "0")}:00`;
    const purpose = notes.filter((note) => note.trim() !== "").join("\n") || undefined;
    try {
      await Promise.all([
        mobileApi.post("/bookings", {
          venueId: selectedVenue.id,
          startTime: isoStart,
          durationHours,
          purpose
        }),
        new Promise((resolve) => setTimeout(resolve, 2000))
      ]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["venues"] })
      ]);
      setIsSubmitting(false);
      handleReset();
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : "Reservation failed. Please try again.";
      setApiError(msg);
    }
  };

  return (
      <Modal visible={isVisible} transparent animationType="none" onRequestClose={undefined} statusBarTranslucent>
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
                      ? `${selectedVenuePresentation.emoji} ${selectedVenuePresentation.name} \u00B7 \u20B1${selectedVenuePresentation.price}/${selectedVenuePresentation.unit}`
                      : "Book a venue or trainer session"}
                </FitText>
              </View>
            </Animated.View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>
              <FitText style={s.sectionLabel}>DATE</FitText>
              <Pressable
                  style={[s.fieldBtn, { borderColor: date ? colors.brand : colors.fieldBorder }]}
                  onPress={() => setIsCalOpen(true)}
              >
                <CalendarDays size={16} color={date ? colors.brand : colors.textMuted} strokeWidth={2} />
                <FitText style={[s.fieldBtnText, date && { color: colors.textPrimary }]}>
                  {date ? formatBookingDate(date) : "Select a date"}
                </FitText>
              </Pressable>
              <FitText style={[s.sectionLabel, { marginTop: 16 }]}>TIME RANGE</FitText>
              <View style={s.twoFieldRow}>
                <Pressable
                    style={[s.fieldBtn, s.fieldBtnFlex, { borderColor: startTime ? colors.brand : colors.fieldBorder }]}
                    onPress={() => {
                      setTimeTarget("start");
                      setIsTimeOpen(true);
                    }}
                >
                  <Clock size={16} color={startTime ? colors.brand : colors.textMuted} strokeWidth={2} />
                  <FitText style={[s.fieldBtnText, startTime && { color: colors.textPrimary }]}>
                    {startTime || "Start Time"}
                  </FitText>
                </Pressable>
                <Pressable
                    style={[
                      s.fieldBtn,
                      s.fieldBtnFlex,
                      { borderColor: endTime ? colors.brand : colors.fieldBorder, opacity: !startTime ? 0.45 : 1 }
                    ]}
                    onPress={() => {
                      if (!startTime) return;
                      setTimeTarget("end");
                      setIsTimeOpen(true);
                    }}
                    disabled={!startTime}
                >
                  <Clock size={16} color={endTime ? colors.brand : colors.textMuted} strokeWidth={2} />
                  <FitText style={[s.fieldBtnText, endTime && { color: colors.textPrimary }]}>
                    {endTime || "End Time"}
                  </FitText>
                </Pressable>
              </View>
              {(startTime === "" || endTime === "") && <FitText style={s.validationHint}>Start and End time are required</FitText>}
              {hasConflict && <FitText style={s.unavailableText}>Unavailable</FitText>}
              {apiError !== "" && <FitText style={s.unavailableText}>{apiError}</FitText>}
              <FitText style={[s.sectionLabel, { marginTop: 16 }]}>VENUE</FitText>
              <View style={s.amenityGrid}>
                {bookableVenues.map(({ venue, presentation }) => {
                  const isActive = selectedVenue?.id === venue.id;
                  return (
                      <Pressable
                          key={venue.id}
                          style={[s.amenityCard, isActive && { borderColor: colors.brand, backgroundColor: colors.brand + "12" }]}
                          onPress={() => setSelectedVenue(isActive ? null : venue)}
                      >
                        <FitText style={s.amenityEmoji}>{presentation.name.slice(0, 1)}</FitText>
                        <FitText style={[s.amenityName, isActive && { color: colors.brand, fontWeight: "600" }]} numberOfLines={2}>
                          {presentation.name}
                        </FitText>
                        <FitText style={[s.amenityPrice, isActive && { color: colors.brand }]}>
                          {"\u20B1"}{presentation.price}/{presentation.unit}
                        </FitText>
                        {isActive && (
                            <View style={s.amenityCheck}>
                              <CheckCircle size={14} color={colors.brand} strokeWidth={2} />
                            </View>
                        )}
                      </Pressable>
                  );
                })}
              </View>
              <FitText style={[s.sectionLabel, { marginTop: 16 }]}>
                {"TRAINER "}
                <FitText style={s.optionalLabel}>(optional)</FitText>
              </FitText>
              <View style={s.trainerList}>
                {trainers.map((trainer) => {
                  const isActive = selectedTrainer?.id === trainer.id;
                  return (
                      <Pressable
                          key={trainer.id}
                          style={[s.trainerRow, isActive && { borderColor: colors.brand, backgroundColor: colors.brand + "10" }]}
                          onPress={() => setSelectedTrainer(isActive ? null : trainer)}
                      >
                        <View style={[s.trainerAvatar, isActive && { backgroundColor: colors.brand }]}>
                          <FitText style={[s.trainerAvatarText, isActive && { color: colors.surface }]}>{trainer.avatarInitials}</FitText>
                        </View>
                        <View style={s.trainerInfo}>
                          <FitText style={[s.trainerName, isActive && { color: colors.brand }]}>{trainer.name}</FitText>
                          <FitText style={s.trainerSpecialty}>
                            {trainer.specialty}{" \u00B7 \u20B1"}{trainer.pricePerSession}/session
                          </FitText>
                        </View>
                        {isActive && <CheckCircle size={16} color={colors.brand} strokeWidth={2} />}
                      </Pressable>
                  );
                })}
              </View>
              <FitText style={[s.sectionLabel, { marginTop: 16 }]}>PRICE</FitText>
              <View style={[s.inputFieldWrap, { opacity: 0.6 }]}>
                <FitText style={s.inputPrefix}>{"\u20B1"}</FitText>
                <FitText style={s.inputField}>{basePrice > 0 ? String(basePrice) : "\u2014"}</FitText>
              </View>
              <View style={s.notesSectionHeader}>
                <FitText style={[s.sectionLabel, { marginTop: 16, marginBottom: 0 }]}>NOTES</FitText>
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
                const counterColor = note.length === 50
                    ? colors.danger
                    : note.length >= 40
                        ? colors.warning
                        : colors.textMuted;
                return (
                    <View key={idx} style={s.noteRow}>
                      <View style={s.noteContent}>
                        <View style={[s.inputFieldWrap, s.noteFieldWrap]}>
                          <FitText style={s.noteBullet}>{"\u2022"}</FitText>
                          <FitTextInput
                              value={note}
                              onChangeText={(text) => {
                                if (text.length > 50) return;
                                setNotes((prev) => prev.map((currentNote, noteIndex) => (noteIndex === idx ? text : currentNote)));
                              }}
                              placeholder="Add a note..."
                              multiline
                              style={[s.noteInput, atLimit && { color: colors.warning }]}
                          />
                        </View>
                        <FitText style={[s.noteCounter, { color: counterColor }]}>{note.length}/50</FitText>
                      </View>
                      <Pressable
                          onPress={() => setNotes((prev) => prev.filter((_, noteIndex) => noteIndex !== idx))}
                          hitSlop={8}
                          style={s.noteRemoveBtn}
                      >
                        <XCircle size={16} color={colors.textMuted} strokeWidth={2} />
                      </Pressable>
                    </View>
                );
              })}
              {notes.length === 0 && (
                  <FitText style={s.notesEmptyHint}>Tap + to add a note</FitText>
              )}
            </ScrollView>
            <Animated.View style={[s.footer, footerBorderStyle]}>
              <FitButton label="Cancel" variant="ghost" onPress={handleClose} disabled={isSubmitting} flex={1} />
              <FitButton
                  label={isSubmitting ? reservingText : "Confirm Reservation"}
                  variant="primary"
                  onPress={handleConfirm}
                  disabled={!canConfirm || isSubmitting}
                  loading={isSubmitting}
                  flex={2}
              />
            </Animated.View>
          </Animated.View>
        </Animated.View>
        <CalendarModal
            isVisible={isCalOpen}
            selectedDate={date}
            blockPast
            defaultYear={new Date().getFullYear()}
            defaultMonth={new Date().getMonth() + 1}
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
      </Modal>
  );
}