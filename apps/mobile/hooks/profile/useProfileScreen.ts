import { AppState, Clipboard, Linking, Platform } from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mapProfileToAuthUser } from "@fittrack/app-core";
import { useTimedMessage } from "@fittrack/hooks";

import type {
  AttendanceQrCodeRecord,
  CoachAvailabilityRecord,
  CoachProfileRecord,
  MembershipCardStatus,
  MuscleMasteryRecord,
  FitnessRankingVisibility
} from "@fittrack/types";
import type { CommerceCheckoutAttempt } from "@fittrack/api-client";
import {
  queryKeys,
  attendanceQrQueryOptions,
  cancelDeletionRequestMutationOptions,
  coachSelfProfileQueryOptions,
  createCoachAvailabilityMutationOptions,
  deleteCoachAvailabilityMutationOptions,
  fitnessLeaderboardQueryOptions,
  fitnessMasteryQueryOptions,
  fitnessRankingProfileQueryOptions,
  membershipCatalogSettingsQueryOptions,
  purchaseMembershipCardMutationOptions,
  profileDeletionStatusQueryOptions,
  refreshAttendanceQrMutationOptions,
  requestDeletionMutationOptions,
  setProfileDeletionStatusQueryData,
  updateFitnessRankingProfileMutationOptions,
  updateCoachAvailabilityMutationOptions
} from "@fittrack/query";
import { ApiClientError } from "@fittrack/api-client";
import { coachAvailabilitySchema } from "@fittrack/validators";
import { to12HourLabel, to24HourValue } from "@fittrack/utils";

import { TIME_SLOTS } from "@/data/bookings";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { mobileApiClient } from "@/lib/api-client";
import type { TimeSlot } from "@/components/modals";
import {
  createCommerceAttemptIdempotencyKey,
  useCommerceCheckoutReturn,
} from "@/hooks/commerce/useCommerceCheckoutReturn";

export type AvailabilityDraft = {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type ProfileFitnessSummaryCard = {
  id: string;
  label: string;
  value: string;
};

type RankingPrivacyOption = {
  description: string;
  isSelected: boolean;
  label: string;
  value: FitnessRankingVisibility;
};

const RANKING_PRIVACY_OPTIONS: Array<Omit<RankingPrivacyOption, "isSelected">> = [
  {
    value: "public",
    label: "Public",
    description: "Show your profile name on ranked member surfaces."
  },
  {
    value: "anonymous",
    label: "Anonymous",
    description: "Stay ranked while masking your member identity."
  },
  {
    value: "private",
    label: "Private",
    description: "Hide your visible ranking while keeping progression history."
  }
];

export const WEEKDAY_OPTIONS = [
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

function formatRankingVisibility(value: FitnessRankingVisibility) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getInitialAvailabilityDraft(slot?: CoachAvailabilityRecord): AvailabilityDraft {
  if (!slot) {
    return { dayOfWeek: 1, startTime: "", endTime: "" };
  }
  return {
    id: slot.id,
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime
  };
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    notation: value >= 1000 ? "compact" : "standard"
  }).format(value);
}

function resolveHighestRank(mastery: MuscleMasteryRecord[]) {
  const rankPriority: Record<MuscleMasteryRecord["rank"], number> = {
    adamantite: 5,
    platinum: 4,
    gold: 3,
    silver: 2,
    bronze: 1
  };

  return mastery.reduce<MuscleMasteryRecord | null>((current, entry) => {
    if (!current) return entry;
    const entryPriority = rankPriority[entry.rank] ?? 0;
    const currentPriority = rankPriority[current.rank] ?? 0;
    if (entryPriority !== currentPriority) {
      return entryPriority > currentPriority ? entry : current;
    }
    return entry.xpPoints > current.xpPoints ? entry : current;
  }, null);
}

function resolveBmi(weightKg?: number, heightCm?: number) {
  if (!weightKg || !heightCm || heightCm <= 0) {
    return null;
  }

  const heightMeters = heightCm / 100;
  if (heightMeters <= 0) return null;

  return weightKg / (heightMeters * heightMeters);
}

function resolveBmiLabel(bmi: number | null) {
  if (bmi === null) return "Complete profile";
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Healthy";
  if (bmi < 30) return "Above range";
  return "High";
}

function formatAttendanceQrCountdown(remainingMs: number) {
  if (remainingMs <= 0) return "Refreshing...";

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0
      ? `${days}d ${hours}h remaining`
      : `${days}d remaining`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }

  const displayMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${displayMinutes}:${seconds.toString().padStart(2, "0")} remaining`;
}

function formatShortCountdown(remainingMs: number) {
  if (remainingMs <= 0) return "0:00";

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  const displayMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${displayMinutes}:${seconds.toString().padStart(2, "0")}`;
}

