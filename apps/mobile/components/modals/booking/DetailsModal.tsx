import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Clock, Star, Users } from "lucide-react-native";
import type { VenueFeedbackRecord } from "@fittrack/api-client";
import {
  gymLayoutEquipmentQueryOptions,
  submitVenueFeedbackMutationOptions,
  venueFeedbackHistoryQueryOptions,
} from "@fittrack/query";
import {
  isEquipmentInsideVenue,
  type FacilityOperatingHourSnapshot,
  type FacilityTodayBookingSnapshot,
} from "@fittrack/types";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { makeDetailsModalStyles } from "@/styles/modals/DetailsStyles";
import { formatCurrency } from "@fittrack/utils";
import { mobileApiClient } from "@/lib/api-client";
import { getFacilityStatusColor, getFacilityStatusLabel } from "@/utils/facilityStatus";
import { getVenueIcon } from "@/utils/venueMap";
import type { VenuePresentation } from "@/utils/venueBookings";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitModalScrollView from "@/components/modals/shared/FitModalScrollView";
import FacilityImageLightbox from "@/components/modals/shared/FacilityImageLightbox";
import VenueImageCarousel from "@/components/modals/shared/VenueImageCarousel";
import {
  formatFacilityOperatingHour,
  sortFacilityOperatingHours,
} from "@/utils/facilityHours";

