import { useEffect, useMemo, useState } from "react";
import { Image, Modal, Pressable, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { Image as ImageIcon } from "lucide-react-native";
import type { GymLayoutEquipmentRecord } from "@fittrack/types";
import { buildRenderableAssetUrl } from "@fittrack/utils";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { makeDetailsModalStyles } from "@/styles/modals/DetailsStyles";
import { MOBILE_API_BASE_URL } from "@/lib/api-client";
import { getFacilityStatusColor, getFacilityStatusLabel } from "@/utils/facilityStatus";
import { getVenueIcon } from "@/utils/venueMap";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FacilityImageLightbox from "@/components/modals/shared/FacilityImageLightbox";

type Props = {
  equipment: GymLayoutEquipmentRecord | null;
  isVisible: boolean;
  onClose: () => void;
  venueName?: string;
};

export default function EquipmentDetailsModal({
  equipment,
  isVisible,
  onClose,
  venueName
}: Props) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");
  const s = useMemo(() => makeDetailsModalStyles(colors), [colors]);
  const [isImageOpen, setIsImageOpen] = useState(false);
  const [failedImageUri, setFailedImageUri] = useState<string | null>(null);
  const resolvedImageUrl = buildRenderableAssetUrl({
    apiBaseUrl: MOBILE_API_BASE_URL,
    assetUrl: equipment?.imageUrl ?? null
  });

  useEffect(() => {
    setFailedImageUri(null);
    setIsImageOpen(false);
  }, [equipment?.id, resolvedImageUrl]);

  const backdropStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.overlay }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    backgroundColor: ic.value.surface,
    borderColor: ic.value.border
  }));

  if (!equipment) return null;

  const statusColor = getFacilityStatusColor(equipment.status, colors);
  const statusLabel = getFacilityStatusLabel(equipment.status);
  const Icon = getVenueIcon(equipment.iconKey);
  const canShowImage = !!resolvedImageUrl && failedImageUri !== resolvedImageUrl;

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
          <Animated.View style={[s.card, s.compactCard, cardStyle]}>
            <View style={[s.header, { borderBottomColor: colors.border }]}>
              <View style={[s.headerIcon, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
                <Icon size={17} color={colors.brand} strokeWidth={2} />
              </View>
              <View style={s.headerText}>
                <FitText style={s.headerTitle}>{equipment.name}</FitText>
                <FitText style={s.headerSubtitle} numberOfLines={1}>
                  {venueName ? `${venueName} / ${equipment.type}` : equipment.type}
                </FitText>
              </View>
            </View>
            <View style={[s.body, { gap: 14 }]}>
              <View style={[s.statusRow, { borderColor: statusColor + "55", backgroundColor: statusColor + "12" }]}>
                <View style={[s.statusDot, { backgroundColor: statusColor }]} />
                <FitText style={[s.statusText, { color: statusColor }]}>{statusLabel}</FitText>
              </View>
              {canShowImage ? (
                <Pressable
                  accessibilityLabel={`Open larger image for ${equipment.name}`}
                  accessibilityRole="button"
                  onPress={() => setIsImageOpen(true)}
                  style={s.imagePressable}
                >
                  <Image
                    accessibilityLabel={`${equipment.name} image`}
                    source={{ uri: resolvedImageUrl ?? "" }}
                    resizeMode="cover"
                    onError={() => setFailedImageUri(resolvedImageUrl)}
                    style={s.imagePreview}
                  />
                </Pressable>
              ) : (
                <View style={s.imageTile}>
                  <ImageIcon size={28} color={colors.textDisabled} strokeWidth={1.5} />
                  <FitText style={s.imageTileLabel}>No equipment image has been published yet.</FitText>
                </View>
              )}
              <View style={s.fieldBlock}>
                <FitText style={s.fieldText}>
                  {venueName ? `Placed in ${venueName}.` : "Placed on the published facility map."}
                </FitText>
                <FitText style={s.fieldTextMuted}>
                  {equipment.placedQuantity} placed unit{equipment.placedQuantity === 1 ? "" : "s"}
                </FitText>
              </View>
            </View>
            <View style={[s.footer, { borderTopColor: colors.border }]}>
              <FitButton label="Close" variant="ghost" onPress={onClose} flex={1} />
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
      <FacilityImageLightbox
        imageUri={canShowImage ? resolvedImageUrl : null}
        isVisible={isImageOpen}
        onClose={() => setIsImageOpen(false)}
        title={equipment.name}
      />
    </>
  );
}
