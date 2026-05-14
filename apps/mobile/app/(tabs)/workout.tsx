import { useMemo } from "react";
import { View } from "react-native";
import { Dumbbell } from "lucide-react-native";
import { useRouter } from "expo-router";

import PremiumFeatureGate from "@/components/membership/PremiumFeatureGate";
import { WorkoutLiveScreen } from "@/components/workout/WorkoutLiveScreen";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { makeScreenStyles } from "@/styles/shared/ScreenStyles";

export default function WorkoutsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const base = useMemo(() => makeScreenStyles(colors), [colors]);
  const isMember = user?.role === "USER";
  const membershipCardStatus = user?.membershipCard?.status ?? "none";
  const hasMemberCardAccess = user?.membershipAccess === "member";
  const isWorkoutLocked = isMember && !hasMemberCardAccess;
  const gateEyebrow = membershipCardStatus === "pending_verification"
    ? "VERIFICATION PENDING"
    : membershipCardStatus === "revoked"
      ? "MEMBER ACCESS LOCKED"
      : "MEMBERSHIP CARD REQUIRED";
  const gateStatusLabel = membershipCardStatus === "pending_verification"
    ? "Pending verification"
    : membershipCardStatus === "revoked"
      ? "Revoked"
      : "Non-member";
  const gateTitle = membershipCardStatus === "pending_verification"
    ? "Workout access is pending verification"
    : membershipCardStatus === "revoked"
      ? "Workout access is currently unavailable"
      : "Workout access requires a membership card";
  const gateMessage = membershipCardStatus === "pending_verification"
    ? "Your membership card payment is waiting for verification. Live workout tracking, auto reps, and pose guidance unlock as soon as staff confirms it."
    : membershipCardStatus === "revoked"
      ? "Your membership card access is revoked right now. Ask the front desk to repair the account if this looks incorrect, or buy a new card from Profile."
      : "Live workout tracking, auto reps, and pose guidance unlock once this account has an active membership card. Buy the permanent membership card from Profile, then load plans whenever you want.";

  if (isWorkoutLocked) {
    return (
      <View style={base.screen}>
        <View style={base.scrollContent}>
          <PremiumFeatureGate
            actionLabel="Open Membership Details"
            eyebrow={gateEyebrow}
            icon={Dumbbell}
            onActionPress={() => router.push("/(tabs)/profile")}
            statusLabel={gateStatusLabel}
            title={gateTitle}
            message={gateMessage}
          />
        </View>
      </View>
    );
  }

  return <WorkoutLiveScreen />;
}
