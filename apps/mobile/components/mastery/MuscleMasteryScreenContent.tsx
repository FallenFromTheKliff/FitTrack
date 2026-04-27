import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import {
  Bot,
  Dumbbell,
  Eye,
  EyeOff,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  UserRound,
  type LucideIcon,
} from "lucide-react-native";
import { R } from "@fittrack/ui/tokens";

import { useTheme } from "@/contexts/ThemeContext";
import PremiumFeatureGate from "@/components/membership/PremiumFeatureGate";
import { FitButton, FitCard, FitSection, FitText } from "@/components/fit";

import type { useMuscleMasteryScreen } from "@/hooks/mastery/useMuscleMasteryScreen";

type MuscleMasteryScreenController = ReturnType<typeof useMuscleMasteryScreen>;

function makeStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    achievementCard: {
      borderWidth: 1,
      borderRadius: R.lg,
      padding: 14,
      gap: 8,
    },
    achievementDescription: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    achievementGrid: {
      gap: 10,
    },
    achievementMeta: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    achievementTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
    },
    actionGrid: {
      gap: 10,
    },
    emptyMessage: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    heroCard: {
      borderRadius: R.xl,
      padding: 18,
      gap: 16,
    },
    heroEyebrow: {
      color: colors.onBrand ?? "#FFFFFF",
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1.1,
    },
    heroMetaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    heroMetaPill: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    heroMetaText: {
      color: colors.onBrand ?? "#FFFFFF",
      fontSize: 12,
      fontWeight: "600",
    },
    heroSubtitle: {
      color: colors.onBrand ?? "#FFFFFF",
      fontSize: 14,
      lineHeight: 20,
      opacity: 0.92,
    },
    heroTitle: {
      color: colors.onBrand ?? "#FFFFFF",
      fontSize: 24,
      fontWeight: "700",
      lineHeight: 30,
    },
    leaderboardAvatar: {
      alignItems: "center",
      borderRadius: 16,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    leaderboardAvatarText: {
      fontSize: 13,
      fontWeight: "700",
    },
    leaderboardMeta: {
      alignItems: "flex-end",
      gap: 2,
    },
    leaderboardName: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
    },
    leaderboardRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      paddingVertical: 10,
    },
    leaderboardSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
    },
    leaderboardXp: {
      color: colors.brand,
      fontSize: 13,
      fontWeight: "700",
    },
    masteryList: {
      gap: 10,
    },
    noticeCard: {
      borderRadius: R.lg,
      borderWidth: 1,
      gap: 6,
      padding: 14,
    },
    noticeTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    privacyDescription: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 6,
    },
    privacyGrid: {
      gap: 10,
    },
    privacyOption: {
      borderRadius: R.lg,
      borderWidth: 1,
      padding: 10,
    },
    progressMeta: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    sectionMessage: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    separator: {
      height: 1,
      marginVertical: 4,
    },
    statGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    statTile: {
      flexBasis: "47%",
    },
    subSection: {
      gap: 10,
      marginTop: 12,
    },
    subSectionTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
  });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatTitle(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getVisibilityIcon(value: string): LucideIcon {
  if (value === "anonymous") return UserRound;
  if (value === "private") return EyeOff;
  return Eye;
}

export default function MuscleMasteryScreenContent({
  controller,
}: {
  controller: MuscleMasteryScreenController;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const maxXp = controller.mastery[0]?.xpPoints ?? 0;

  return (
    <>
      <View style={[styles.heroCard, { backgroundColor: colors.brand }]}>
        <FitText style={styles.heroEyebrow}>MUSCLE MASTERY</FitText>
        <View style={styles.heroMetaRow}>
          <View
            style={[
              styles.heroMetaPill,
              { borderColor: (colors.onBrand ?? "#FFFFFF") + "44" },
            ]}
          >
            <FitText style={styles.heroMetaText}>
              {controller.seasonRankLabel}
            </FitText>
          </View>
          <View
            style={[
              styles.heroMetaPill,
              { borderColor: (colors.onBrand ?? "#FFFFFF") + "44" },
            ]}
          >
            <FitText style={styles.heroMetaText}>
              {controller.topMuscle
                ? `${controller.topMuscle.muscleGroup} leads`
                : "No muscles tracked yet"}
            </FitText>
          </View>
        </View>
        <FitText style={styles.heroTitle}>
          {controller.progressionProfile
            ? `${controller.progressionProfile.currentStreak} day streak in motion`
            : controller.topMuscle
              ? `${controller.topMuscle.rankDisplay} momentum is building`
              : "Build your first mastery streak"}
        </FitText>
        <FitText style={styles.heroSubtitle}>
          {controller.progressionProfile
            ? `${controller.seasonCaption}. ${controller.progressionProfile.totalXp.toLocaleString("en-US")} confirmed EXP now drives your mastery, milestones, and ranking visibility.`
            : "This page keeps workout progress, gym ranking, and milestone badges in one cleaner surface while workout stays focused on live tracking."}
        </FitText>
      </View>

      <FitSection heading="Quick Links">
        <View style={styles.actionGrid}>
          <FitButton
            label="Open Workout"
            icon={Dumbbell}
            onPress={controller.onOpenWorkout}
            variant="primary"
          />
          <FitButton
            label="Open Nutrition"
            icon={Target}
            onPress={controller.onOpenNutrition}
            variant="ghost"
          />
          <FitButton
            label="Ask BrodigyAI"
            icon={Bot}
            onPress={controller.onOpenChatbot}
            variant="ghost"
          />
        </View>
      </FitSection>

      {controller.isMemberLocked ? (
        <FitSection heading="Access">
          <PremiumFeatureGate
            eyebrow="MEMBERSHIP CARD REQUIRED"
            statusLabel={controller.memberLockStatusLabel}
            title={
              controller.memberLockStatusLabel === "Pending verification"
                ? "Muscle Mastery is pending verification"
                : "Muscle Mastery stays locked"
            }
            message={controller.memberLockMessage}
            actionLabel="Open Membership Details"
            onActionPress={controller.onOpenProfile}
          />
        </FitSection>
      ) : controller.isLoading ? (
        <FitSection heading="Overview">
          <FitText style={styles.sectionMessage}>
            Loading mastery progress, milestones, season standing, and privacy
            settings...
          </FitText>
        </FitSection>
      ) : controller.isError ? (
        <FitSection heading="Overview">
          <FitText style={styles.sectionMessage}>
            {controller.errorMessage}
          </FitText>
          <FitButton
            label="Retry"
            icon={RefreshCw}
            onPress={() => void controller.onRefresh()}
            variant="ghost"
            style={{ marginTop: 12 }}
          />
        </FitSection>
      ) : controller.isEmpty ? (
        <FitSection heading="Overview">
          <FitText style={styles.emptyMessage}>
            No progression has landed on this account yet. Finish a tracked
            workout to start earning EXP, milestone progress, and season points.
          </FitText>
          <FitButton
            label="Start First Workout"
            icon={Dumbbell}
            onPress={controller.onOpenWorkout}
            variant="primary"
            style={{ marginTop: 12 }}
          />
        </FitSection>
      ) : (
        <>
          {controller.integrityNotice ? (
            <FitSection heading="Progress Status">
              <View
                style={[
                  styles.noticeCard,
                  {
                    backgroundColor: colors.warning + "12",
                    borderColor: colors.warning + "55",
                  },
                ]}
              >
                <FitText style={styles.noticeTitle}>
                  {controller.integrityNotice.title}
                </FitText>
                <FitText style={styles.sectionMessage}>
                  {controller.integrityNotice.body}
                </FitText>
              </View>
            </FitSection>
          ) : null}

          <FitSection heading="Snapshot">
            <View style={styles.statGrid}>
              {controller.summaryCards.map((item) => (
                <View key={item.id} style={styles.statTile}>
                  <FitCard label={item.label} statValue={item.value} />
                </View>
              ))}
            </View>
          </FitSection>

          <FitSection heading="Season and Privacy">
            <FitCard
              label={controller.seasonCaption}
              subtitle={
                controller.seasonStanding?.season
                  ? `${controller.seasonStanding.seasonPoints.toLocaleString("en-US")} season points | ${controller.seasonRankLabel}`
                  : "Season standings will appear when an active season is available."
              }
              trailingLabel={controller.rankingVisibility.toUpperCase()}
              trailingLabelColor={
                controller.rankingVisibility === "private"
                  ? colors.textMuted
                  : colors.brand
              }
              icon={Trophy}
              noChevron
            />
            <View style={styles.subSection}>
              <FitText style={styles.subSectionTitle}>
                Ranking Visibility
              </FitText>
              <View style={styles.privacyGrid}>
                {controller.rankingVisibilityOptions.map((option) => {
                  const Icon = getVisibilityIcon(option.value);
                  return (
                    <View
                      key={option.value}
                      style={[
                        styles.privacyOption,
                        {
                          backgroundColor: option.isSelected
                            ? colors.brand + "10"
                            : colors.surfaceRaised,
                          borderColor: option.isSelected
                            ? colors.brand + "66"
                            : colors.border,
                        },
                      ]}
                    >
                      <FitButton
                        label={option.label}
                        icon={Icon}
                        onPress={() =>
                          void controller.onSelectRankingVisibility(
                            option.value,
                          )
                        }
                        variant={option.isSelected ? "primary" : "ghost"}
                        disabled={controller.isUpdatingRankingVisibility}
                        loading={
                          controller.isUpdatingRankingVisibility &&
                          option.isSelected
                        }
                      />
                      <FitText style={styles.privacyDescription}>
                        {option.description}
                      </FitText>
                    </View>
                  );
                })}
              </View>
              {controller.privacyError ? (
                <FitText
                  style={[styles.sectionMessage, { color: colors.danger }]}
                >
                  {controller.privacyError}
                </FitText>
              ) : null}
            </View>
          </FitSection>

          <FitSection heading="Milestone Progress">
            {controller.activeMilestones.length > 0 ? (
              <View style={styles.masteryList}>
                {controller.activeMilestones.map((milestone) => (
                  <FitCard
                    key={milestone.milestoneDefinitionId}
                    label={milestone.title}
                    subtitle={`${formatTitle(milestone.category)} | ${milestone.progressValue.toLocaleString("en-US")} / ${milestone.targetValue.toLocaleString("en-US")}`}
                    trailingLabel={`${Math.round(milestone.progressPercent)}%`}
                    trailingLabelColor={colors.brand}
                    progress={Math.min(
                      Math.max(milestone.progressPercent / 100, 0),
                      1,
                    )}
                    icon={ShieldCheck}
                    noChevron
                  />
                ))}
              </View>
            ) : (
              <FitText style={styles.sectionMessage}>
                No active milestones are waiting right now. Confirmed unlocks
                will stay visible here when the backbone publishes them.
              </FitText>
            )}
          </FitSection>

          {controller.recentUnlocks.length > 0 ? (
            <FitSection heading="Recent Unlocks">
              <View style={styles.masteryList}>
                {controller.recentUnlocks.map((milestone) => (
                  <FitCard
                    key={milestone.milestoneDefinitionId}
                    label={milestone.title}
                    subtitle={`${formatTitle(milestone.category)} | ${milestone.status === "claimed" ? "Claimed" : "Unlocked"}`}
                    trailingLabel={
                      milestone.status === "claimed" ? "Claimed" : "Unlocked"
                    }
                    trailingLabelColor={colors.success ?? colors.brand}
                    icon={Sparkles}
                    noChevron
                  />
                ))}
              </View>
            </FitSection>
          ) : null}

          <FitSection heading="Top Muscle Groups">
            <View style={styles.masteryList}>
              {controller.mastery.map((entry) => (
                <FitCard
                  key={entry.id}
                  label={entry.muscleGroup}
                  subtitle={`${entry.xpPoints.toLocaleString("en-US")} EXP | ${entry.totalVolumeKg.toLocaleString("en-US")} kg total volume`}
                  trailingLabel={entry.rankDisplay}
                  trailingLabelColor={colors.brand}
                  progress={maxXp > 0 ? entry.xpPoints / maxXp : 0}
                  icon={Sparkles}
                  noChevron
                />
              ))}
            </View>
          </FitSection>

          <FitSection heading="Gym Leaderboard">
            {controller.rankingVisibility === "private" ? (
              <FitText style={styles.sectionMessage}>
                Your visible ranking is private. Progression still counts in
                your history, but member-facing leaderboards hide your standing.
              </FitText>
            ) : controller.leaderboard.length > 0 ? (
              <View>
                {controller.leaderboard.map((entry, index) => (
                  <View key={`${entry.userId}-${entry.rankPosition}`}>
                    <View style={styles.leaderboardRow}>
                      <View
                        style={[
                          styles.leaderboardAvatar,
                          { backgroundColor: colors.brand + "18" },
                        ]}
                      >
                        <FitText
                          style={[
                            styles.leaderboardAvatarText,
                            { color: colors.brand },
                          ]}
                        >
                          {getInitials(entry.displayName)}
                        </FitText>
                      </View>
                      <View style={{ flex: 1 }}>
                        <FitText style={styles.leaderboardName}>
                          {entry.displayName}
                        </FitText>
                        <FitText style={styles.leaderboardSubtitle}>
                          Rank #{entry.rankPosition}
                        </FitText>
                      </View>
                      <View style={styles.leaderboardMeta}>
                        <FitText style={styles.leaderboardXp}>
                          {entry.totalXp.toLocaleString("en-US")} EXP
                        </FitText>
                        <FitText style={styles.leaderboardSubtitle}>
                          {controller.leaderboardEntry?.userId === entry.userId
                            ? "You"
                            : "Gym member"}
                        </FitText>
                      </View>
                    </View>
                    {index < controller.leaderboard.length - 1 ? (
                      <View
                        style={[
                          styles.separator,
                          { backgroundColor: colors.border },
                        ]}
                      />
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <FitText style={styles.sectionMessage}>
                No visible leaderboard entries are available for this season
                yet.
              </FitText>
            )}
          </FitSection>

          <FitSection heading="Achievement Highlights">
            {controller.achievementCards.length > 0 ? (
              <View style={styles.achievementGrid}>
                {controller.achievementCards.map((achievement) => (
                  <View
                    key={achievement.id}
                    style={[
                      styles.achievementCard,
                      {
                        backgroundColor: achievement.isUnlocked
                          ? colors.brand + "10"
                          : colors.surfaceRaised,
                        borderColor: achievement.isUnlocked
                          ? colors.brand + "44"
                          : colors.border,
                      },
                    ]}
                  >
                    <FitText style={styles.achievementTitle}>
                      {achievement.label}
                    </FitText>
                    <FitText style={styles.achievementDescription}>
                      {achievement.description}
                    </FitText>
                    <View style={styles.achievementMeta}>
                      <FitText style={styles.progressMeta}>
                        {achievement.category}
                      </FitText>
                      <FitText style={styles.progressMeta}>
                        {achievement.progressLabel}
                      </FitText>
                      <FitText
                        style={[
                          styles.progressMeta,
                          {
                            color: achievement.isUnlocked
                              ? colors.brand
                              : colors.textMuted,
                          },
                        ]}
                      >
                        {achievement.statusLabel}
                      </FitText>
                    </View>
                    {!achievement.isUnlocked ? (
                      <View
                        style={{
                          backgroundColor: colors.border,
                          borderRadius: 999,
                          height: 5,
                          overflow: "hidden",
                        }}
                      >
                        <View
                          style={{
                            backgroundColor: colors.brand,
                            height: 5,
                            width: `${achievement.progressPercent * 100}%`,
                          }}
                        />
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <FitText style={styles.sectionMessage}>
                Milestone-backed achievement cards will appear after the
                progression backbone publishes your first goals.
              </FitText>
            )}
          </FitSection>
        </>
      )}
    </>
  );
}
