import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, CalendarDays, CreditCard, Skull, UserCog, XCircle } from "lucide-react-native";

import type { CoachAvailabilityRecord, CoachProfileRecord } from "@fittrack/types";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { makeScreenStyles, makeProfileStyles } from "@/styles/shared/ScreenStyles";
import { BADGE_COLORS, MOCK_ACHIEVEMENTS, MOCK_BADGES, PROFILE_STATS, TIER_LABELS, TIER_LEVELS } from "@/data/member";
import { TIME_SLOTS } from "@/data/bookings";
import { mobileApi } from "@/lib/api";
import { queryKeys } from "@fittrack/query";
import { coachAvailabilitySchema } from "@fittrack/validators";
import { to12HourLabel, to24HourValue } from "@fittrack/utils";

import { EditProfileModal, ConfirmModal, TimeSlotModal, type TimeSlot } from "@/components/modals";
import { FitButton, FitCard, FitSection, FitSquareToggle, FitText, AnimatedFitText } from "@/components/fit";

type DeletionRequest = {
  status?: string | null;
};

type AvailabilityDraft = {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
};

const WEEKDAY_OPTIONS = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 }
];

function buildEndSlots(startTime: string): TimeSlot[] {
  if (!startTime) return [];
  const startLabel = to12HourLabel(startTime);
  const startIndex = TIME_SLOTS.findIndex((slot) => slot.time === startLabel);
  if (startIndex === -1) return [];
  const nextSlots: TimeSlot[] = [];
  for (let index = startIndex + 1; index < TIME_SLOTS.length; index += 1) {
    nextSlots.push(TIME_SLOTS[index]);
  }
  return nextSlots;
}

