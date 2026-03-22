import { useEffect, useMemo, useRef, useState } from "react";
import { Image, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, CreditCard, Skull, UserCog, XCircle } from "lucide-react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { makeScreenStyles, makeProfileStyles } from "@/styles/shared/ScreenStyles";
import { BADGE_COLORS, MOCK_ACHIEVEMENTS, MOCK_BADGES, PROFILE_STATS, TIER_LABELS, TIER_LEVELS } from "@/data/member";
import { mobileApi } from "@/lib/api";

import { FitText, AnimatedFitText } from "@/components/fit/FitText";
import FitSection from "@/components/fit/FitSection";
import FitCard from "@/components/fit/FitCard";
import FitButton from "@/components/fit/FitButton";
import ConfirmModal from "@/components/modals/shared/ConfirmModal";
import EditProfileModal from "@/components/modals/profile/EditProfileModal";

type DeletionRequest = {
  status?: string | null;
};

export default function ProfileScreen() {
  const { user, updateUser } = useAuth();
  const { colors, resetAppearance } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, translateY } = usePassageAnim({ mode: "focus" });
  const queryClient = useQueryClient();
  const base = useMemo(() => makeScreenStyles(colors), [colors]);
  const s = useMemo(() => makeProfileStyles(colors), [colors]);
  const [terminateVisible, setTerminateVisible] = useState(false);
  const [cancelVisible, setCancelVisible] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const isMounted = useRef(true);
  const deletionStatusKey = useMemo(() => ["profile-deletion-status", user?.id] as const, [user?.id]);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const { data: deletionStatus = "none" } = useQuery<"none" | "pending" | "approved">({
    queryKey: deletionStatusKey,
    enabled: !!user?.id,
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: async () => {
      const { data } = await mobileApi.get<DeletionRequest | null>("/users/deletion-request");
      const normalized = data?.status?.toLowerCase() ?? "";
      if (normalized === "pending") return "pending";
      if (normalized === "approved") return "approved";
      return "none";
    }
  });

  const isFrozen = user?.status === "frozen";
  const hasPendingTermination = deletionStatus === "pending" || isFrozen;

  const screenStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const bannerStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.brand }));
  const avatarBgStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.brandLight }));
  const initialsStyle = useAnimatedStyle(() => ({ color: ic.value.brand }));

  const initials = user?.avatarInitials ?? user?.name?.slice(0, 2).toUpperCase() ?? "FT";
  const avatarUri = user?.avatarUri;
  const tier = user?.tier ?? "Basic";
  const tierLabel = TIER_LABELS[tier];
  const tierLevel = TIER_LEVELS[tier];
  const memberSince = user?.memberSince
      ? `Member since ${new Date(user.memberSince).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
      : "";

  const handleRequestTermination = async () => {
    if (isTerminating) return;
    setIsTerminating(true);
    try {
      await mobileApi.post("/users/request-deletion", { reason: "Requested via mobile app." });
      await updateUser({ status: "frozen" });
      if (!isMounted.current) return;
      resetAppearance();
      queryClient.setQueryData(deletionStatusKey, "pending");
      setTerminateVisible(false);
    } catch {}
    if (isMounted.current) setIsTerminating(false);
  };

  const handleCancelTermination = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      await mobileApi.delete("/users/deletion-request");
      await updateUser({ status: "active" });
      if (!isMounted.current) return;
      queryClient.setQueryData(deletionStatusKey, "none");
      setCancelVisible(false);
    } catch {}
    if (isMounted.current) setIsCancelling(false);
  };

  return (
      <View testID="profile-screen" style={base.screen}>
        <Animated.View style={[s.profileBanner, bannerStyle]}>
          <Animated.View style={[s.avatar, avatarBgStyle]}>
            {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={{ width: "100%", height: "100%", borderRadius: 16 }} />
            ) : (
                <AnimatedFitText style={[s.avatarInitials, initialsStyle]}>
                  {initials}
                </AnimatedFitText>
            )}
          </Animated.View>
          <View style={s.profileInfo}>
            <FitText style={s.profileName}>{user?.name ?? "Member"}</FitText>
            <FitText style={s.profileEmail}>{user?.email ?? ""}</FitText>
            <FitText style={s.profileMeta}>{memberSince}</FitText>
          </View>
        </Animated.View>
        <Animated.ScrollView
            style={[base.content, screenStyle]}
            contentContainerStyle={base.scrollContent}
            showsVerticalScrollIndicator={false}
        >
          <Animated.View style={contentStyle}>
            <FitSection heading="STATS">
              <View style={s.statsRow}>
                {PROFILE_STATS.map((item, index) => (
                    <View key={item.label} style={{ flex: 1, flexDirection: "row", alignItems: "stretch" }}>
                      <FitCard
                          icon={item.icon}
                          iconSize={20}
                          label={item.label}
                          statValue={item.value}
                      />
                      {index < PROFILE_STATS.length - 1 ? <View style={s.statDivider} /> : null}
                    </View>
                ))}
              </View>
            </FitSection>
            <FitSection heading={`?? ${tierLabel} Badges`}>
              {MOCK_BADGES.map((badge, i) => (
                  <FitCard
                      key={badge.label}
                      icon={Award}
                      iconSize={28}
                      label={badge.label}
                      subtitle={badge.subtitle}
                      iconBg={BADGE_COLORS[badge.tier]}
                      trailingLabel={badge.tier}
                      trailingLabelColor={BADGE_COLORS[badge.tier]}
                      progress={badge.progress}
                      hasBorder={i < MOCK_BADGES.length - 1}
                      onPress={() => {}}
                  />
              ))}
            </FitSection>
            <FitSection heading="Recent Achievements">
              {MOCK_ACHIEVEMENTS.map((item, i) => (
                  <FitCard
                      key={item.label}
                      icon={item.icon}
                      label={item.label}
                      subtitle={item.date}
                      noChevron
                      hasBorder={i < MOCK_ACHIEVEMENTS.length - 1}
                  />
              ))}
            </FitSection>
            <FitSection heading="ACCOUNT">
              <FitCard
                  icon={UserCog}
                  label="Edit Profile"
                  subtitle="Update your name, email, phone"
                  hasBorder
                  onPress={() => setEditVisible(true)}
              />
              <FitCard
                  icon={CreditCard}
                  label="Membership Details"
                  subtitle={`${tierLabel} · Level ${tierLevel}`}
                  onPress={() => {}}
              />
            </FitSection>
            <FitButton
                label={hasPendingTermination ? "CANCEL TERMINATION REQUEST" : "REQUEST ACCOUNT TERMINATION"}
                variant="danger"
                icon={hasPendingTermination ? XCircle : Skull}
                onPress={() => (hasPendingTermination ? setCancelVisible(true) : setTerminateVisible(true))}
                style={s.terminateBtn}
            />
          </Animated.View>
        </Animated.ScrollView>
        {terminateVisible ? (
            <ConfirmModal
                isVisible={terminateVisible}
                title="Request Account Termination?"
                message="Your account will be flagged for review. You can cancel this request before it is approved."
                yesLabel="Request Termination"
                noLabel="Cancel"
                isDestructive
                isLoading={isTerminating}
                loadingLabel="SUBMITTING"
                loadingTitle="Submitting request"
                onYes={handleRequestTermination}
                onNo={() => setTerminateVisible(false)}
            />
        ) : null}
        {cancelVisible ? (
            <ConfirmModal
                isVisible={cancelVisible}
                title="Cancel Termination Request?"
                message="Your account will be restored to active status."
                yesLabel="Cancel Request"
                noLabel="Go Back"
                isDestructive={false}
                isLoading={isCancelling}
                loadingLabel="CANCELLING"
                loadingTitle="Cancelling request"
                onYes={handleCancelTermination}
                onNo={() => setCancelVisible(false)}
            />
        ) : null}
        {editVisible ? (
            <EditProfileModal
                isVisible={editVisible}
                onClose={() => setEditVisible(false)}
            />
        ) : null}
      </View>
  );
}