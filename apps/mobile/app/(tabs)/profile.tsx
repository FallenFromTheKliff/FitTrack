import { useMemo } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { useProfileScreen } from "@/hooks/profile/useProfileScreen";
import { makeProfileStyles, makeScreenStyles } from "@/styles/shared/ScreenStyles";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileModals from "@/components/profile/ProfileModals";
import ProfileSections from "@/components/profile/ProfileSections";

export default function ProfileScreen() {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, translateY } = usePassageAnim({ mode: "focus" });
  const controller = useProfileScreen();
  const base = useMemo(() => makeScreenStyles(colors), [colors]);
  const styles = useMemo(() => makeProfileStyles(colors), [colors]);

  const screenStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const bannerStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.brand }));
  const avatarBgStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.brandLight }));
  const initialsStyle = useAnimatedStyle(() => ({ color: ic.value.brand }));

  return (
    <View testID="profile-screen" style={base.screen}>
      <ProfileHeader
        avatarBgStyle={avatarBgStyle}
        avatarUri={controller.avatarUri}
        bannerStyle={bannerStyle}
        email={controller.user?.email ?? ""}
        initials={controller.initials}
        initialsStyle={initialsStyle}
        memberSince={controller.memberSince}
        name={controller.user?.name ?? (controller.isCoach ? "Coach" : "Member")}
        styles={styles}
      />
      <Animated.ScrollView
        style={[base.content, screenStyle]}
        contentContainerStyle={base.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={contentStyle}>
          <ProfileSections colors={colors} controller={controller} styles={styles} />
        </Animated.View>
      </Animated.ScrollView>
      <ProfileModals controller={controller} />
    </View>
  );
}