function getFutureRemainingMs(isoString?: string | null) {
  if (!isoString) return 0;

  const timestamp = new Date(isoString).getTime();
  if (Number.isNaN(timestamp)) return 0;
  return Math.max(0, timestamp - Date.now());
}

type MembershipPaymentConfirmation = {
  message: string;
  title: string;
};

const MEMBERSHIP_CHECKOUT_ATTEMPT_STORAGE_KEY =
  "fittrack.mobile.membership-card-checkout.v1";

function normalizeSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function useProfileScreen() {
  const router = useRouter();
  const { checkout_result: checkoutResultParam, hold_id: holdIdParam } =
    useLocalSearchParams<{
      checkout_result?: string | string[];
      hold_id?: string | string[];
    }>();
  const { user, updateUser } = useAuth();
  const { colors, resetAppearance } = useTheme();
  const isFocused = useIsFocused();
  const queryClient = useQueryClient();
  const isMounted = useRef(true);
  const { message: statusMessage, showMessage } = useTimedMessage(2400);
  const isCoach = user?.role === "COACH";
  const isMember = user?.role === "USER";
  const membershipCard = user?.membershipCard ?? null;
  const membershipCardStatus = membershipCard?.status ?? "none";
  const hasMemberCardAccess =
    membershipCardStatus === "active" || user?.membershipAccess === "member";

  const [terminateVisible, setTerminateVisible] = useState(false);
  const [cancelVisible, setCancelVisible] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [attendanceQrVisible, setAttendanceQrVisible] = useState(false);
  const [attendanceQrCountdownMs, setAttendanceQrCountdownMs] = useState(0);
  const [attendanceQrRefreshCooldownMs, setAttendanceQrRefreshCooldownMs] = useState(0);
  const [isAvailabilityEditorOpen, setIsAvailabilityEditorOpen] = useState(false);
  const [availabilityDraft, setAvailabilityDraft] = useState<AvailabilityDraft>(getInitialAvailabilityDraft());
  const [availabilityDeleteTarget, setAvailabilityDeleteTarget] = useState<CoachAvailabilityRecord | null>(null);
  const [isAvailabilitySaving, setIsAvailabilitySaving] = useState(false);
  const [isAvailabilityDeleting, setIsAvailabilityDeleting] = useState(false);
  const [isAvailabilityTimeOpen, setIsAvailabilityTimeOpen] = useState(false);
  const [availabilityTimeTarget, setAvailabilityTimeTarget] = useState<"start" | "end">("start");
  const [membershipPaymentConfirmation, setMembershipPaymentConfirmation] =
    useState<MembershipPaymentConfirmation | null>(null);
  const [membershipPurchaseConfirmVisible, setMembershipPurchaseConfirmVisible] =
    useState(false);
  const [membershipCardPurchaseProvider, setMembershipCardPurchaseProvider] = useState<"paymongo" | null>(null);
  const membershipAttemptIdempotencyKeyRef = useRef<string | null>(null);
  const membershipPurchaseInFlightRef = useRef(false);
  const membershipReconcileInFlightRef = useRef(false);
  const handledMembershipReturnHoldIdRef = useRef<string | null>(null);
  const [rankingPrivacyTarget, setRankingPrivacyTarget] = useState<FitnessRankingVisibility | null>(null);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const { data: deletionStatus = "none" } = useQuery({
    ...profileDeletionStatusQueryOptions(mobileApiClient, user?.id),
    enabled: !!user?.id && isMember,
    staleTime: 60_000,
    gcTime: 300_000
  });
  const { data: coachProfile = null } = useQuery({
    ...coachSelfProfileQueryOptions<CoachProfileRecord>(mobileApiClient, user?.id),
    enabled: !!user?.id && isCoach,
    staleTime: 60_000,
    gcTime: 300_000
  });
  const { data: membershipCatalogSettings = null } = useQuery({
    ...membershipCatalogSettingsQueryOptions(mobileApiClient),
    staleTime: 60_000,
    gcTime: 300_000,
  });
  const masteryQuery = useQuery({
    ...fitnessMasteryQueryOptions(mobileApiClient, user?.id),
    enabled: !!user?.id && isMember && hasMemberCardAccess && isFocused,
    staleTime: 60_000,
    gcTime: 300_000
  });
  const leaderboardQuery = useQuery({
    ...fitnessLeaderboardQueryOptions(mobileApiClient, user?.id, { limit: 5, page: 1 }),
    enabled: !!user?.id && isMember && hasMemberCardAccess && isFocused,
    staleTime: 60_000,
    gcTime: 300_000
  });
  const rankingProfileQuery = useQuery({
    ...fitnessRankingProfileQueryOptions(mobileApiClient, user?.id),
    enabled: !!user?.id && isMember && hasMemberCardAccess && isFocused,
    staleTime: 60_000,
    gcTime: 300_000
  });
  const attendanceQrQuery = useQuery({
    ...attendanceQrQueryOptions(mobileApiClient, user?.id),
    enabled: !!user?.id && isMember && isFocused,
  });
  const refetchAttendanceQr = attendanceQrQuery.refetch;

  const requestDeletionMutation = useMutation(requestDeletionMutationOptions(mobileApiClient, queryClient));
  const cancelDeletionMutation = useMutation(cancelDeletionRequestMutationOptions(mobileApiClient, queryClient));
  const refreshAttendanceQrMutation = useMutation(
    refreshAttendanceQrMutationOptions(mobileApiClient, queryClient)
  );
  const createAvailabilityMutation = useMutation(createCoachAvailabilityMutationOptions(mobileApiClient, queryClient));
  const updateAvailabilityMutation = useMutation(updateCoachAvailabilityMutationOptions(mobileApiClient, queryClient));
  const deleteAvailabilityMutation = useMutation(deleteCoachAvailabilityMutationOptions(mobileApiClient, queryClient));
  const purchaseMembershipCardMutation = useMutation(
    purchaseMembershipCardMutationOptions(mobileApiClient, queryClient)
  );
  const updateRankingProfileMutation = useMutation(
    updateFitnessRankingProfileMutationOptions(mobileApiClient, queryClient)
  );

  const isFrozen = user?.status === "frozen";
  const hasPendingTermination = deletionStatus === "pending" || isFrozen;
  const initials = user?.avatarInitials ?? user?.name?.slice(0, 2).toUpperCase() ?? "FT";
  const avatarUri = user?.avatarUri;
  const memberSince = user?.memberSince
    ? `Member since ${new Date(user.memberSince).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
    : "";
  const canPurchaseMembershipCard = isMember && membershipCardStatus === "none";
  const memberAccessLabel = membershipCardStatus === "revoked"
      ? "Revoked"
      : hasMemberCardAccess
        ? "Member"
        : "Non-member";
  const memberAccessColor = membershipCardStatus === "revoked"
      ? colors.danger
      : hasMemberCardAccess
        ? colors.success
        : colors.textMuted;
  const memberAccessSummary = useMemo(() => {
    switch (membershipCardStatus as MembershipCardStatus) {
      case "active":
        return "Your membership card is active. Member-only app features are unlocked on this account.";
      case "revoked":
        return "Your membership card access is currently revoked. Ask the front desk to restore access; your one-time card payment stays on record.";
      default:
        return "No active membership card is linked to this account yet.";
    }
  }, [membershipCardStatus]);
  const attendanceQrReady = Boolean(
    attendanceQrQuery.data?.ready && attendanceQrQuery.data?.qrValue,
  );
  const attendanceQrReason =
    attendanceQrQuery.data?.reason ??
    (attendanceQrQuery.error instanceof Error
      ? attendanceQrQuery.error.message
      : null);
  const qrCodeStatusLabel = attendanceQrReady
    ? "Ready"
    : attendanceQrQuery.isFetching
      ? "Loading"
      : attendanceQrReason
        ? "Unavailable"
        : "Available";
  const qrCodeStatusColor = attendanceQrReady
    ? colors.success
    : attendanceQrReason
      ? colors.warning
      : colors.brand;
  const qrCodeSubtitle = attendanceQrReady
    ? "Open your rotating attendance QR for front-desk check-ins."
    : attendanceQrReason ??
      "Open to generate the live rotating QR used for front-desk check-ins.";
  const attendanceQrCountdownLabel = formatAttendanceQrCountdown(attendanceQrCountdownMs);
  const attendanceQrRefreshLabel = attendanceQrRefreshCooldownMs > 0
    ? `Refresh in ${formatShortCountdown(attendanceQrRefreshCooldownMs)}`
    : "Refresh QR";

  const membershipCardPriceLabel = `PHP ${Number(
    membershipCatalogSettings?.membership_card_price ?? 400,
  ).toLocaleString("en-PH")}`;
  const mastery = useMemo(
    () => [...(masteryQuery.data ?? [])].sort((left, right) => right.xpPoints - left.xpPoints),
    [masteryQuery.data]
  );
  const leaderboard = leaderboardQuery.data?.data ?? [];
  const rankingVisibility = rankingProfileQuery.data?.visibility ?? "public";
  const rankingPrivacyOptions = RANKING_PRIVACY_OPTIONS.map((option) => ({
    ...option,
    isSelected: option.value === rankingVisibility
  }));
  const rankingPrivacyTargetOption =
    RANKING_PRIVACY_OPTIONS.find((option) => option.value === rankingPrivacyTarget) ?? null;
  const rankingPrivacyTargetLabel = rankingPrivacyTarget
    ? formatRankingVisibility(rankingPrivacyTarget)
    : "";
  const rankingPrivacyTargetMessage = rankingPrivacyTargetOption
    ? rankingPrivacyTarget === "private"
      ? `${rankingPrivacyTargetOption.description} Your name and visible standing will be hidden from member-facing leaderboards until you switch it back.`
      : `${rankingPrivacyTargetOption.description} This change affects member-facing leaderboards and ranking cards.`
    : "";
  const topMuscle = mastery[0] ?? null;
  const highestRankEntry = resolveHighestRank(mastery);
  const totalXp = mastery.reduce((sum, entry) => sum + entry.xpPoints, 0);
  const leaderboardEntry = leaderboard.find((entry) => entry.userId === user?.id) ?? null;
  const bmi = resolveBmi(user?.weightKg, user?.heightCm);
  const bmiLabel = resolveBmiLabel(bmi);
  const fitnessSummaryCards: ProfileFitnessSummaryCard[] = [
    { id: "xp", label: "Total EXP", value: formatCompactNumber(totalXp) },
    { id: "muscles", label: "Tracked Muscles", value: String(mastery.length) },
    {
      id: "rank",
      label: "Gym Rank",
      value: leaderboardEntry ? `#${leaderboardEntry.rankPosition}` : "--"
    }
  ];
  const profileFitnessLoading =
    hasMemberCardAccess &&
    (masteryQuery.status === "pending" ||
      leaderboardQuery.status === "pending" ||
      rankingProfileQuery.status === "pending");
  const profileFitnessError =
    (masteryQuery.error as Error | null)?.message ??
    (leaderboardQuery.error as Error | null)?.message ??
    (rankingProfileQuery.error as Error | null)?.message ??
    null;
  const fitnessSummaryBadge = highestRankEntry
    ? `${highestRankEntry.rankDisplay} badge`
    : "First badge pending";
  const fitnessSummaryBadgeDetail = topMuscle
    ? `${topMuscle.muscleGroup} leads with ${topMuscle.xpPoints.toLocaleString("en-US")} EXP.`
    : "Complete a workout to start earning live mastery badges.";
  const fitnessSummaryRank = leaderboardEntry
    ? `Gym Rank #${leaderboardEntry.rankPosition}`
    : "Leaderboard warming up";
  const fitnessSummaryRankDetail = leaderboardEntry
    ? `${totalXp.toLocaleString("en-US")} EXP across ${mastery.length} tracked muscle group${mastery.length === 1 ? "" : "s"}.`
    : "No leaderboard placement yet. Your next tracked sessions will start the climb.";
  const fitnessSummaryHealth = bmi === null ? "BMI unavailable" : `BMI ${bmi.toFixed(1)}`;
  const fitnessSummaryHealthDetail = bmi === null
    ? "Add height and weight in Profile or Nutrition Targets to unlock a health snapshot."
    : `${bmiLabel} | ${user?.weightKg ?? "--"} kg | ${user?.heightCm ?? "--"} cm`;

  const refreshAuthUserFromProfile = useCallback(async () => {
    if (!isMember || !user?.id) return;

    try {
      const profile = await mobileApiClient.users.getProfile();
      await updateUser(mapProfileToAuthUser(profile, user?.status));
    } catch {
      return;
    }
  }, [isMember, updateUser, user?.id, user?.status]);

  const membershipCheckoutReturn = useCommerceCheckoutReturn({
    onSucceeded: async () => {
      membershipAttemptIdempotencyKeyRef.current = null;
      setMembershipCardPurchaseProvider(null);
      await AsyncStorage.removeItem(MEMBERSHIP_CHECKOUT_ATTEMPT_STORAGE_KEY);
      await refreshAuthUserFromProfile();
      showMessage("Membership card activated.");
      setMembershipPaymentConfirmation({
        title: "Membership active",
        message: "Your PayMongo payment was confirmed and your membership card is now active.",
      });
    },
    onTerminal: async (_, state) => {
      membershipAttemptIdempotencyKeyRef.current = null;
      setMembershipCardPurchaseProvider(null);
      await AsyncStorage.removeItem(MEMBERSHIP_CHECKOUT_ATTEMPT_STORAGE_KEY);
      showMessage(
        state === "expired"
          ? "Checkout expired. No membership access was granted."
          : "Checkout was not completed. No membership access was granted.",
      );
    },
  });
  const membershipCheckoutReturnRef = useRef(membershipCheckoutReturn);
  membershipCheckoutReturnRef.current = membershipCheckoutReturn;

  const resumeStoredMembershipCheckout = useCallback(async () => {
    if (!isMember || membershipReconcileInFlightRef.current) return;

    const raw = await AsyncStorage.getItem(MEMBERSHIP_CHECKOUT_ATTEMPT_STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as Partial<CommerceCheckoutAttempt>;
      if (
        parsed.kind !== "membership_card" ||
        parsed.state !== "pending" ||
        typeof parsed.holdId !== "string"
      ) {
        await AsyncStorage.removeItem(MEMBERSHIP_CHECKOUT_ATTEMPT_STORAGE_KEY);
        return;
      }

      const pendingAttempt = parsed as CommerceCheckoutAttempt;
      membershipReconcileInFlightRef.current = true;
      membershipCheckoutReturnRef.current.start(pendingAttempt);
      const next = await mobileApiClient.commerceCheckout.reconcileHold(
        pendingAttempt.holdId,
      );
      if (isMounted.current) membershipCheckoutReturnRef.current.start(next);
    } catch {
      // Keep the stored pending attempt for the next app-active retry.
    } finally {
      membershipReconcileInFlightRef.current = false;
    }
  }, [isMember]);

  useEffect(() => {
    if (!isFocused || !isMember) return;
    void resumeStoredMembershipCheckout();
  }, [isFocused, isMember, resumeStoredMembershipCheckout]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void resumeStoredMembershipCheckout();
    });

    return () => subscription.remove();
  }, [resumeStoredMembershipCheckout]);

  const checkoutResult = normalizeSearchParam(checkoutResultParam);
  const checkoutHoldId = normalizeSearchParam(holdIdParam);

  useEffect(() => {
    if (
      !isFocused ||
      !isMember ||
      !checkoutHoldId ||
      !checkoutResult ||
      handledMembershipReturnHoldIdRef.current === checkoutHoldId
    ) {
      return;
    }

    handledMembershipReturnHoldIdRef.current = checkoutHoldId;
    const clearReturnParams = () => router.replace("/(tabs)/profile");

    if (checkoutResult === "cancel") {
      membershipAttemptIdempotencyKeyRef.current = null;
      setMembershipCardPurchaseProvider(null);
      void AsyncStorage.removeItem(MEMBERSHIP_CHECKOUT_ATTEMPT_STORAGE_KEY);
      membershipCheckoutReturnRef.current.clear();
      clearReturnParams();
      showMessage("Checkout was not completed. No membership access was granted.");
      return;
    }

    if (checkoutResult !== "success") return;

    if (membershipReconcileInFlightRef.current) {
      clearReturnParams();
      return;
    }

    let disposed = false;
    membershipReconcileInFlightRef.current = true;
    void mobileApiClient.commerceCheckout
      .reconcileHold(checkoutHoldId)
      .then((next) => {
        if (disposed) return;
        void AsyncStorage.setItem(
          MEMBERSHIP_CHECKOUT_ATTEMPT_STORAGE_KEY,
          JSON.stringify(next),
        );
        membershipCheckoutReturnRef.current.start(next);
        showMessage("Payment returned. Verifying membership access...");
      })
      .catch(() => {
        if (!disposed) {
          showMessage("Unable to verify this payment yet. FitTrack will retry it when Profile is active.");
        }
      })
      .finally(() => {
        membershipReconcileInFlightRef.current = false;
        if (!disposed) clearReturnParams();
      });

    return () => {
      disposed = true;
    };
  }, [
    checkoutHoldId,
    checkoutResult,
    isFocused,
    isMember,
    router,
    showMessage,
  ]);

  useEffect(() => {
    if (!isFocused || !isMember || !user?.id) return;
    void refreshAuthUserFromProfile();
  }, [isFocused, isMember, refreshAuthUserFromProfile, user?.id]);

  useEffect(() => {
    if (!isFocused || !isMember || !user?.id) return;
    void refetchAttendanceQr();
  }, [isFocused, isMember, refetchAttendanceQr, user?.id]);

  useEffect(() => {
    if (!attendanceQrVisible) {
      setAttendanceQrCountdownMs(0);
      setAttendanceQrRefreshCooldownMs(0);
      return;
    }

    const syncQrTimers = () => {
      setAttendanceQrCountdownMs(getFutureRemainingMs(attendanceQrQuery.data?.expiresAt));
      setAttendanceQrRefreshCooldownMs(
        getFutureRemainingMs(attendanceQrQuery.data?.refreshAvailableAt)
      );
    };

    syncQrTimers();
    const interval = setInterval(syncQrTimers, 1000);
    const expiresAtMs = attendanceQrQuery.data?.expiresAt
      ? new Date(attendanceQrQuery.data.expiresAt).getTime()
      : Number.NaN;
    const timeout = Number.isNaN(expiresAtMs)
      ? null
      : setTimeout(() => {
          void refetchAttendanceQr();
        }, Math.max(250, expiresAtMs - Date.now() + 250));

    return () => {
      clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
  }, [
    attendanceQrQuery.data?.expiresAt,
    attendanceQrQuery.data?.refreshAvailableAt,
    attendanceQrVisible,
    refetchAttendanceQr
  ]);

  const handleOpenAttendanceQr = useCallback(() => {
    setAttendanceQrVisible(true);
    void refetchAttendanceQr();
  }, [refetchAttendanceQr]);

  const handleRefreshAttendanceQr = useCallback(async () => {
    if (!attendanceQrQuery.data?.ready) {
      await refetchAttendanceQr();
      return;
    }

    if (attendanceQrRefreshCooldownMs > 0) {
      showMessage(`Refresh available in ${formatShortCountdown(attendanceQrRefreshCooldownMs)}.`);
      return;
    }

    try {
      await refreshAttendanceQrMutation.mutateAsync({ userId: user?.id });
      showMessage("Attendance QR refreshed.");
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 429) {
        const refreshAvailableAt =
          error.details && typeof error.details === "object" && "refreshAvailableAt" in error.details
            ? (error.details as { refreshAvailableAt?: unknown }).refreshAvailableAt
            : null;

        if (user?.id && typeof refreshAvailableAt === "string" && refreshAvailableAt.trim() !== "") {
          queryClient.setQueryData<AttendanceQrCodeRecord | null>(queryKeys.attendanceQr(user.id), (current) => (
            current && typeof current === "object"
              ? { ...current, refreshAvailableAt }
              : current
          ));
        }
      }

      showMessage(
        error instanceof Error
          ? error.message
          : "Unable to refresh the attendance QR right now."
      );
    }
  }, [
    attendanceQrQuery.data?.ready,
    attendanceQrRefreshCooldownMs,
    queryClient,
    refetchAttendanceQr,
    refreshAttendanceQrMutation,
    showMessage,
    user?.id
  ]);

  const handleCopyAttendanceQrValue = useCallback(async () => {
    const qrValue = attendanceQrQuery.data?.qrValue?.trim() ?? "";
    if (!qrValue) {
      showMessage(attendanceQrQuery.data?.reason ?? "Attendance QR is unavailable right now.");
      return;
    }

    try {
      if (Platform.OS === "web") {
        const webClipboard =
          typeof globalThis !== "undefined"
            ? (globalThis as { navigator?: { clipboard?: { writeText?: (value: string) => Promise<void> } } })
              .navigator?.clipboard
            : undefined;

        if (webClipboard && typeof webClipboard.writeText === "function") {
          await webClipboard.writeText(qrValue);
          showMessage("Attendance QR value copied.");
          return;
        }

        const webDocument =
          typeof globalThis !== "undefined"
            ? (globalThis as { document?: Document }).document
            : undefined;

        if (!webDocument?.body) {
          throw new Error("Clipboard unavailable");
        }

        const textarea = webDocument.createElement("textarea");
        textarea.value = qrValue;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        textarea.style.pointerEvents = "none";
        textarea.style.top = "-9999px";
        webDocument.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        const copied = webDocument.execCommand?.("copy");
        webDocument.body.removeChild(textarea);

        if (!copied) {
          throw new Error("Clipboard unavailable");
        }

        showMessage("Attendance QR value copied.");
        return;
      }

      Clipboard.setString(qrValue);
      showMessage("Attendance QR value copied.");
    } catch {
      showMessage("Unable to copy the attendance QR value right now.");
    }
  }, [attendanceQrQuery.data?.qrValue, attendanceQrQuery.data?.reason, showMessage]);

  const handlePurchaseMembershipCard = useCallback(async () => {
    if (
      !user?.id ||
      !isMember ||
      purchaseMembershipCardMutation.isPending ||
      membershipPurchaseInFlightRef.current
    ) return;

    membershipPurchaseInFlightRef.current = true;
    setMembershipCardPurchaseProvider("paymongo");
    const idempotencyKey =
      membershipAttemptIdempotencyKeyRef.current ??
      createCommerceAttemptIdempotencyKey();
    membershipAttemptIdempotencyKeyRef.current = idempotencyKey;

    let checkoutAttemptPersisted = false;
    let checkoutOpened = false;
    try {
      const result = await purchaseMembershipCardMutation.mutateAsync({
        payload: {
          provider: "paymongo",
          idempotencyKey,
          returnTarget: "mobile",
        },
        userId: user.id
      });
      const checkoutUrl = result.checkoutUrl?.trim();
      if (!checkoutUrl) {
        throw new Error("PayMongo did not return a checkout link. No membership access was granted.");
      }

      await AsyncStorage.setItem(
        MEMBERSHIP_CHECKOUT_ATTEMPT_STORAGE_KEY,
        JSON.stringify(result),
      );
      checkoutAttemptPersisted = true;
      membershipCheckoutReturn.start(result);
      setMembershipPurchaseConfirmVisible(false);
      await Linking.openURL(checkoutUrl);
      checkoutOpened = true;
      showMessage("PayMongo checkout opened.");
    } catch (error: unknown) {
      if (!checkoutAttemptPersisted) {
        membershipAttemptIdempotencyKeyRef.current = null;
      }
      showMessage(
        checkoutAttemptPersisted
          ? "PayMongo could not open. Your checkout is saved; reopen Membership Card Purchase to retry it."
          : error instanceof Error
          ? error.message
          : "Unable to open PayMongo checkout. No membership access was granted."
      );
    } finally {
      membershipPurchaseInFlightRef.current = false;
      if (isMounted.current && !checkoutOpened) {
        setMembershipCardPurchaseProvider(null);
      }
    }
  }, [
    isMember,
    membershipCheckoutReturn,
    purchaseMembershipCardMutation,
    showMessage,
    user?.id
  ]);

  const handleConfirmRankingPrivacy = useCallback(async () => {
    if (!rankingPrivacyTarget || !user?.id || updateRankingProfileMutation.isPending) return;

    if (rankingPrivacyTarget === rankingVisibility) {
      setRankingPrivacyTarget(null);
      return;
    }

    try {
      await updateRankingProfileMutation.mutateAsync({
        input: { visibility: rankingPrivacyTarget },
        userId: user.id
      });
      showMessage(`Ranking visibility set to ${formatRankingVisibility(rankingPrivacyTarget)}.`);
      setRankingPrivacyTarget(null);
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Unable to update ranking privacy right now."
      );
    }
  }, [
    rankingPrivacyTarget,
    rankingVisibility,
    showMessage,
    updateRankingProfileMutation,
    user?.id
  ]);

  const handleRequestTermination = async () => {
    if (isTerminating) return;
    setIsTerminating(true);
    try {
      await requestDeletionMutation.mutateAsync({
        reason: "Requested via mobile app.",
        userId: user?.id
      });
      await updateUser({ status: "frozen" });
      if (!isMounted.current) return;
      resetAppearance();
      setProfileDeletionStatusQueryData(queryClient, user?.id, "pending");
      setTerminateVisible(false);
    } catch {
      return;
    } finally {
      if (isMounted.current) setIsTerminating(false);
    }
  };

  const handleCancelTermination = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      await cancelDeletionMutation.mutateAsync({ userId: user?.id });
      await updateUser({ status: "active" });
      if (!isMounted.current) return;
      setProfileDeletionStatusQueryData(queryClient, user?.id, "none");
      setCancelVisible(false);
    } catch {
      return;
    } finally {
      if (isMounted.current) setIsCancelling(false);
    }
  };

  const handleStartAvailabilityEditor = (slot?: CoachAvailabilityRecord) => {
    if (coachProfile?.scheduleType === "full_time") return;
    setAvailabilityDraft(getInitialAvailabilityDraft(slot));
    setAvailabilityDeleteTarget(null);
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
    if (coachProfile.scheduleType === "full_time") return;
    const parsed = coachAvailabilitySchema.safeParse({
      dayOfWeek: availabilityDraft.dayOfWeek,
      startTime: availabilityDraft.startTime,
      endTime: availabilityDraft.endTime,
      isAvailable: true
    });
    if (!parsed.success) return;

    setIsAvailabilitySaving(true);
    try {
      if (availabilityDraft.id) {
        await updateAvailabilityMutation.mutateAsync({
          id: availabilityDraft.id,
          payload: {
            startTime: parsed.data.startTime,
            endTime: parsed.data.endTime
          },
          userId: user?.id,
          coachId: coachProfile.id
        });
      } else {
        await createAvailabilityMutation.mutateAsync({
          payload: {
            dayOfWeek: parsed.data.dayOfWeek,
            startTime: parsed.data.startTime,
            endTime: parsed.data.endTime
          },
          userId: user?.id,
          coachId: coachProfile.id
        });
      }
      setIsAvailabilityEditorOpen(false);
    } finally {
      setIsAvailabilitySaving(false);
    }
  };

  const handleDeleteAvailability = async () => {
    if (!availabilityDeleteTarget || !coachProfile) return;
    if (coachProfile.scheduleType === "full_time") return;
    setIsAvailabilityDeleting(true);
    try {
      await deleteAvailabilityMutation.mutateAsync({
        id: availabilityDeleteTarget.id,
        userId: user?.id,
        coachId: coachProfile.id
      });
      setAvailabilityDeleteTarget(null);
      setIsAvailabilityEditorOpen(false);
    } finally {
      setIsAvailabilityDeleting(false);
    }
  };

  return {
    attendanceQrCountdownLabel,
    attendanceQrData: attendanceQrQuery.data ?? null,
    attendanceQrRefreshDisabled:
      refreshAttendanceQrMutation.isPending || (
        Boolean(attendanceQrQuery.data?.ready) && attendanceQrRefreshCooldownMs > 0
      ),
    attendanceQrRefreshLabel,
    attendanceQrVisible,
    availabilityDeleteTarget,
    availabilityDraft,
    availabilityEndSlots: buildEndSlots(availabilityDraft.startTime),
    availabilityLocked: coachProfile?.scheduleType === "full_time",
    availabilitySlots: coachProfile?.availability ?? [],
    availabilityTimeTarget,
    avatarUri,
    cancelVisible,
    coachProfile,
    editVisible,
    hasMemberCardAccess,
    canPurchaseMembershipCard,
    handleAvailabilitySelect,
    handleCancelTermination,
    handleCopyAttendanceQrValue,
    handleDeleteAvailability,
    handleOpenAttendanceQr,
    handlePurchaseMembershipCard,
    handleConfirmRankingPrivacy,
    handleRefreshAttendanceQr,
    handleRequestTermination,
    onRefreshFitnessSummary: async () => {
      await Promise.all([masteryQuery.refetch(), leaderboardQuery.refetch()]);
    },
    handleSaveAvailability,
    handleStartAvailabilityEditor,
    hasPendingTermination,
    initials,
    isAttendanceQrLoading: attendanceQrQuery.isFetching,
    isAvailabilityDeleting,
    isAvailabilityEditorOpen,
    isAvailabilitySaving,
    isAvailabilityTimeOpen,
    isCancelling,
    isCoach,
    isMember,
    isRefreshingAttendanceQr: refreshAttendanceQrMutation.isPending,
    isMembershipCardPurchasePending:
      purchaseMembershipCardMutation.isPending ||
      membershipCardPurchaseProvider === "paymongo",
    membershipPurchaseConfirmVisible,
    isRankingPrivacySaving: updateRankingProfileMutation.isPending,
    isTerminating,
    memberSince,
    memberAccessColor,
    memberAccessLabel,
    memberAccessSummary,
    membershipCardPriceLabel,
    membershipPaymentConfirmation,
    membershipCardPurchaseProvider,
    membershipCard,
    attendanceQrError: (attendanceQrQuery.error as Error | null)?.message ?? null,
    qrCodeStatusColor,
    qrCodeStatusLabel,
    qrCodeSubtitle,
    rankingPrivacyError:
      (updateRankingProfileMutation.error as Error | null)?.message ?? null,
    rankingPrivacyOptions,
    rankingPrivacyTarget,
    rankingPrivacyTargetLabel,
    rankingPrivacyTargetMessage,
    rankingVisibility,
    setAttendanceQrVisible,
    setAvailabilityDeleteTarget,
    setAvailabilityDraft,
    setAvailabilityTimeTarget,
    setCancelVisible,
    setEditVisible,
    setIsAvailabilityEditorOpen,
    setIsAvailabilityTimeOpen,
    setMembershipPaymentConfirmation,
    setMembershipPurchaseConfirmVisible,
    setRankingPrivacyTarget,
    setTerminateVisible,
    statusMessage,
    profileFitnessError,
    profileFitnessLoading,
    fitnessSummaryBadge,
    fitnessSummaryBadgeDetail,
    fitnessSummaryCards,
    fitnessSummaryHealth,
    fitnessSummaryHealthDetail,
    fitnessSummaryRank,
    fitnessSummaryRankDetail,
    terminateVisible,
    user,
    onOpenMastery: () => router.push("/(tabs)/mastery"),
    onOpenWorkout: () => router.push("/(tabs)/workout")
  };
}

export type ProfileScreenController = ReturnType<typeof useProfileScreen>;
