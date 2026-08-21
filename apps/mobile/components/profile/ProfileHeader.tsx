import { View } from "react-native";
import Animated from "react-native-reanimated";
import { buildRenderableAssetUrl } from "@fittrack/utils";

import { makeProfileStyles } from "@/styles/shared/ScreenStyles";
import { FitAvatarImage, FitText, AnimatedFitText } from "@/components/fit";
import { MOBILE_API_BASE_URL } from "@/lib/api-client";

type ProfileHeaderProps = {
  avatarBgStyle: object;
  avatarUri?: string | null;
  bannerStyle: object;
  email: string;
  initials: string;
  initialsStyle: object;
  memberSince: string;
  name: string;
  styles: ReturnType<typeof makeProfileStyles>;
};

export default function ProfileHeader({
  avatarBgStyle,
  avatarUri,
  bannerStyle,
  email,
  initials,
  initialsStyle,
  memberSince,
  name,
  styles
}: ProfileHeaderProps) {
  const resolvedAvatarUri = buildRenderableAssetUrl({
    apiBaseUrl: MOBILE_API_BASE_URL,
    assetUrl: avatarUri
  });

  return (
    <Animated.View style={[styles.profileBanner, bannerStyle]}>
      <Animated.View style={[styles.avatar, avatarBgStyle]}>
        <FitAvatarImage
          alt={`${name} avatar`}
          borderRadius={16}
          uri={resolvedAvatarUri}
          fallback={
            <AnimatedFitText style={[styles.avatarInitials, initialsStyle]}>{initials}</AnimatedFitText>
          }
        />
      </Animated.View>
      <View style={styles.profileInfo}>
        <FitText style={styles.profileName}>{name}</FitText>
        <FitText style={styles.profileEmail}>{email}</FitText>
        <FitText style={styles.profileMeta}>{memberSince}</FitText>
      </View>
    </Animated.View>
  );
}
