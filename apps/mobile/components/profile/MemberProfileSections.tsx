import { View } from "react-native";
import {
  Award,
  CreditCard,
  Eye,
  EyeOff,
  HeartPulse,
  RefreshCw,
  ScanLine,
  Trophy,
  UserCog,
  UserRound
} from "lucide-react-native";

import { makeProfileStyles } from "@/styles/shared/ScreenStyles";
import { FitButton, FitCard, FitSection, FitText } from "@/components/fit";
import PremiumFeatureGate from "@/components/membership/PremiumFeatureGate";
import { type ProfileScreenController } from "@/hooks/profile/useProfileScreen";
import type { FitnessRankingVisibility } from "@fittrack/types";

type MemberProfileSectionsProps = {
  colors: {
    brand: string;
  };
  controller: ProfileScreenController;
  styles: ReturnType<typeof makeProfileStyles>;
};

function getRankingPrivacyIcon(value: FitnessRankingVisibility) {
  if (value === "anonymous") return UserRound;
  if (value === "private") return EyeOff;
  return Eye;
}

export default function MemberProfileSections({ colors, controller, styles }: MemberProfileSectionsProps) {
  const canShowGamification = controller.hasMemberCardAccess;
  const gamificationMessage = `${controller.memberAccessSummary} Fitness progress, badges, and achievement history unlock once this account has an active membership card.`;

  return (
    <>
      {canShowGamification ? (
        <FitSection heading="Fitness Summary">
          {controller.profileFitnessLoading ? (
            <FitText style={{ fontSize: 12, lineHeight: 18, opacity: 0.78 }}>
              Loading your live mastery summary...
            </FitText>
          ) : controller.profileFitnessError ? (
            <>
              <FitText style={{ fontSize: 12, lineHeight: 18, opacity: 0.78 }}>
                {controller.profileFitnessError}
              </FitText>
              <FitButton
                label="Retry Fitness Summary"
                icon={RefreshCw}
                onPress={() => void controller.onRefreshFitnessSummary()}
                variant="ghost"
                style={{ marginTop: 12 }}
              />
            </>
          ) : (
            <>
              <View style={styles.statsRow}>
                {controller.fitnessSummaryCards.map((item, index) => (
                  <View key={item.id} style={{ flex: 1, flexDirection: "row", alignItems: "stretch" }}>
                    <FitCard label={item.label} statValue={item.value} noChevron />
                    {index < controller.fitnessSummaryCards.length - 1 ? <View style={styles.statDivider} /> : null}
                  </View>
                ))}
              </View>
              <View style={{ marginTop: 14 }}>
                <FitCard
                  icon={Award}
                  label="Current Badge"
                  subtitle={controller.fitnessSummaryBadgeDetail}
                  trailingLabel={controller.fitnessSummaryBadge}
                  hasBorder
                  onPress={controller.onOpenMastery}
                />
                <FitCard
                  icon={Trophy}
                  label="Gym Standing"
                  subtitle={controller.fitnessSummaryRankDetail}
                  trailingLabel={controller.fitnessSummaryRank}
                  hasBorder
                  onPress={controller.onOpenMastery}
                />
                <FitCard
                  icon={HeartPulse}
                  label="Health Snapshot"
                  subtitle={controller.fitnessSummaryHealthDetail}
                  trailingLabel={controller.fitnessSummaryHealth}
                  noChevron
                />
              </View>
              <FitText style={styles.fitnessSummaryHint}>
                Open Muscle Mastery or Workout anytime to improve these stats.
              </FitText>
            </>
          )}
        </FitSection>
      ) : (
        <FitSection heading="Fitness Progress">
          <PremiumFeatureGate
            icon={Trophy}
            eyebrow="MEMBERSHIP CARD REQUIRED"
            statusLabel={controller.memberAccessLabel}
            title="Stats, badges, and achievements stay locked"
            message={gamificationMessage}
          />
        </FitSection>
      )}
      {canShowGamification ? (
        <FitSection heading="Ranking Privacy">
          {controller.rankingPrivacyOptions.map((option) => (
            <FitCard
              key={option.value}
              icon={getRankingPrivacyIcon(option.value)}
              label={option.label}
              subtitle={option.description}
              trailingLabel={option.isSelected ? "Active" : undefined}
              trailingLabelColor={option.isSelected ? controller.memberAccessColor : undefined}
              hasBorder
              selected={option.isSelected}
              selectedIndicatorColor={option.isSelected ? colors.brand : undefined}
              onPress={
                option.isSelected || controller.isRankingPrivacySaving
                  ? undefined
                  : () => controller.setRankingPrivacyTarget(option.value)
              }
            />
          ))}
          {controller.rankingPrivacyError ? (
            <FitText style={{ fontSize: 12, lineHeight: 18, opacity: 0.78, marginTop: 10 }}>
              {controller.rankingPrivacyError}
            </FitText>
          ) : null}
        </FitSection>
      ) : null}
      <FitSection heading="ACCOUNT">
        <FitCard
          icon={UserCog}
          label="Edit Profile"
          subtitle="Update your name, phone, and avatar"
          hasBorder
          onPress={() => controller.setEditVisible(true)}
        />
        <FitCard
          icon={CreditCard}
          label="Membership Access"
          subtitle={controller.memberAccessSummary}
          trailingLabel={controller.memberAccessLabel}
          trailingLabelColor={controller.memberAccessColor}
          onPress={() => controller.setMembershipAccessVisible(true)}
        />
        <FitCard
          icon={ScanLine}
          label="Attendance QR"
          subtitle={controller.qrCodeSubtitle}
          trailingLabel={controller.qrCodeStatusLabel}
          trailingLabelColor={controller.qrCodeStatusColor}
          onPress={controller.handleOpenAttendanceQr}
        />
      </FitSection>
    </>
  );
}