export default function ProfileScreen() {
  const { user, updateUser } = useAuth();
  const { colors, resetAppearance, settings } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, translateY } = usePassageAnim({ mode: "focus" });
  const queryClient = useQueryClient();
  const base = useMemo(() => makeScreenStyles(colors), [colors]);
  const s = useMemo(() => makeProfileStyles(colors), [colors]);
  const isCoach = user?.role === "COACH";
  const [terminateVisible, setTerminateVisible] = useState(false);
  const [cancelVisible, setCancelVisible] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [isAvailabilityEditorOpen, setIsAvailabilityEditorOpen] = useState(false);
  const [availabilityDraft, setAvailabilityDraft] = useState<AvailabilityDraft>({
    dayOfWeek: 1,
    startTime: "",
    endTime: "",
    isAvailable: true
  });
  const [availabilityDeleteTarget, setAvailabilityDeleteTarget] = useState<CoachAvailabilityRecord | null>(null);
  const [isAvailabilitySaving, setIsAvailabilitySaving] = useState(false);
  const [isAvailabilityDeleting, setIsAvailabilityDeleting] = useState(false);
  const [isAvailabilityTimeOpen, setIsAvailabilityTimeOpen] = useState(false);
  const [availabilityTimeTarget, setAvailabilityTimeTarget] = useState<"start" | "end">("start");
  const isMounted = useRef(true);
  const deletionStatusKey = useMemo(() => queryKeys.profileDeletionStatus(user?.id), [user?.id]);

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

  const { data: coachProfile = null } = useQuery<CoachProfileRecord | null>({
    queryKey: queryKeys.coachSelfProfile(user?.id),
    enabled: !!user?.id && isCoach,
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: async () => {
      const { data } = await mobileApi.get<CoachProfileRecord[]>("/coaches");
      return data.find((coach) => coach.user?.id === user?.id) ?? null;
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
    } catch {
      return;
    }
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
    } catch {
      return;
    }
    if (isMounted.current) setIsCancelling(false);
  };

  const handleStartAvailabilityEditor = (slot?: CoachAvailabilityRecord) => {
    if (slot) {
      setAvailabilityDraft({
        id: slot.id,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isAvailable: slot.isAvailable
      });
    } else {
      setAvailabilityDraft({
        dayOfWeek: 1,
        startTime: "",
        endTime: "",
        isAvailable: true
      });
    }
    setIsAvailabilityEditorOpen(true);
  };

  const handleAvailabilitySelect = (slot: TimeSlot) => {
    const value = to24HourValue(slot.time);
    if (availabilityTimeTarget === "start") {
      setAvailabilityDraft((prev) => ({ ...prev, startTime: value, endTime: "" }));
      setIsAvailabilityTimeOpen(false);
      return;
    }
    setAvailabilityDraft((prev) => ({ ...prev, endTime: value }));
    setIsAvailabilityTimeOpen(false);
  };

  const handleSaveAvailability = async () => {
    if (!coachProfile) return;
    const parsed = coachAvailabilitySchema.safeParse({
      dayOfWeek: availabilityDraft.dayOfWeek,
      startTime: availabilityDraft.startTime,
      endTime: availabilityDraft.endTime,
      isAvailable: availabilityDraft.isAvailable
    });
    if (!parsed.success) return;
    setIsAvailabilitySaving(true);
    try {
      if (availabilityDraft.id) {
        await mobileApi.patch(`/coaches/availability/${availabilityDraft.id}`, {
          startTime: parsed.data.startTime,
          endTime: parsed.data.endTime,
          isAvailable: parsed.data.isAvailable
        });
      } else {
        await mobileApi.post("/coaches/availability", {
          dayOfWeek: parsed.data.dayOfWeek,
          startTime: parsed.data.startTime,
          endTime: parsed.data.endTime
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.coachSelfProfile(user?.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.coaches() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.coachAvailability(coachProfile.id) })
      ]);
      setIsAvailabilityEditorOpen(false);
    } finally {
      setIsAvailabilitySaving(false);
    }
  };

  const handleDeleteAvailability = async () => {
    if (!availabilityDeleteTarget || !coachProfile) return;
    setIsAvailabilityDeleting(true);
    try {
      await mobileApi.delete(`/coaches/availability/${availabilityDeleteTarget.id}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.coachSelfProfile(user?.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.coaches() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.coachAvailability(coachProfile.id) })
      ]);
      setAvailabilityDeleteTarget(null);
      setIsAvailabilityEditorOpen(false);
    } finally {
      setIsAvailabilityDeleting(false);
    }
  };

  const availabilitySlots = coachProfile?.availability ?? [];
  const availabilityEndSlots = buildEndSlots(availabilityDraft.startTime);

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
          <FitText style={s.profileName}>{user?.name ?? (isCoach ? "Coach" : "Member")}</FitText>
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
          {isCoach ? (
            <>
              <FitSection heading="COACH SUMMARY">
                <View style={s.statsRow}>
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "stretch" }}>
                    <FitCard
                      icon={CreditCard}
                      iconSize={20}
                      label="Hourly Rate"
                      statValue={coachProfile?.hourlyRate ? `PHP ${coachProfile.hourlyRate}` : "--"}
                    />
                    <View style={s.statDivider} />
                  </View>
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "stretch" }}>
                    <FitCard
                      icon={Award}
                      iconSize={20}
                      label="Experience"
                      statValue={coachProfile?.yearsExperience != null ? `${coachProfile.yearsExperience}y` : "--"}
                    />
                  </View>
                </View>
              </FitSection>
              <FitSection heading="COACH PROFILE">
                <FitCard
                  icon={UserCog}
                  label="Edit Coach Profile"
                  subtitle={coachProfile?.specialties?.length ? coachProfile.specialties.join(", ") : "Update bio, specialties, certifications, and rates"}
                  hasBorder
                  onPress={() => setEditVisible(true)}
                />
                <FitCard
                  icon={CalendarDays}
                  label="Availability Status"
                  subtitle={coachProfile?.isActive === false ? "Coach profile is inactive" : "Coach profile is active"}
                  trailingLabel={coachProfile?.isActive === false ? "Inactive" : "Active"}
                  trailingLabelColor={coachProfile?.isActive === false ? colors.warning : colors.success}
                  noChevron
                />
              </FitSection>
              <FitSection heading="AVAILABILITY">
                {availabilitySlots.map((slot, index) => (
                  <FitCard
                    key={slot.id}
                    icon={CalendarDays}
                    label={WEEKDAY_OPTIONS.find((option) => option.value === slot.dayOfWeek)?.label ?? `Day ${slot.dayOfWeek}`}
                    subtitle={`${to12HourLabel(slot.startTime)} - ${to12HourLabel(slot.endTime)}`}
                    trailingLabel={slot.isAvailable ? "Active" : "Paused"}
                    trailingLabelColor={slot.isAvailable ? colors.success : colors.warning}
                    hasBorder={index < availabilitySlots.length - 1}
                    onPress={() => handleStartAvailabilityEditor(slot)}
                  />
                ))}
                <FitButton
                  label="Add Availability Slot"
                  variant="primary"
                  onPress={() => handleStartAvailabilityEditor()}
                  style={{ marginTop: 12 }}
                />
                {isAvailabilityEditorOpen ? (
                  <View
                    style={{
                      marginTop: 12,
                      padding: 14,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 16,
                      backgroundColor: colors.surface
                    }}
                  >
                    <FitText style={{ fontSize: 12, color: colors.textMuted, marginBottom: 8 }}>DAY OF WEEK</FitText>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                      {WEEKDAY_OPTIONS.map((option) => {
                        const isActive = availabilityDraft.dayOfWeek === option.value;
                        return (
                          <Pressable
                            key={option.value}
                            onPress={() => setAvailabilityDraft((prev) => ({ ...prev, dayOfWeek: option.value }))}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 12,
                              borderWidth: 1,
                              borderColor: isActive ? colors.brand : colors.border,
                              backgroundColor: isActive ? colors.brand + "18" : colors.surfaceRaised
                            }}
                          >
                            <FitText style={{ color: isActive ? colors.brand : colors.textPrimary, fontWeight: "600" }}>{option.label}</FitText>
                          </Pressable>
                        );
                      })}
                    </View>
                    <FitText style={{ fontSize: 12, color: colors.textMuted, marginBottom: 8 }}>TIME RANGE</FitText>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <FitButton
                        label={availabilityDraft.startTime ? to12HourLabel(availabilityDraft.startTime) : "Start Time"}
                        variant="field"
                        onPress={() => {
                          setAvailabilityTimeTarget("start");
                          setIsAvailabilityTimeOpen(true);
                        }}
                        flex={1}
                      />
                      <FitButton
                        label={availabilityDraft.endTime ? to12HourLabel(availabilityDraft.endTime) : "End Time"}
                        variant="field"
                        onPress={() => {
                          if (!availabilityDraft.startTime) return;
                          setAvailabilityTimeTarget("end");
                          setIsAvailabilityTimeOpen(true);
                        }}
                        disabled={!availabilityDraft.startTime}
                        flex={1}
                      />
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                      <FitText style={{ fontSize: 14, color: colors.textPrimary }}>Availability active</FitText>
                      <FitSquareToggle
                        value={availabilityDraft.isAvailable}
                        onValueChange={(value: boolean) => setAvailabilityDraft((prev) => ({ ...prev, isAvailable: value }))}
                        activeColor={colors.brand}
                        inactiveColor={colors.border}
                        useAnimations={settings.animationLevel === "full"}
                      />
                    </View>
                    <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                      <FitButton
                        label="Cancel"
                        variant="ghost"
                        onPress={() => {
                          setIsAvailabilityEditorOpen(false);
                          setAvailabilityDeleteTarget(null);
                        }}
                        flex={1}
                      />
                      {availabilityDraft.id ? (
                        <FitButton
                          label="Delete"
                          variant="danger"
                          onPress={() => {
                            const target = availabilitySlots.find((slot) => slot.id === availabilityDraft.id) ?? null;
                            setAvailabilityDeleteTarget(target);
                          }}
                          flex={1}
                        />
                      ) : null}
                      <FitButton
                        label={isAvailabilitySaving ? "Saving" : availabilityDraft.id ? "Update" : "Save"}
                        variant="primary"
                        onPress={handleSaveAvailability}
                        disabled={!availabilityDraft.startTime || !availabilityDraft.endTime || isAvailabilitySaving}
                        flex={1}
                      />
                    </View>
                  </View>
                ) : null}
              </FitSection>
            </>
          ) : (
            <>
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
              <FitSection heading={`Badges - ${tierLabel}`}>
                {MOCK_BADGES.map((badge, index) => (
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
                    hasBorder={index < MOCK_BADGES.length - 1}
                    onPress={() => {}}
                  />
                ))}
              </FitSection>
              <FitSection heading="Recent Achievements">
                {MOCK_ACHIEVEMENTS.map((item, index) => (
                  <FitCard
                    key={item.label}
                    icon={item.icon}
                    label={item.label}
                    subtitle={item.date}
                    noChevron
                    hasBorder={index < MOCK_ACHIEVEMENTS.length - 1}
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
                  subtitle={`${tierLabel} | Level ${tierLevel}`}
                  onPress={() => {}}
                />
              </FitSection>
            </>
          )}
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
      {availabilityDeleteTarget ? (
        <ConfirmModal
          isVisible={!!availabilityDeleteTarget}
          title="Delete Availability Slot?"
          message="This slot will no longer appear in coach availability."
          yesLabel="Delete"
          noLabel="Keep Slot"
          isDestructive
          isLoading={isAvailabilityDeleting}
          loadingLabel="DELETING"
          loadingTitle="Removing slot"
          onYes={handleDeleteAvailability}
          onNo={() => setAvailabilityDeleteTarget(null)}
        />
      ) : null}
      {editVisible ? (
        <EditProfileModal
          isVisible={editVisible}
          onClose={() => setEditVisible(false)}
          coachProfile={coachProfile}
        />
      ) : null}
      <TimeSlotModal
        isVisible={isAvailabilityTimeOpen}
        slots={availabilityTimeTarget === "start" ? TIME_SLOTS : availabilityEndSlots}
        selectedTime={availabilityTimeTarget === "start" ? to12HourLabel(availabilityDraft.startTime) : to12HourLabel(availabilityDraft.endTime)}
        onSelect={handleAvailabilitySelect}
        onClose={() => setIsAvailabilityTimeOpen(false)}
      />
    </View>
  );
}