function formatGymBookingTime(value: string) {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return value;
  }

  const parsed = new Date(timestamp + 8 * 60 * 60 * 1000);
  const hours = parsed.getUTCHours();
  const minutes = parsed.getUTCMinutes();
  const period = hours >= 12 ? "PM" : "AM";
  const normalizedHour = hours % 12 || 12;

  return `${normalizedHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

type Props = {
  isVisible: boolean;
  venue: VenuePresentation | null;
  onClose: () => void;
  onReserve?: () => void;
  operatingHours?: FacilityOperatingHourSnapshot[];
  todayBookings?: FacilityTodayBookingSnapshot[];
};

export default function DetailsModal({
  isVisible,
  venue,
  onClose,
  onReserve,
  operatingHours = [],
  todayBookings = [],
}: Props) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");
  const s = useMemo(() => makeDetailsModalStyles(colors), [colors]);
  const { data: liveEquipment = [] } = useQuery({
    ...gymLayoutEquipmentQueryOptions(mobileApiClient, { refetchInterval: 5000 }),
    enabled: isVisible && venue?.floorId !== undefined
  });
  const liveVenueId = venue?.sourceVenueId;
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackState, setFeedbackState] = useState<{
    text: string;
    tone: "danger" | "success";
  } | null>(null);
  const [feedbackReaderOpen, setFeedbackReaderOpen] = useState(false);
  const [feedbackReaderPage, setFeedbackReaderPage] = useState(1);
  const [feedbackReaderItems, setFeedbackReaderItems] = useState<
    VenueFeedbackRecord[]
  >([]);
  const [isImageOpen, setIsImageOpen] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const feedbackSubmitInFlightRef = useRef(false);

  useEffect(() => {
    setFeedbackState(null);
    setFeedbackReaderOpen(false);
    setFeedbackReaderPage(1);
    setFeedbackReaderItems([]);
    setSelectedImageUri(null);
    setIsImageOpen(false);
  }, [isVisible, venue?.sourceVenueId, venue?.id]);

  const feedbackSummaryQuery = useQuery({
    ...venueFeedbackHistoryQueryOptions(mobileApiClient, liveVenueId, {
      page: 1,
      limit: 3,
    }),
    enabled: isVisible && !!liveVenueId,
  });
  const feedbackReaderQuery = useQuery({
    ...venueFeedbackHistoryQueryOptions(mobileApiClient, liveVenueId, {
      page: feedbackReaderPage,
      limit: 10,
    }),
    enabled: isVisible && !!liveVenueId && feedbackReaderOpen,
  });
  const feedbackMutation = useMutation({
    ...submitVenueFeedbackMutationOptions(mobileApiClient),
    onSuccess: async () => {
      await Promise.all([
        feedbackSummaryQuery.refetch(),
        feedbackReaderOpen ? feedbackReaderQuery.refetch() : Promise.resolve(),
      ]);
    },
  });

  useEffect(() => {
    const page = feedbackReaderQuery.data;
    if (!feedbackReaderOpen || !page) return;
    setFeedbackReaderItems((current) =>
      feedbackReaderPage === 1
        ? page.items
        : [
            ...current,
            ...page.items.filter(
              (entry) => !current.some((currentEntry) => currentEntry.id === entry.id),
            ),
          ],
    );
  }, [feedbackReaderOpen, feedbackReaderPage, feedbackReaderQuery.data]);

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
  const sortedOperatingHours = useMemo(
    () => sortFacilityOperatingHours(operatingHours),
    [operatingHours],
  );
  const sortedTodayBookings = useMemo(
    () =>
      [...todayBookings].sort(
        (left, right) =>
          (Date.parse(left.startTime) || 0) -
          (Date.parse(right.startTime) || 0),
      ),
    [todayBookings],
  );

  if (!venue) return null;

  const status = venue.status ?? "available";
  const meta = {
    description:
      venue.description?.trim() ||
      "No member-facing description has been published for this venue yet.",
  };
  const statusMeta = {
    color: getFacilityStatusColor(status, colors),
    label: getFacilityStatusLabel(status)
  };
  const Icon = getVenueIcon(venue.iconKey);
  const priceLabel = venue.isReservable ? `${formatCurrency(venue.price)} / ${venue.unit}` : "Core facility";
  const capacityLabel = venue.maxSlots > 0 ? `${venue.maxSlots} slots` : "Not specified";
  const venueFloorId = venue.floorId ?? null;
  const assignedEquipment = venueFloorId
    ? liveEquipment
        .filter((item) => {
          if (!item.isActive) return false;
          const isExplicitlyAssigned =
            item.venueId != null &&
            String(item.venueId) === String(venue.sourceVenueId ?? venue.id);
          return (
            isExplicitlyAssigned ||
            isEquipmentInsideVenue(item, {
              floorId: venueFloorId,
              gridColumn: venue.gridColumn,
              gridHeight: venue.gridHeight,
              gridRow: venue.gridRow,
              gridWidth: venue.gridWidth
            })
          );
        })
        .sort((left, right) => left.name.localeCompare(right.name))
    : [];
  const feedbackSummary = feedbackSummaryQuery.data;
  const venueFeedback = feedbackSummary?.items ?? [];
  const averageRating = feedbackSummary?.average_rating ?? null;
  const feedbackTotal = feedbackSummary?.total ?? 0;
  const handleFeedbackSubmit = async () => {
    if (feedbackSubmitInFlightRef.current || feedbackMutation.isPending) return;
    if (!liveVenueId) {
      setFeedbackState({
        text: "This venue is not connected to a live facility record yet.",
        tone: "danger",
      });
      return;
    }

    feedbackSubmitInFlightRef.current = true;
    try {
      await feedbackMutation.mutateAsync({
        id: liveVenueId,
        rating: feedbackRating,
        comment: feedbackComment.trim() || undefined,
      });
      setFeedbackComment("");
      setFeedbackRating(5);
      setFeedbackState({
        text: "Venue feedback submitted.",
        tone: "success",
      });
    } catch {
      setFeedbackState({
        text: "Venue feedback could not be sent right now.",
        tone: "danger",
      });
    } finally {
      feedbackSubmitInFlightRef.current = false;
    }
  };

  return (
    <>
      <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[s.backdrop, backdropStyle]}>
        <Animated.View style={[s.card, cardStyle]}>
          <Animated.View style={[s.header, headerBorderStyle]}>
            {/* Header icon badge renders actual Lucide icon, not a letter */}
            <Animated.View style={[s.headerIcon, headerIconStyle]}>
              <Icon size={17} color={colors.brand} strokeWidth={2} />
            </Animated.View>
            <View style={s.headerText}>
              <FitText style={s.headerTitle}>
                {feedbackReaderOpen ? "All venue feedback" : venue.name}
              </FitText>
              <FitText style={s.headerSubtitle}>
                {feedbackReaderOpen
                  ? "Read member feedback"
                  : `${priceLabel} \u00B7 up to ${venue.maxSlots} slots`}
              </FitText>
            </View>
            {feedbackReaderOpen ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to venue details"
                hitSlop={8}
                onPress={() => setFeedbackReaderOpen(false)}
                style={{ paddingHorizontal: 4, paddingVertical: 8 }}
              >
                <FitText style={{ color: colors.brand, fontSize: 12, fontWeight: "700" }}>
                  Back
                </FitText>
              </Pressable>
            ) : null}
          </Animated.View>
          <FitModalScrollView
            style={s.middle}
            contentContainerStyle={s.body}
            resetKey={`${venue.sourceVenueId ?? venue.id}:${feedbackReaderOpen ? "feedback" : "details"}`}
          >
            {feedbackReaderOpen ? (
              <View style={{ gap: 12 }}>
                <View>
                  <FitText style={s.sectionLabel}>Venue Feedback</FitText>
                  <View style={s.fieldBlock}>
                    <FitText style={s.fieldText}>
                      {(feedbackReaderQuery.data?.total ?? feedbackTotal)} response
                      {(feedbackReaderQuery.data?.total ?? feedbackTotal) === 1 ? "" : "s"}
                    </FitText>
                    <FitText style={s.fieldTextMuted}>
                      {(feedbackReaderQuery.data?.average_rating ?? averageRating) === null
                        ? "No ratings yet"
                        : `${(feedbackReaderQuery.data?.average_rating ?? averageRating)?.toFixed(1)}/5 overall`}
                    </FitText>
                  </View>
                </View>
                {feedbackReaderQuery.isPending && feedbackReaderItems.length === 0 ? (
                  <FitText style={s.fieldTextMuted}>Loading feedback history...</FitText>
                ) : null}
                {feedbackReaderQuery.isError && feedbackReaderItems.length === 0 ? (
                  <View style={s.fieldBlock}>
                    <FitText style={[s.fieldTextMuted, { color: colors.danger }]}>Feedback history could not be loaded.</FitText>
                    <View style={{ marginTop: 10 }}>
                      <FitButton label="Retry" variant="ghost" onPress={() => void feedbackReaderQuery.refetch()} />
                    </View>
                  </View>
                ) : null}
                {!feedbackReaderQuery.isPending && !feedbackReaderQuery.isError && feedbackReaderItems.length === 0 ? (
                  <View style={s.fieldBlock}>
                    <FitText style={s.fieldTextMuted}>No feedback has been submitted for this venue yet.</FitText>
                  </View>
                ) : null}
                {feedbackReaderItems.map((entry) => (
                  <View key={entry.id} style={[s.fieldBlock, { gap: 6 }]}>
                    <View style={{ alignItems: "baseline", flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                      <FitText style={[s.fieldText, { flex: 1, fontWeight: "700" }]}>
                        {entry.submitted_by?.name?.trim() || "Member"}
                      </FitText>
                      <FitText style={{ color: colors.warning, fontSize: 13, fontWeight: "800" }}>
                        {entry.rating}/5
                      </FitText>
                    </View>
                    <FitText style={s.fieldTextMuted}>
                      {entry.comment?.trim() || "No written comment."}
                    </FitText>
                  </View>
                ))}
                {feedbackReaderQuery.isError && feedbackReaderItems.length > 0 ? (
                  <View style={s.fieldBlock}>
                    <FitText style={[s.fieldTextMuted, { color: colors.danger }]}>More feedback could not be loaded.</FitText>
                    <View style={{ marginTop: 10 }}>
                      <FitButton label="Retry" variant="ghost" onPress={() => void feedbackReaderQuery.refetch()} />
                    </View>
                  </View>
                ) : null}
                {feedbackReaderQuery.data?.has_more ? (
                  <FitButton
                    label="Load more feedback"
                    variant="ghost"
                    loading={feedbackReaderQuery.isFetching}
                    loadingLabel="Loading feedback"
                    onPress={() => setFeedbackReaderPage((page) => page + 1)}
                  />
                ) : null}
              </View>
            ) : (
              <>
            <View>
              <FitText style={s.sectionLabel}>Description</FitText>
              <View style={s.fieldBlock}>
                <FitText style={s.fieldTextMuted}>{meta.description}</FitText>
              </View>
            </View>
            <View>
              <FitText style={s.sectionLabel}>Operating Hours</FitText>
              {sortedOperatingHours.length > 0 ? (
                <View style={s.hoursSchedule}>
                  {sortedOperatingHours.map((hour) => {
                    const formatted = formatFacilityOperatingHour(hour);
                    return (
                      <View key={`${hour.dayOfWeek}-${hour.opensAt}-${hour.closesAt}`} style={s.hoursScheduleRow}>
                        <Clock size={15} color={colors.brand} strokeWidth={2} />
                        <FitText style={s.hoursDay}>{formatted.day}</FitText>
                        <FitText style={s.hoursRange}>{formatted.range}</FitText>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={s.hoursRow}>
                  <Clock size={16} color={colors.brand} strokeWidth={2} />
                  <FitText style={s.fieldText}>Gym operating hours have not been published yet.</FitText>
                </View>
              )}
            </View>
            {venue.isReservable && (
              <View>
                <FitText style={s.sectionLabel}>Capacity</FitText>
                <View style={s.hoursRow}>
                  <Users size={16} color={colors.brand} strokeWidth={2} />
                  <FitText style={s.fieldText}>{capacityLabel}</FitText>
                </View>
              </View>
            )}
            <View>
              <FitText style={s.sectionLabel}>Status</FitText>
              <View style={[s.statusRow, { borderColor: statusMeta.color + "44", backgroundColor: statusMeta.color + "12" }]}>
                <View style={[s.statusDot, { backgroundColor: statusMeta.color }]} />
                <FitText style={[s.statusText, { color: statusMeta.color }]}>{statusMeta.label}</FitText>
              </View>
            </View>
            {venue.isReservable ? (
              <View>
                <FitText style={s.sectionLabel}>Today's Bookings</FitText>
                {sortedTodayBookings.length === 0 ? (
                  <View style={s.fieldBlock}>
                    <FitText style={s.fieldTextMuted}>No bookings for today.</FitText>
                  </View>
                ) : (
                  <View style={s.fieldBlock}>
                    {sortedTodayBookings.map((booking) => (
                      <View key={booking.id} style={s.hoursRow}>
                        <Clock size={16} color={colors.brand} strokeWidth={2} />
                        <FitText style={s.fieldText}>
                          {`${formatGymBookingTime(booking.startTime)} – ${formatGymBookingTime(booking.endTime)}`}
                        </FitText>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : null}
            <View>
              <FitText style={s.sectionLabel}>Live Equipment</FitText>
              <View style={s.fieldBlock}>
                {assignedEquipment.length > 0 ? (
                  assignedEquipment.map((item) => (
                    <View key={item.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <View
                        style={{
                          backgroundColor: getFacilityStatusColor(item.status, colors),
                          borderRadius: 4,
                          height: 8,
                          width: 8
                        }}
                      />
                      <FitText style={[s.fieldText, { flex: 1 }]}>{item.name}</FitText>
                      <FitText style={{ color: getFacilityStatusColor(item.status, colors), fontSize: 11 }}>
                        {getFacilityStatusLabel(item.status)}
                      </FitText>
                    </View>
                  ))
                ) : (
                  <FitText style={s.fieldTextMuted}>No live equipment is assigned to this zone yet.</FitText>
                )}
              </View>
            </View>
            <View>
              <FitText style={s.sectionLabel}>Images</FitText>
              <VenueImageCarousel
                images={venue.imageUrls ?? (venue.imageUrl ? [venue.imageUrl] : [])}
                venueName={venue.name}
                onOpenImage={(imageUri) => {
                  setSelectedImageUri(imageUri);
                  setIsImageOpen(true);
                }}
              />
            </View>
            <View>
              <FitText style={s.sectionLabel}>Venue Feedback</FitText>
              {feedbackSummaryQuery.isPending ? (
                <View style={s.fieldBlock}>
                  <FitText style={s.fieldTextMuted}>Loading venue feedback...</FitText>
                </View>
              ) : feedbackSummaryQuery.isError ? (
                <View style={s.fieldBlock}>
                  <FitText style={[s.fieldTextMuted, { color: colors.danger }]}>Venue feedback could not be loaded.</FitText>
                  <View style={{ marginTop: 10 }}>
                    <FitButton label="Retry" variant="ghost" onPress={() => void feedbackSummaryQuery.refetch()} />
                  </View>
                </View>
              ) : (
                <View style={s.fieldBlock}>
                  <FitText style={s.fieldText}>
                    {feedbackTotal} response{feedbackTotal === 1 ? "" : "s"} · {averageRating === null ? "No ratings yet" : `${averageRating.toFixed(1)}/5 overall`}
                  </FitText>
                  {venueFeedback.length > 0 ? venueFeedback.map((entry) => (
                    <View key={entry.id} style={{ marginTop: 6 }}>
                      <FitText style={[s.fieldTextMuted, { fontWeight: "700" }]}>
                        {entry.submitted_by?.name?.trim() || "Member"} · {entry.rating}/5
                      </FitText>
                      <FitText style={s.fieldTextMuted}>
                        {entry.comment?.trim() || "No written comment."}
                      </FitText>
                    </View>
                  )) : (
                    <FitText style={[s.fieldTextMuted, { marginTop: 6 }]}>No feedback has been submitted for this venue yet.</FitText>
                  )}
                  <View style={{ marginTop: 10 }}>
                    <FitButton
                      label="View all feedback"
                      variant="ghost"
                      onPress={() => {
                        setFeedbackReaderPage(1);
                        setFeedbackReaderItems([]);
                        setFeedbackReaderOpen(true);
                      }}
                    />
                  </View>
                </View>
              )}
              <View style={{ gap: 10, marginTop: 10 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <Pressable
                      key={rating}
                      onPress={() => setFeedbackRating(rating)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Venue rating: ${rating} star${rating === 1 ? "" : "s"}`}
                      accessibilityState={{ selected: rating === feedbackRating }}
                      style={{
                        alignItems: "center",
                        backgroundColor: colors.surfaceRaised,
                        borderColor: rating <= feedbackRating ? colors.warning : colors.border,
                        borderRadius: 12,
                        borderWidth: 1,
                        height: 38,
                        justifyContent: "center",
                        width: 38,
                      }}
                    >
                      <Star
                        size={18}
                        color={rating <= feedbackRating ? colors.warning : colors.textMuted}
                        fill={rating <= feedbackRating ? colors.warning : "none"}
                        strokeWidth={2}
                      />
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  nativeID="venue-feedback-comment"
                  accessibilityLabel="Optional note about this venue"
                  value={feedbackComment}
                  onChangeText={(value) => {
                    setFeedbackComment(value);
                    if (feedbackState) setFeedbackState(null);
                  }}
                  placeholder="Optional note about this venue"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  textAlignVertical="top"
                  editable={!feedbackMutation.isPending}
                  style={{
                    backgroundColor: colors.surfaceRaised,
                    borderColor: colors.border,
                    borderRadius: 14,
                    borderWidth: 1,
                    color: colors.textPrimary,
                    minHeight: 88,
                    padding: 12,
                  }}
                />
                {feedbackState ? (
                  <FitText
                    style={{
                      color: feedbackState.tone === "success" ? colors.success : colors.danger,
                      fontSize: 12,
                    }}
                  >
                    {feedbackState.text}
                  </FitText>
                ) : null}
                <FitButton
                  label="Leave Feedback"
                  variant="primary"
                  onPress={() => void handleFeedbackSubmit()}
                  loading={feedbackMutation.isPending}
                  loadingLabel="Submitting"
                  disabled={!liveVenueId || feedbackMutation.isPending}
                />
              </View>
            </View>
              </>
            )}
          </FitModalScrollView>
          <Animated.View style={[s.footer, footerBorderStyle]}>
            <FitButton label="Close" variant="ghost" onPress={onClose} flex={1} />
            {onReserve && venue.isReservable && status === "available" ? (
              <FitButton label="Reserve Now" variant="primary" onPress={onReserve} flex={2} />
            ) : null}
          </Animated.View>
        </Animated.View>
      </Animated.View>
      </Modal>
      <FacilityImageLightbox
        imageUri={selectedImageUri}
        isVisible={isImageOpen}
        onClose={() => setIsImageOpen(false)}
        title={venue.name}
      />
    </>
  );
}
