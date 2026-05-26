import { useEffect, useMemo, useState } from "react";
import { Image, Modal, Pressable, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Clock, Image as ImageIcon, Star, Users } from "lucide-react-native";
import {
  gymLayoutEquipmentQueryOptions,
  submitVenueFeedbackMutationOptions,
  venueFeedbackQueryOptions,
} from "@fittrack/query";
import { isEquipmentInsideVenue } from "@fittrack/types";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { makeDetailsModalStyles } from "@/styles/modals/DetailsStyles";
import { AMENITY_STATUS_META, type AmenityStatus } from "@/data/amenities";
import { buildRenderableAssetUrl, formatCurrency } from "@fittrack/utils";
import { MOBILE_API_BASE_URL, mobileApiClient } from "@/lib/api-client";
import { getVenueIcon } from "@/utils/venueMap";
import type { VenuePresentation } from "@/utils/venueBookings";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitModalScrollView from "@/components/modals/shared/FitModalScrollView";

type Props = {
  isVisible: boolean;
  venue: VenuePresentation | null;
  onClose: () => void;
  onReserve?: () => void;
};

export default function DetailsModal({ isVisible, venue, onClose, onReserve }: Props) {
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
  const [failedImageUri, setFailedImageUri] = useState<string | null>(null);
  const resolvedVenueImageUrl = buildRenderableAssetUrl({
    apiBaseUrl: MOBILE_API_BASE_URL,
    assetUrl: venue?.imageUrl ?? null
  });

  useEffect(() => {
    setFailedImageUri(null);
  }, [resolvedVenueImageUrl]);

  const feedbackQuery = useQuery({
    ...venueFeedbackQueryOptions(mobileApiClient, liveVenueId),
    enabled: isVisible && !!liveVenueId,
  });
  const feedbackMutation = useMutation({
    ...submitVenueFeedbackMutationOptions(mobileApiClient),
    onSuccess: async () => {
      await feedbackQuery.refetch();
    },
  });

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

  if (!venue) return null;

  const meta = {
    description:
      venue.description?.trim() ||
      "No member-facing description has been published for this venue yet.",
    hours: "Facility-specific hours have not been published for this venue.",
    status: "available" as AmenityStatus
  };
  const statusMeta = AMENITY_STATUS_META[meta.status];
  const Icon = getVenueIcon(venue.iconKey);
  const priceLabel = venue.isReservable ? `${formatCurrency(venue.price)} / ${venue.unit}` : "Core facility";
  const capacityLabel = venue.maxSlots > 0 ? `${venue.maxSlots} slots` : "Not specified";
  const canShowVenueImage = !!resolvedVenueImageUrl && failedImageUri !== resolvedVenueImageUrl;
  const venueFloorId = venue.floorId ?? null;
  const assignedEquipment = venueFloorId
    ? liveEquipment
        .filter((item) =>
          isEquipmentInsideVenue(item, {
            floorId: venueFloorId,
            gridColumn: venue.gridColumn,
            gridHeight: venue.gridHeight,
            gridRow: venue.gridRow,
            gridWidth: venue.gridWidth
          })
        )
        .sort((left, right) => left.name.localeCompare(right.name))
    : [];
  const venueFeedback = feedbackQuery.data ?? [];
  const averageRating =
    venueFeedback.length > 0
      ? venueFeedback.reduce((sum, entry) => sum + entry.rating, 0) /
        venueFeedback.length
      : null;
  const handleFeedbackSubmit = async () => {
    if (!liveVenueId) {
      setFeedbackState({
        text: "This venue is not connected to a live facility record yet.",
        tone: "danger",
      });
      return;
    }

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
    }
  };

  return (
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
              <FitText style={s.headerTitle}>{venue.name}</FitText>
              <FitText style={s.headerSubtitle}>{priceLabel} {"\u00B7"} up to {venue.maxSlots} slots</FitText>
            </View>
          </Animated.View>
          <FitModalScrollView
            style={s.middle}
            contentContainerStyle={s.body}
            resetKey={venue.sourceVenueId ?? venue.id}
          >
            <View>
              <FitText style={s.sectionLabel}>Description</FitText>
              <View style={s.fieldBlock}>
                <FitText style={s.fieldTextMuted}>{meta.description}</FitText>
              </View>
            </View>
            <View>
              <FitText style={s.sectionLabel}>Operating Hours</FitText>
              <View style={s.hoursRow}>
                <Clock size={16} color={colors.brand} strokeWidth={2} />
                <FitText style={s.fieldText}>{meta.hours}</FitText>
              </View>
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
            <View>
              <FitText style={s.sectionLabel}>Live Equipment</FitText>
              <View style={s.fieldBlock}>
                {assignedEquipment.length > 0 ? (
                  assignedEquipment.map((item) => (
                    <FitText key={item.id} style={s.fieldText}>
                      * {item.name}
                    </FitText>
                  ))
                ) : (
                  <FitText style={s.fieldTextMuted}>No live equipment is assigned to this zone yet.</FitText>
                )}
              </View>
            </View>
            <View>
              <FitText style={s.sectionLabel}>Images</FitText>
              {canShowVenueImage ? (
                <Image
                  source={{ uri: resolvedVenueImageUrl ?? "" }}
                  resizeMode="cover"
                  onError={() => setFailedImageUri(resolvedVenueImageUrl)}
                  style={s.imagePreview}
                />
              ) : (
                <View style={s.imageTile}>
                  <ImageIcon size={28} color={colors.textDisabled} strokeWidth={1.5} />
                  <FitText style={s.imageTileLabel}>No venue image has been published yet.</FitText>
                </View>
              )}
            </View>
            <View>
              <FitText style={s.sectionLabel}>Venue Feedback</FitText>
              <View style={s.fieldBlock}>
                <FitText style={s.fieldText}>
                  Average rating: {averageRating ? `${averageRating.toFixed(1)}/5` : "No ratings yet"}
                </FitText>
                {venueFeedback.slice(0, 3).map((entry) => (
                  <FitText key={entry.id} style={s.fieldTextMuted}>
                    {entry.rating}/5 - {entry.comment ?? "No written comment."}
                  </FitText>
                ))}
              </View>
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
                  disabled={!liveVenueId}
                />
              </View>
            </View>
          </FitModalScrollView>
          <Animated.View style={[s.footer, footerBorderStyle]}>
            <FitButton label="Close" variant="ghost" onPress={onClose} flex={1} />
            {onReserve && venue.isReservable && meta.status === "available" ? (
              <FitButton label="Reserve Now" variant="primary" onPress={onReserve} flex={2} />
            ) : null}
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
