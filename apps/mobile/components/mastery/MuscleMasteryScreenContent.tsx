import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Bot, Dumbbell, RefreshCw, Sparkles, Target } from "lucide-react-native";
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
      gap: 6
    },
    achievementDescription: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18
    },
    achievementGrid: {
      gap: 10
    },
    achievementTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600"
    },
    actionGrid: {
      gap: 10
    },
    emptyMessage: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20
    },
    heroCard: {
      borderRadius: R.xl,
      padding: 18,
      gap: 16
    },
    heroEyebrow: {
      color: colors.onBrand ?? "#FFFFFF",
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1.1
    },
    heroMetaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8
    },
    heroMetaPill: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 6
    },
    heroMetaText: {
      fontSize: 12,
      fontWeight: "600"
    },
    heroSubtitle: {
      color: colors.onBrand ?? "#FFFFFF",
      fontSize: 14,
      lineHeight: 20,
      opacity: 0.92
    },
    heroTitle: {
      color: colors.onBrand ?? "#FFFFFF",
      fontSize: 24,
      fontWeight: "700",
      lineHeight: 30
    },
    leaderboardAvatar: {
      alignItems: "center",
      borderRadius: 16,
      height: 40,
      justifyContent: "center",
      width: 40
    },
    leaderboardAvatarText: {
      fontSize: 13,
      fontWeight: "700"
    },
    leaderboardMeta: {
      alignItems: "flex-end",
      gap: 2
    },
    leaderboardName: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600"
    },
    leaderboardRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      paddingVertical: 10
    },
    leaderboardSubtitle: {
      color: colors.textMuted,
      fontSize: 12
    },
    leaderboardXp: {
      color: colors.brand,
      fontSize: 13,
      fontWeight: "700"
    },
    masteryList: {
      gap: 10
    },
    sectionMessage: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20
    },
    separator: {
      height: 1,
      marginVertical: 4
    },
    statGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10
    },
    statTile: {
      flexBasis: "47%"
    }
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

export default function MuscleMasteryScreenContent({
  controller
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
              { borderColor: (colors.onBrand ?? "#FFFFFF") + "44" }
            ]}
          >
            <FitText style={styles.heroMetaText}>
              {controller.leaderboardEntry
                ? `Gym Rank #${controller.leaderboardEntry.rankPosition}`
                : "Leaderboard warming up"}
            </FitText>
          </View>
          <View
            style={[
              styles.heroMetaPill,
              { borderColor: (colors.onBrand ?? "#FFFFFF") + "44" }
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
          {controller.topMuscle
            ? `${controller.topMuscle.rankDisplay} momentum is building`
            : "Build your first mastery streak"}
        </FitText>
        <FitText style={styles.heroSubtitle}>
          {controller.topMuscle
            ? `${controller.topMuscle.muscleGroup} has ${controller.topMuscle.xpPoints.toLocaleString("en-US")} EXP and ${controller.totalVolumeKg.toLocaleString("en-US")} kg total tracked volume across your board.`
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
            Loading mastery progress and leaderboard movement...
          </FitText>
        </FitSection>
      ) : controller.isError ? (
        <FitSection heading="Overview">
          <FitText style={styles.sectionMessage}>{controller.errorMessage}</FitText>
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
            No mastery progress is on this account yet. Finish a tracked workout to start earning EXP, muscle ranks, and leaderboard movement.
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
          <FitSection heading="Snapshot">
            <View style={styles.statGrid}>
              {controller.summaryCards.map((item) => (
                <View key={item.id} style={styles.statTile}>
                  <FitCard label={item.label} statValue={item.value} />
                </View>
              ))}
            </View>
          </FitSection>

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
            <View>
              {controller.leaderboard.map((entry, index) => (
                <View key={`${entry.userId}-${entry.rankPosition}`}>
                  <View style={styles.leaderboardRow}>
                    <View
                      style={[
                        styles.leaderboardAvatar,
                        { backgroundColor: colors.brand + "18" }
                      ]}
                    >
                      <FitText style={[styles.leaderboardAvatarText, { color: colors.brand }]}>
                        {getInitials(entry.displayName)}
                      </FitText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <FitText style={styles.leaderboardName}>{entry.displayName}</FitText>
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
                      style={[styles.separator, { backgroundColor: colors.border }]}
                    />
                  ) : null}
                </View>
              ))}
            </View>
          </FitSection>

          <FitSection heading="Achievements">
            <View style={styles.achievementGrid}>
              {controller.achievements.map((achievement) => (
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
                        : colors.border
                    }
                  ]}
                >
                  <FitText style={styles.achievementTitle}>{achievement.label}</FitText>
                  <FitText style={styles.achievementDescription}>
                    {achievement.description}
                  </FitText>
                  <FitText
                    style={{
                      color: achievement.isUnlocked ? colors.brand : colors.textMuted,
                      fontSize: 12,
                      fontWeight: "700"
                    }}
                  >
                    {achievement.isUnlocked ? "Unlocked" : "In progress"}
                  </FitText>
                </View>
              ))}
            </View>
          </FitSection>
        </>
      )}
    </>
  );
}
