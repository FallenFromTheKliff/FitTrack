import { View } from "react-native";
import {
  Award,
  CreditCard,
  Dumbbell,
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
  controller: ProfileScreenController;
  styles: ReturnType<typeof makeProfileStyles>;
};

function getRankingPrivacyIcon(value: FitnessRankingVisibility) {
  if (value === "anonymous") return UserRound;
  if (value === "private") return EyeOff;
  return Eye;
}

export default function MemberProfileSections({ controller, styles }: MemberProfileSectionsProps) {
  const canShowGamification = controller.hasMemberCardAccess;
  const membershipCardActionSubtitle = controller.memberAccessLabel === "Pending verification"
    ? "Your membership card request is already pending verification. QR attendance and member-only app features unlock as soon as staff confirms it."
    : controller.memberAccessLabel === "Revoked"
      ? "Your membership access is revoked. Ask the front desk to restore it; the one-time card payment stays on record and does not need to be paid again."
      : `Permanent ${controller.membershipCardPriceLabel} membership card. Buy once to unlock member-only app access.`;
  const gamificationMessage = controller.memberAccessLabel === "Pending verification"
    ? "Your membership card is waiting for verification. Fitness progress, badges, and achievement history unlock as soon as the card becomes active."
    : `${controller.memberAccessSummary} Fitness progress, badges, and achievement history unlock once this account has an active membership card.`;
  const onlinePurchaseLabel = controller.isMembershipCardPurchasePending && controller.membershipCardPurchaseProvider === "paymongo"
    ? "Starting..."
    : "Pay Online";
  const cashPurchaseLabel = controller.isMembershipCardPurchasePending && controller.membershipCardPurchaseProvider === "cash"
    ? "Requesting..."
    : "Pay in Cash";

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
              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <FitButton
                  label="Open Muscle Mastery"
                  icon={Trophy}
                  variant="primary"
                  onPress={controller.onOpenMastery}
                  flex={1}
                />
                <FitButton
                  label="Open Workout"
                  icon={Dumbbell}
                  variant="ghost"
                  onPress={controller.onOpenWorkout}
                  flex={1}
                />
              </View>
            </>
          )}
        </FitSection>
      ) : (
        <FitSection heading="Fitness Progress">
          <PremiumFeatureGate
            icon={Trophy}
            eyebrow="MEMBERSHIP CARD REQUIRED"
            statusLabel={controller.memberAccessLabel}
            title={controller.memberAccessLabel === "Pending verification" ? "Membership card verification in progress" : "Stats, badges, and achievements stay locked"}
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
          label="Member Access"
          subtitle={controller.memberAccessSummary}
          trailingLabel={controller.memberAccessLabel}
          trailingLabelColor={controller.memberAccessColor}
          noChevron
        />
        <FitCard
          icon={ScanLine}
          label="Attendance QR"
          subtitle={controller.qrCodeSubtitle}
          trailingLabel={controller.qrCodeStatusLabel}
          trailingLabelColor={controller.qrCodeStatusColor}
          onPress={controller.handleOpenAttendanceQr}
        />
        {!controller.hasMemberCardAccess ? (
          <>
            <FitCard
              icon={CreditCard}
              label="Membership Card Purchase"
              subtitle={membershipCardActionSubtitle}
              trailingLabel={controller.canPurchaseMembershipCard ? controller.membershipCardPriceLabel : undefined}
              trailingLabelColor={controller.canPurchaseMembershipCard ? controller.memberAccessColor : undefined}
              noChevron
            />
            {controller.canPurchaseMembershipCard ? (
              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <FitButton
                  label={onlinePurchaseLabel}
                  variant="primary"
                  onPress={() => controller.handlePurchaseMembershipCard("paymongo")}
                  disabled={controller.isMembershipCardPurchasePending}
                  flex={1}
                />
                <FitButton
                  label={cashPurchaseLabel}
                  variant="ghost"
                  onPress={() => controller.handlePurchaseMembershipCard("cash")}
                  disabled={controller.isMembershipCardPurchasePending}
                  flex={1}
                />
              </View>
            ) : (
              <FitText style={{ fontSize: 12, lineHeight: 18, opacity: 0.78, marginTop: 12 }}>
                {controller.memberAccessLabel === "Revoked"
                  ? "This card was already purchased. Staff can restore membership access from the Account Module; no new payment is required."
                  : "Member-card purchase actions stay paused while this account is already waiting for verification."}
              </FitText>
            )}
          </>
        ) : null}
      </FitSection>
    </>
  );
}
