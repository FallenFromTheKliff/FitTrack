import { useMemo } from "react";
import { Image, Modal, Pressable, View } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { makeDetailsModalStyles } from "@/styles/modals/DetailsStyles";
import { FitText } from "@/components/fit/FitText";

type Props = {
  imageUri: string | null;
  isVisible: boolean;
  onClose: () => void;
  title: string;
};

export default function FacilityImageLightbox({
  imageUri,
  isVisible,
  onClose,
  title
}: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => makeDetailsModalStyles(colors), [colors]);

  if (!isVisible || !imageUri) return null;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[s.imageModalBackdrop, { backgroundColor: colors.overlay }]}>
        <View style={s.imageModalHeader}>
          <FitText style={s.imageModalTitle} numberOfLines={1}>
            {title}
          </FitText>
          <Pressable
            accessibilityLabel={`Close larger image for ${title}`}
            accessibilityRole="button"
            onPress={onClose}
            style={s.imageModalClose}
          >
            <FitText style={s.imageModalCloseText}>Close</FitText>
          </Pressable>
        </View>
        <Image
          accessibilityLabel={`${title} larger image`}
          source={{ uri: imageUri }}
          resizeMode="contain"
          style={s.imageModalImage}
        />
      </View>
    </Modal>
  );
}
