import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { CalendarDays, CheckCircle, Clock, Plus, XCircle } from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { VenueAvailabilityRecord } from "@fittrack/api-client";

import {
  createBookingMutationOptions,
  venueAvailabilityQueryOptions,
  venuesQueryOptions
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
import { CalendarModal, TimeSlotModal, type TimeSlot } from "@/components/modals";

type Props = {
  isVisible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
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

export default function ReservationModal({ isVisible, onClose, onSuccess }: Props) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");
  const s = useMemo(() => makeReservationModalStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const createBookingMutation = useMutation(createBookingMutationOptions(mobileApiClient, queryClient));

  const [date, setDate] = useState(getTodayString());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<VenueRecord | null>(null);
  const [isCalOpen, setIsCalOpen] = useState(false);
  const [isTimeOpen, setIsTimeOpen] = useState(false);
  const [timeTarget, setTimeTarget] = useState<"start" | "end">("start");
  const isSubmitting = createBookingMutation.isPending;
  const [apiError, setApiError] = useState("");
  const reservingText = useLoadingText("Reserving", isSubmitting);

  const { data: venues = [] } = useQuery({
    ...venuesQueryOptions(mobileApiClient),
    enabled: isVisible
  });

  const bookableVenues = useMemo(
    () => venues
      .filter((venue) => venue.isReservable !== false)
      .map((venue) => ({ venue, presentation: getVenuePresentation(venue) })),
    [venues]
  );
  const selectedVenuePresentation = useMemo(
    () => (selectedVenue ? getVenuePresentation(selectedVenue) : null),
    [selectedVenue]
  );

  const { data: availability = [] } = useQuery({
    ...venueAvailabilityQueryOptions<VenueAvailabilityRecord>(mobileApiClient, selectedVenue?.id, date),
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

  const basePrice = useMemo(() => selectedVenuePresentation?.price ?? 0, [selectedVenuePresentation]);

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
      if (booking.status !== "confirmed" && booking.status !== "pending") return false;
      const bookingStart = new Date(booking.startTime);
      const bookingEnd = new Date(booking.endTime);
      const bookingStartMinutes = bookingStart.getHours() * 60 + bookingStart.getMinutes();
      const bookingEndMinutes = bookingEnd.getHours() * 60 + bookingEnd.getMinutes();
      return selStart < bookingEndMinutes && selEnd > bookingStartMinutes;
    });
  }, [availability, date, endTime, selectedVenue, startTime]);

  const canConfirm = !!date && !!selectedVenue && !!startTime && !!endTime && !hasConflict;

  const handleReset = () => {
    setDate(getTodayString());
    setStartTime("");
    setEndTime("");
    setNotes([]);
    setSelectedVenue(null);
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
    setApiError("");
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    const durationHours = (endMinutes - startMinutes) / 60;
    const startHour24 = Math.floor(startMinutes / 60);
    const startMinute = startMinutes % 60;
    const isoStart = `${date}T${String(startHour24).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}:00`;
    const purpose = notes.filter((note) => note.trim() !== "").join("\n") || undefined;
    try {
      await Promise.all([
        createBookingMutation.mutateAsync({
          payload: {
            venueId: selectedVenue.id,
            startTime: isoStart,
            durationHours,
            purpose
          },
          venueId: selectedVenue.id,
          date
        }),
        new Promise((resolve) => setTimeout(resolve, 2000))
      ]);
      handleReset();
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Reservation failed. Please try again.");
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
                  ? `${selectedVenuePresentation.emoji} ${selectedVenuePresentation.name} · ₱${selectedVenuePresentation.price}/${selectedVenuePresentation.unit}`
                  : "Book a reservable venue"}
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
            {startTime === "" || endTime === "" ? <FitText style={s.validationHint}>Start and end time are required</FitText> : null}
            {hasConflict ? <FitText style={s.unavailableText}>The selected time overlaps an active booking.</FitText> : null}
            {apiError !== "" ? <FitText style={s.unavailableText}>{apiError}</FitText> : null}
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
                      ₱{presentation.price}/{presentation.unit}
                    </FitText>
                    {isActive ? (
                      <View style={s.amenityCheck}>
                        <CheckCircle size={14} color={colors.brand} strokeWidth={2} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            <FitText style={[s.sectionLabel, { marginTop: 16 }]}>PRICE</FitText>
            <View style={[s.inputFieldWrap, { opacity: 0.6 }]}>
              <FitText style={s.inputPrefix}>₱</FitText>
              <FitText style={s.inputField}>{basePrice > 0 ? String(basePrice) : "—"}</FitText>
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
                      <FitText style={s.noteBullet}>•</FitText>
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
            {notes.length === 0 ? <FitText style={s.notesEmptyHint}>Tap + to add a note</FitText> : null}
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
