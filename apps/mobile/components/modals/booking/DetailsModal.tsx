import { useMemo } from "react";
import { Modal, ScrollView, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import { Clock, Image as ImageIcon, Users } from "lucide-react-native";
import { gymLayoutEquipmentQueryOptions } from "@fittrack/query";
import { isEquipmentInsideVenue } from "@fittrack/types";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { makeDetailsModalStyles } from "@/styles/modals/DetailsStyles";
import { AMENITY_META, AMENITY_STATUS_META, type AmenityStatus, AMENITY_IMAGE_PLACEHOLDERS } from "@/data/amenities";
import { formatCurrency } from "@fittrack/utils";
import { mobileApiClient } from "@/lib/api-client";
import { getVenueIcon } from "@/utils/venueMap";
import type { VenuePresentation } from "@/utils/venueBookings";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";

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

  const meta = AMENITY_META[venue.id] ?? {
    description: "Facility details coming soon.",
    hours: "Check with staff for hours",
    status: "available" as AmenityStatus
  };
  const statusMeta = AMENITY_STATUS_META[meta.status];
  const Icon = getVenueIcon(venue.iconKey);
  const priceLabel = venue.isReservable ? `${formatCurrency(venue.price)} / ${venue.unit}` : "Core facility";
  const capacityLabel = venue.maxSlots > 0 ? `${venue.maxSlots} slots` : "Not specified";
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

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={undefined}
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
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>
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
              <View style={s.imagesGrid}>
                {AMENITY_IMAGE_PLACEHOLDERS.map((label) => (
                  <View key={label} style={s.imageTile}>
                    <ImageIcon size={28} color={colors.textDisabled} strokeWidth={1.5} />
                    <FitText style={s.imageTileLabel}>{label}</FitText>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
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
