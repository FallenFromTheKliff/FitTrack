"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  CreditCard,
  Dumbbell,
  HeartPulse,
  Pencil,
  Save,
  ScanLine,
  Sparkles,
  Trophy,
  User,
  UserCog,
} from "lucide-react";
import type { CoachProfileRecord, FitnessRankingVisibility } from "@fittrack/types";
import type { UpdateCoachProfilePayload } from "@fittrack/api-client";

import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { buildRenderableAssetUrl, calcBMI, formatDate, formatDateYMD } from "@fittrack/utils";
import { profileStyles } from "@/styles/pageStyles";
import { PERSONAL_FIELDS } from "@/data/profile/profile";
import { useProfilePage } from "@/hooks/profile/useProfile";

import { FitText, FitTextInput } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitPill from "@/components/fit/FitPill";
import FitSection from "@/components/fit/FitSection";
import { CalendarModal } from "@/components/modals";
import {
  MemberCard,
  MemberGrid,
  MemberOnlyScreen,
  MemberSection,
  MemberStack,
  MemberSurface,
  MemberText,
  PremiumGate,
  StatTile,
} from "@/components/member-only/MemberOnlyPrimitives";
import {
  formatSessionDate,
  getInitials,
  getMemberSinceLabel,
  getMembershipAccessSummary,
  getRankingPrivacyIcon,
} from "@/components/member-only/MemberOnlyPageShared";
import {
  formatCompactNumber,
  formatStatusLabel,
  resolveHighestRank,
} from "@/components/member-only/memberOnlyUtils";
import { useMemberOnlyAccess, useMemberOnlyProfileData } from "@/hooks/member-only/useMemberOnlyData";
import { WEB_API_BASE_URL, webApiClient } from "@/lib/api-client";
import {
  getPhilippinePhoneDigits,
  toPhilippinePhoneValue,
} from "@/components/profile/profileFieldUtils";
import CoachReceivedReviewsPanel from "@/components/profile/CoachReceivedReviewsPanel";
import {
  coachSelfProfileQueryOptions,
  updateCoachProfileMutationOptions,
} from "@fittrack/query";
import { COACH_SPECIALTY_OPTIONS } from "@/components/schedule/GymOperationsOverlayShared";

const COACH_WEEKDAY_OPTIONS = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];
const COACH_WEEKDAY_LABELS = new Map(COACH_WEEKDAY_OPTIONS.map((day) => [day.value, day.label]));

type CoachProfileFormState = {
  bio: string;
  displayName: string;
  hourlyRate: string;
  scheduleType: "full_time" | "part_time";
  skills: string;
  specializations: string;
};

function joinCoachListInput(values?: string[] | null) {
  return (values ?? []).join(", ");
}

function splitCoachListInput(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function createCoachProfileFormState(profile?: CoachProfileRecord | null): CoachProfileFormState {
  return {
    bio: profile?.bio ?? "",
    displayName: profile?.displayName ?? "",
    hourlyRate: profile?.hourlyRate != null ? String(profile.hourlyRate) : "",
    scheduleType: profile?.scheduleType ?? "part_time",
    skills: joinCoachListInput(profile?.certifications),
    specializations: joinCoachListInput(profile?.specialties),
  };
}

function formatCoachScheduleType(scheduleType?: CoachProfileRecord["scheduleType"] | null) {
  return scheduleType === "full_time" ? "Full-time" : "Part-time";
}

function formatCoachHourlyRate(hourlyRate?: number | null) {
  return hourlyRate != null && Number.isFinite(hourlyRate)
    ? `PHP ${hourlyRate.toLocaleString("en-PH")}`
    : "Unset";
}

function getCoachDisplayName(profile?: CoachProfileRecord | null, fallbackName?: string) {
  return profile?.displayName?.trim() || fallbackName?.trim() || "Coach Profile";
}

function getCoachAvailability(profile?: CoachProfileRecord | null) {
  return (profile?.availability ?? []).filter((slot) => slot.isAvailable !== false);
}

function formatCoachAvailabilitySlot(slot: NonNullable<CoachProfileRecord["availability"]>[number]) {
  const day = COACH_WEEKDAY_LABELS.get(slot.dayOfWeek) ?? `Day ${slot.dayOfWeek}`;
  return `${day} / ${slot.startTime} - ${slot.endTime}`;
}

function getCoachSpecialties(profile?: CoachProfileRecord | null) {
  return (profile?.specialties ?? []).map((specialty) => specialty.trim()).filter(Boolean);
}

function isKnownCoachSpecialty(value: string) {
  return COACH_SPECIALTY_OPTIONS.some((option) => option.value === value);
}

export default function ProfileSettingsPage() {
  const { user } = useAuth();

  if (user?.role === "USER") {
    return <MemberProfileBody />;
  }

  return <OperationsProfileSettingsPage />;
}

function MemberProfileBody() {
  const router = useRouter();
  const { colors, onBrandTextColor } = useTheme();
  const access = useMemberOnlyAccess("Profile");
  const { user, hasMemberCardAccess, membershipCardStatus } = access;
  const data = useMemberOnlyProfileData({ hasMemberCardAccess, userId: user?.id });
  const mastery = data.masteryQuery.data ?? [];
  const leaderboard = data.leaderboardQuery.data?.data ?? [];
  const subscription = data.subscriptionQuery.data ?? null;
  const rankingVisibility = data.rankingProfileQuery.data?.visibility ?? "public";
  const topMuscle = mastery[0] ?? null;
  const highestRankEntry = resolveHighestRank(mastery);
  const totalXp = mastery.reduce((sum, entry) => sum + entry.xpPoints, 0);
  const leaderboardEntry = leaderboard.find((entry) => entry.userId === user?.id) ?? null;
  const initials = user?.avatarInitials ?? getInitials(user?.name ?? "FitTrack");
  const avatarUri = buildRenderableAssetUrl({
    apiBaseUrl: WEB_API_BASE_URL,
    assetUrl: user?.avatarUri ?? null,
  });
  const memberSince = getMemberSinceLabel(user?.memberSince);
  const memberAccessSummary = getMembershipAccessSummary(membershipCardStatus, hasMemberCardAccess);
  const accessTone = membershipCardStatus === "revoked"
    ? "danger"
    : membershipCardStatus === "pending_verification"
      ? "warning"
      : hasMemberCardAccess
        ? "success"
        : "muted";
  const attendanceQrReady = user?.attendanceQrReady ?? false;
  const hasQrCodeToken = user?.qrCodeReady ?? false;
  const qrCodeStatusLabel = attendanceQrReady
    ? "Ready"
    : membershipCardStatus === "pending_verification"
      ? "Pending"
      : membershipCardStatus === "revoked" || hasQrCodeToken
        ? "Locked"
        : hasMemberCardAccess
          ? "Preparing"
          : "Unavailable";
  const qrCodeSubtitle = attendanceQrReady
    ? "Open the mobile app for the rotating attendance QR used by front-desk check-ins."
    : membershipCardStatus === "pending_verification"
      ? "Attendance scans unlock as soon as staff verifies your member card."
      : membershipCardStatus === "revoked"
        ? "Your membership card is revoked, so attendance QR access is locked."
        : hasMemberCardAccess
          ? "Your member card is active. Mobile keeps the live rotating QR."
          : "Attendance QR becomes available once this account has an active membership card.";
  const bmi = user?.weightKg && user.heightCm ? calcBMI(user.weightKg, user.heightCm) : null;
  const healthSnapshot = bmi
    ? `BMI ${bmi.bmi}`
    : "BMI unavailable";
  const healthDetail = bmi
    ? `${bmi.status} | ${user?.weightKg ?? "--"} kg | ${user?.heightCm ?? "--"} cm`
    : "Add height and weight in Profile or Nutrition Targets to unlock a health snapshot.";
  const membershipSubtitle = subscription
    ? `${subscription.plan.name} | ${formatStatusLabel(subscription.status)}`
    : hasMemberCardAccess
      ? "No loaded plan yet"
      : "Add a membership card first to load plans";
  const rankingOptions: Array<{ description: string; label: string; value: FitnessRankingVisibility }> = [
    {
      description: "Show your profile name on ranked member surfaces.",
      label: "Public",
      value: "public",
    },
    {
      description: "Stay ranked while masking your member identity.",
      label: "Anonymous",
      value: "anonymous",
    },
    {
      description: "Hide your visible ranking while keeping progression history.",
      label: "Private",
      value: "private",
    },
  ];

  return (
    <MemberOnlyScreen>
      <div
        className="member-only-profile-banner"
        style={{
          alignItems: "center",
          backgroundColor: colors.brand,
          borderRadius: 14,
          color: onBrandTextColor,
          display: "flex",
          gap: 16,
          padding: "20px",
        }}
      >
        <div
          style={{
            alignItems: "center",
            backgroundColor: colors.brandLight,
            border: "2px solid rgba(255,255,255,0.3)",
            borderRadius: 16,
            display: "flex",
            flexShrink: 0,
            height: 68,
            justifyContent: "center",
            overflow: "hidden",
            width: 68,
          }}
        >
          {avatarUri ? (
            <img
              alt={`${user?.name ?? "Member"} avatar`}
              src={avatarUri}
              style={{ height: "100%", objectFit: "cover", width: "100%" }}
            />
          ) : (
            <FitText style={{ color: colors.brand, fontSize: 24, fontWeight: 900 }} excludeGlobalScale>
              {initials}
            </FitText>
          )}
        </div>
        <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
          <FitText
            as="h1"
            style={{
              color: onBrandTextColor,
              fontSize: 20,
              fontWeight: 800,
              lineHeight: 1.16,
              margin: 0,
            }}
            excludeGlobalScale
          >
            {user?.name ?? "Member"}
          </FitText>
          <FitText
            style={{
              color: onBrandTextColor,
              display: "block",
              fontSize: 14,
              opacity: 0.82,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            excludeGlobalScale
          >
            {user?.email ?? "member@fittrack.local"}
          </FitText>
          {memberSince ? (
            <FitText style={{ color: onBrandTextColor, fontSize: 13, opacity: 0.68 }} excludeGlobalScale>
              {memberSince}
            </FitText>
          ) : null}
        </div>
      </div>

      {hasMemberCardAccess ? (
        <MemberSection heading="Fitness Summary">
          {data.masteryQuery.isPending || data.leaderboardQuery.isPending || data.rankingProfileQuery.isPending ? (
            <MemberSurface padded>
              <MemberText variant="muted">Loading your live mastery summary...</MemberText>
            </MemberSurface>
          ) : (
            <MemberStack>
              <MemberGrid columns={3}>
                <StatTile icon={Sparkles} label="Total EXP" value={formatCompactNumber(totalXp)} />
                <StatTile icon={Dumbbell} label="Tracked Muscles" value={String(mastery.length)} />
                <StatTile icon={Trophy} label="Gym Rank" value={leaderboardEntry ? `#${leaderboardEntry.rankPosition}` : "--"} />
              </MemberGrid>
              <MemberSurface>
                <MemberCard
                  hasBorder
                  icon={Award}
                  label="Current Badge"
                  subtitle={topMuscle ? `${topMuscle.muscleGroup} leads with ${formatCompactNumber(topMuscle.xpPoints)} EXP.` : "Complete a workout to start earning live mastery badges."}
                  trailingLabel={highestRankEntry ? `${highestRankEntry.rankDisplay} badge` : "First badge pending"}
                />
                <MemberCard
                  hasBorder
                  icon={Trophy}
                  label="Gym Standing"
                  subtitle={leaderboardEntry ? `${formatCompactNumber(totalXp)} EXP across ${mastery.length} tracked muscle group${mastery.length === 1 ? "" : "s"}.` : "No leaderboard placement yet. Your next tracked sessions will start the climb."}
                  trailingLabel={leaderboardEntry ? `Gym Rank #${leaderboardEntry.rankPosition}` : "Leaderboard warming up"}
                />
                <MemberCard
                  icon={HeartPulse}
                  label="Health Snapshot"
                  subtitle={healthDetail}
                  trailingLabel={healthSnapshot}
                />
              </MemberSurface>
            </MemberStack>
          )}
        </MemberSection>
      ) : (
        <MemberSection heading="Fitness Progress">
          <PremiumGate
            icon={Trophy}
            message={`${memberAccessSummary} Fitness progress, badges, and achievement history unlock once this account has an active membership card.`}
            statusLabel={access.statusLabel}
            title={membershipCardStatus === "pending_verification" ? "Membership card verification in progress" : "Stats, badges, and achievements stay locked"}
          />
        </MemberSection>
      )}

      {hasMemberCardAccess ? (
        <MemberSection heading="Ranking Privacy">
          <MemberSurface>
            {rankingOptions.map((option, index) => {
              const Icon = getRankingPrivacyIcon(option.value);
              const isSelected = rankingVisibility === option.value;
              return (
                <MemberCard
                  key={option.value}
                  hasBorder={index < rankingOptions.length - 1}
                  icon={Icon}
                  label={option.label}
                  selected={isSelected}
                  subtitle={option.description}
                  trailingLabel={isSelected ? "Active" : undefined}
                  trailingTone={isSelected ? "success" : "muted"}
                />
              );
            })}
          </MemberSurface>
        </MemberSection>
      ) : null}

      <MemberSection heading="Account">
        <MemberSurface>
          <MemberCard
            hasBorder
            icon={UserCog}
            label="Profile Settings"
            onClick={() => router.push("/settings")}
            subtitle="Open settings for password, preferences, and account support."
          />
          <MemberCard
            hasBorder
            icon={CreditCard}
            label="Member Access"
            subtitle={memberAccessSummary}
            trailingLabel={access.statusLabel}
            trailingTone={accessTone}
          />
          <MemberCard
            hasBorder
            icon={ScanLine}
            label="Attendance QR"
            subtitle={qrCodeSubtitle}
            trailingLabel={qrCodeStatusLabel}
            trailingTone={attendanceQrReady ? "success" : membershipCardStatus === "pending_verification" ? "warning" : "muted"}
          />
          {!hasMemberCardAccess ? (
            <MemberCard
              hasBorder
              icon={CreditCard}
              label="Membership Card Purchase"
              subtitle={
                membershipCardStatus === "pending_verification"
                  ? "Your membership card request is already pending verification."
                  : membershipCardStatus === "revoked"
                    ? "Staff can restore membership access without a new one-time card payment."
                    : "Permanent PHP 400 membership card. Buy once, then load plans whenever you need them."
              }
              trailingLabel={membershipCardStatus === "none" ? "PHP 400" : undefined}
              trailingTone={membershipCardStatus === "none" ? "brand" : "muted"}
            />
          ) : null}
          <MemberCard
            hasBorder
            icon={CreditCard}
            label="Loaded Plan"
            subtitle={membershipSubtitle}
            trailingLabel={subscription ? formatStatusLabel(subscription.status) : undefined}
            trailingTone={subscription?.status === "active" ? "success" : "muted"}
          />
          <MemberCard
            icon={CreditCard}
            label="Payment History"
            subtitle={
              user?.membershipCard?.activatedAt
                ? `Membership card completed | ${formatSessionDate(user.membershipCard.activatedAt)}`
                : membershipCardStatus === "pending_verification"
                  ? "Membership card pending verification"
                  : "Card and plan payments will appear here once available"
            }
            trailingLabel={membershipCardStatus === "active" ? "Completed" : membershipCardStatus === "pending_verification" ? "Pending" : undefined}
            trailingTone={membershipCardStatus === "active" ? "success" : membershipCardStatus === "pending_verification" ? "warning" : "muted"}
          />
        </MemberSurface>
      </MemberSection>
    </MemberOnlyScreen>
  );
}

function CoachProfileSnapshotPanel() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const fallbackName = [
    user?.profile?.firstName?.trim(),
    user?.profile?.lastName?.trim(),
  ]
    .filter(Boolean)
    .join(" ") || user?.name;
  const { data: coachProfile = null, isPending } = useQuery({
    ...coachSelfProfileQueryOptions<CoachProfileRecord>(webApiClient, user?.id),
    enabled: user?.role === "COACH" && Boolean(user?.id),
    staleTime: 60_000,
  });
  const availability = useMemo(() => getCoachAvailability(coachProfile), [coachProfile]);
  const specialties = useMemo(() => getCoachSpecialties(coachProfile), [coachProfile]);
  const displayName = getCoachDisplayName(coachProfile, fallbackName);
  const contactLabel =
    coachProfile?.contactEmail?.trim() ||
    "No coach-profile contact email yet. Edit profile to add one.";
  const isVisible = coachProfile?.isActive !== false;
  const metrics = [
    { label: "Weekly Slots", value: isPending ? "..." : availability.length },
    {
      label: "Schedule Type",
      tone: colors.brand,
      value: isPending ? "..." : formatCoachScheduleType(coachProfile?.scheduleType),
    },
    {
      label: "Hourly Rate",
      tone: coachProfile?.hourlyRate != null ? colors.brand : colors.textPrimary,
      value: isPending ? "..." : formatCoachHourlyRate(coachProfile?.hourlyRate),
    },
    {
      label: "Certifications",
      tone: (coachProfile?.certifications?.length ?? 0) > 0 ? colors.success : colors.textPrimary,
      value: isPending ? "..." : (coachProfile?.certifications?.length ?? 0),
    },
  ];

  return (
    <div
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 18,
        display: "grid",
        gap: 14,
        padding: 20,
      }}
    >
      <div
        style={{
          alignItems: "flex-start",
          display: "flex",
          gap: 12,
          justifyContent: "space-between",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <FitText
            as="h3"
            excludeGlobalScale
            style={{
              color: colors.textPrimary,
              fontSize: 24,
              fontWeight: 900,
              lineHeight: 1.05,
              margin: 0,
            }}
          >
            {displayName}
          </FitText>
          <FitText
            as="p"
            excludeGlobalScale
            style={{
              color: colors.textMuted,
              fontSize: 12,
              lineHeight: 1.4,
              margin: "6px 0 0",
            }}
          >
            {contactLabel}
          </FitText>
        </div>
        <FitPill
          mode="status"
          label={isPending ? "LOADING" : isVisible ? "VISIBLE IN BOOKING" : "HIDDEN FROM BOOKING"}
          color={isPending ? colors.textMuted : isVisible ? colors.brand : colors.warning}
          fontSize={10}
          fontWeight={800}
          borderOpacity="35"
          bgOpacity="14"
          style={{ borderRadius: 6, flexShrink: 0 }}
        />
      </div>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))" }}>
        {metrics.map((metric) => (
          <div
            key={metric.label}
            style={{
              backgroundColor: colors.surfaceRaised,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              display: "grid",
              gap: 12,
              minHeight: 86,
              padding: "12px 14px",
            }}
          >
            <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 11, fontWeight: 800 }}>
              {metric.label}
            </FitText>
            <FitText
              excludeGlobalScale
              style={{
                color: metric.tone ?? colors.textPrimary,
                fontSize: 20,
                fontWeight: 900,
                lineHeight: 1.1,
                wordBreak: "break-word",
              }}
            >
              {metric.value}
            </FitText>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div
          style={{
            backgroundColor: colors.surfaceRaised,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            display: "grid",
            gap: 10,
            padding: "14px 16px",
          }}
        >
          <FitText excludeGlobalScale style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 800 }}>
            Availability snapshot
          </FitText>
          {availability.length > 0 ? (
            availability.slice(0, 4).map((slot) => (
              <FitText
                key={`${slot.dayOfWeek}-${slot.startTime}-${slot.endTime}`}
                excludeGlobalScale
                style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 1.45 }}
              >
                {formatCoachAvailabilitySlot(slot)}
              </FitText>
            ))
          ) : (
            <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 12, lineHeight: 1.45 }}>
              No availability recorded yet.
            </FitText>
          )}
        </div>

        <div
          style={{
            backgroundColor: colors.surfaceRaised,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            display: "grid",
            gap: 10,
            padding: "14px 16px",
          }}
        >
          <FitText excludeGlobalScale style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 800 }}>
            Specialties
          </FitText>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {specialties.length > 0 ? (
              specialties.map((specialty, index) => (
                <FitPill
                  key={`${specialty}-${index}`}
                  mode="status"
                  label={specialty.toUpperCase()}
                  color={index === 0 ? colors.brand : colors.textMuted}
                  fontSize={9}
                  fontWeight={800}
                  borderOpacity="28"
                  bgOpacity="12"
                  style={{ borderRadius: 6 }}
                />
              ))
            ) : (
              <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 12, lineHeight: 1.45 }}>
                No specialties recorded yet.
              </FitText>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          backgroundColor: colors.surfaceRaised,
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          display: "grid",
          gap: 10,
          padding: "14px 16px",
        }}
      >
        <FitText excludeGlobalScale style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 800 }}>
          Booking bio
        </FitText>
        <FitText excludeGlobalScale style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 1.5 }}>
          {coachProfile?.bio?.trim() || "No booking bio recorded yet."}
        </FitText>
      </div>
    </div>
  );
}

function CoachProfileManagementPanel() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CoachProfileFormState>(() => createCoachProfileFormState());
  const [isCoachProfileEditing, setIsCoachProfileEditing] = useState(false);
  const [message, setMessage] = useState<{ tone: "danger" | "success"; text: string } | null>(null);
  const { data: coachProfile = null, isPending } = useQuery({
    ...coachSelfProfileQueryOptions<CoachProfileRecord>(webApiClient, user?.id),
    enabled: user?.role === "COACH" && Boolean(user?.id),
    staleTime: 60_000,
  });
  const updateProfileMutation = useMutation(updateCoachProfileMutationOptions(webApiClient, queryClient));
  const isSaving = updateProfileMutation.isPending;
  const coachProfileReadOnly = !isCoachProfileEditing || isPending || isSaving;
  const savedCoachProfileForm = useMemo(
    () => createCoachProfileFormState(coachProfile),
    [coachProfile],
  );
  const hasCoachProfileChanges = JSON.stringify(form) !== JSON.stringify(savedCoachProfileForm);
  const selectedSpecializations = useMemo(
    () => splitCoachListInput(form.specializations),
    [form.specializations],
  );
  const selectedSpecializationSet = useMemo(
    () => new Set(selectedSpecializations),
    [selectedSpecializations],
  );
  const customSpecializations = useMemo(
    () =>
      selectedSpecializations.filter(
        (specialization) => !isKnownCoachSpecialty(specialization),
      ),
    [selectedSpecializations],
  );

  useEffect(() => {
    setForm(savedCoachProfileForm);
    setIsCoachProfileEditing(false);
  }, [savedCoachProfileForm]);

  const setField = <K extends keyof CoachProfileFormState>(
    key: K,
    value: CoachProfileFormState[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const setSpecializations = (values: string[]) => {
    setField("specializations", joinCoachListInput(values));
  };
  const toggleSpecialization = (value: string) => {
    if (coachProfileReadOnly) return;

    if (selectedSpecializationSet.has(value)) {
      setSpecializations(
        selectedSpecializations.filter((specialization) => specialization !== value),
      );
      return;
    }

    setSpecializations([...selectedSpecializations, value]);
  };
  const handleSaveCoachProfile = async () => {
    if (!coachProfile || !user?.id) return;

    if (!form.displayName.trim()) {
      setMessage({ tone: "danger", text: "Display name is required." });
      return;
    }

    const profilePayload: UpdateCoachProfilePayload = {
      bio: form.bio,
      certifications: splitCoachListInput(form.skills),
      displayName: form.displayName.trim(),
      isAvailableForBooking: coachProfile.isActive,
      specialties: splitCoachListInput(form.specializations),
    };

    try {
      await updateProfileMutation.mutateAsync({
        coachId: coachProfile.id,
        payload: profilePayload,
        userId: user.id,
      });
      setIsCoachProfileEditing(false);
      setMessage({ tone: "success", text: "Coach profile updated." });
    } catch (error) {
      setMessage({
        tone: "danger",
        text: error instanceof Error ? error.message : "Unable to update coach profile.",
      });
    }
  };
  const handleCancelCoachProfile = () => {
    setForm(savedCoachProfileForm);
    setIsCoachProfileEditing(false);
    setMessage(null);
  };

  return (
    <div
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 18,
        padding: 20,
      }}
    >
      <FitText style={{ fontSize: 19, fontWeight: 800, marginBottom: 8 }}>
        Coach Profile
      </FitText>
      <FitText as="p" style={{ color: colors.textMuted, fontSize: 13, marginBottom: 14 }}>
        Edit the same CoachProfile record shown to admin and staff.
      </FitText>
      {message ? (
        <FitText
          style={{
            color: message.tone === "success" ? colors.success : colors.danger,
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          {message.text}
        </FitText>
      ) : null}
      <div style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <FitText style={{ color: colors.textMuted, fontSize: 12, fontWeight: 800 }}>Display Name</FitText>
          <FitTextInput
            id="coach-profile-display-name"
            aria-label="Display Name"
            value={form.displayName}
            disabled={coachProfileReadOnly}
            onChange={(event) => setField("displayName", event.target.value)}
            style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: "12px 14px" }}
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <FitText style={{ color: colors.textMuted, fontSize: 12, fontWeight: 800 }}>Skills</FitText>
          <FitTextInput
            id="coach-profile-skills"
            aria-label="Skills"
            value={form.skills}
            placeholder="CPR, Olympic lifting, mobility coaching"
            disabled={coachProfileReadOnly}
            onChange={(event) => setField("skills", event.target.value)}
            style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: "12px 14px" }}
          />
        </label>
        <div style={{ display: "grid", gap: 6 }}>
          <FitText style={{ color: colors.textMuted, fontSize: 12, fontWeight: 800 }}>Specializations</FitText>
          <div
            aria-label="Coach profile specializations"
            role="group"
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              padding: 10,
            }}
          >
            {COACH_SPECIALTY_OPTIONS.map((option) => {
              const selected = selectedSpecializationSet.has(option.value);

              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={coachProfileReadOnly}
                  aria-pressed={selected}
                  onClick={() => toggleSpecialization(option.value)}
                  style={{
                    backgroundColor: selected ? `${colors.brand}18` : colors.surfaceRaised,
                    border: `1px solid ${selected ? `${colors.brand}66` : colors.border}`,
                    borderRadius: 8,
                    color: selected ? colors.brand : colors.textSecondary,
                    cursor: coachProfileReadOnly ? "default" : "pointer",
                    fontSize: 11,
                    fontWeight: 800,
                    lineHeight: 1.15,
                    padding: "8px 10px",
                    textAlign: "center",
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {customSpecializations.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {customSpecializations.map((specialization) => (
                <button
                  key={specialization}
                  type="button"
                  disabled={coachProfileReadOnly}
                  aria-pressed
                  onClick={() => toggleSpecialization(specialization)}
                  style={{
                    backgroundColor: `${colors.warning}12`,
                    border: `1px solid ${colors.warning}40`,
                    borderRadius: 8,
                    color: colors.warning,
                    cursor: coachProfileReadOnly ? "default" : "pointer",
                    fontSize: 10,
                    fontWeight: 800,
                    lineHeight: 1.15,
                    padding: "7px 9px",
                    textAlign: "center",
                  }}
                >
                  {specialization}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <FitText style={{ color: colors.textMuted, fontSize: 12, fontWeight: 800 }}>Rate</FitText>
            <FitTextInput
              id="coach-profile-rate"
              aria-label="Rate"
              type="number"
              min="0"
              value={form.hourlyRate}
              disabled
              style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: "12px 14px" }}
            />
          </label>
          <div style={{ display: "grid", gap: 6 }}>
            <FitText style={{ color: colors.textMuted, fontSize: 12, fontWeight: 800 }}>Schedule Type</FitText>
            <div
              style={{
                alignItems: "center",
                backgroundColor: `${colors.brand}14`,
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                color: colors.brand,
                display: "flex",
                fontSize: 13,
                fontWeight: 800,
                justifyContent: "space-between",
                padding: "12px 14px",
              }}
            >
              <span>{form.scheduleType === "full_time" ? "Full-Time" : "Part-Time"}</span>
              <span style={{ color: colors.textMuted, fontSize: 11 }}>Admin controlled</span>
            </div>
          </div>
        </div>
        <label style={{ display: "grid", gap: 6 }}>
          <FitText style={{ color: colors.textMuted, fontSize: 12, fontWeight: 800 }}>Bio</FitText>
          <textarea
            id="coach-profile-bio"
            name="coach-profile-bio"
            aria-label="Bio"
            value={form.bio}
            disabled={coachProfileReadOnly}
            onChange={(event) => setField("bio", event.target.value)}
            style={{
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              color: colors.textPrimary,
              minHeight: 86,
              padding: "12px 14px",
              resize: "vertical",
            }}
          />
        </label>
        {isCoachProfileEditing ? (
          <div style={{ display: "flex", gap: 10 }}>
            <FitButton
              variant="ghost"
              label="Cancel"
              disabled={isSaving}
              onClick={handleCancelCoachProfile}
              fullWidth
            />
            <FitButton
              variant="primary"
              label={isSaving ? "SAVING..." : "SAVE COACH PROFILE"}
              loading={isSaving}
              disabled={isPending || isSaving || !coachProfile || !hasCoachProfileChanges}
              onClick={handleSaveCoachProfile}
              fullWidth
            />
          </div>
        ) : (
          <FitButton
            variant="primary"
            label="Edit Profile"
            icon={Pencil}
            disabled={isPending || isSaving || !coachProfile}
            onClick={() => {
              setMessage(null);
              setIsCoachProfileEditing(true);
            }}
            fullWidth
          />
        )}
      </div>
    </div>
  );
}

function OperationsProfileSettingsPage() {
  const { colors, onBrandTextColor } = useTheme();
  const { user } = useAuth();
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();
  const s = useMemo(() => profileStyles(colors), [colors]);

  const {
    personalData,
    setPersonalData,
    updatePersonalField,
    markPersonalFieldTouched,
    editing,
    setEditing,
    saving,
    saveLabel,
    showDobCalendar,
    setShowDobCalendar,
    hasChanges,
    fieldErrors,
    roleValue,
    initials,
    displayedAvatarUri,
    message,
    setAvatarFile,
    handleSave,
    resetPersonalData
  } = useProfilePage();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const isCoach = user?.role === "COACH";

  const renderLabeledInput = ({
    id,
    label,
    icon: Icon,
    value,
    placeholder,
    type = "text",
    onChange,
    error
  }: {
    id: string;
    label: string;
    icon: typeof User;
    value: string;
    placeholder: string;
    type?: string;
    onChange: (value: string) => void;
    error?: string;
  }) => (
    <div>
      <FitText style={s.fieldLabel}>{label}</FitText>
      <div style={{ position: "relative" }}>
        <Icon size={14} color={colors.textMuted} style={s.fieldIcon} />
        <FitTextInput
          id={id}
          aria-label={label}
          type={type}
          value={value}
          placeholder={placeholder}
          disabled={!editing}
          onChange={(event) => onChange(event.target.value)}
          style={editing ? s.inputBase : s.inputDisabled}
        />
      </div>
      {error ? (
        <FitText as="p" role="alert" style={{ color: colors.danger, fontSize: 12, margin: "6px 0 0" }}>
          {error}
        </FitText>
      ) : null}
    </div>
  );

  return (
    <FitSection as="section" heading="" hideHeading bare noPadding className={themeTransition} style={fadeIn}>
      <div style={s.outerWrap}>
        <div
          style={{
            ...s.innerWrap,
            width: isCoach ? "min(100%, 1440px)" : "min(100%, 760px)",
          }}
        >
          {message ? (
            <div
              style={{
                display: "flex",
                justifyContent: isCoach ? "flex-start" : "flex-end",
                marginBottom: 10,
              }}
            >
              <FitText style={{ fontSize: 13, color: colors.success, fontWeight: 600 }}>{message}</FitText>
            </div>
          ) : null}
          <div
            style={{
              ...s.shell,
              ...(isCoach
                ? {
                    backgroundColor: colors.surface,
                    borderRadius: 22,
                    padding: 20,
                  }
                : { padding: 12 }),
            }}
          >
            {isCoach ? (
              <div
                style={{
                  alignItems: "flex-start",
                  display: "flex",
                  gap: 16,
                  justifyContent: "space-between",
                  marginBottom: 20,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <FitText as="h2" style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>
                    Coach workspace
                  </FitText>
                  <FitText as="p" style={{ color: colors.textMuted, fontSize: 13, lineHeight: 1.5, margin: "6px 0 0" }}>
                    Keep your personal details separate from the professional profile members see when booking.
                  </FitText>
                </div>
                <FitPill
                  mode="status"
                  label="COACH PORTAL"
                  color={colors.brand}
                  fontSize={10}
                  fontWeight={800}
                  borderOpacity="35"
                  bgOpacity="14"
                  style={{ borderRadius: 6, flexShrink: 0 }}
                />
              </div>
            ) : null}
            <div
              style={{
                ...s.twoColGrid,
                ...(isCoach
                  ? {
                      gap: 18,
                      gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 520px), 1fr))",
                    }
                  : { gridTemplateColumns: "minmax(0, 1fr)" }),
              }}
            >
              <div
                data-profile-section="personal"
                style={{
                  ...s.panel,
                  display: "flex",
                  flexDirection: "column",
                  minWidth: 0,
                  padding: isCoach ? 20 : 14,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 10, marginBottom: 12 }}>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(event) => {
                      const nextFile = event.target.files?.[0] ?? null;
                      setAvatarFile(nextFile);
                      event.target.value = "";
                    }}
                  />
                  <div
                    style={{
                      ...s.avatarCircle,
                      overflow: "hidden",
                      cursor: editing ? "pointer" : "default"
                    }}
                    onClick={() => {
                      if (!editing) return;
                      avatarInputRef.current?.click();
                    }}
                  >
                    {displayedAvatarUri ? (
                      <img
                        src={displayedAvatarUri}
                        alt="Profile avatar"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <FitText style={{ fontSize: 34, fontWeight: 800, color: onBrandTextColor }}>{initials}</FitText>
                    )}
                  </div>
                  {editing ? (
                    <FitButton
                      variant="ghost"
                      label="Change Avatar"
                      style={{ marginTop: 8 }}
                      onClick={() => avatarInputRef.current?.click()}
                    />
                  ) : null}
                  <FitText style={{ fontSize: 16, fontWeight: 700, marginTop: 8, color: colors.brand }}>
                    Portal Role: {roleValue}
                  </FitText>
                </div>
                <FitText style={{ fontSize: 19, fontWeight: 800, marginBottom: 10 }}>My Profile</FitText>
                <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
                  <div style={s.twoColumnFieldGrid}>
                    {renderLabeledInput({
                      id: "profile-first-name",
                      label: "First Name",
                      icon: User,
                      value: personalData.firstName,
                      placeholder: "First name",
                      onChange: (value) => updatePersonalField("firstName", value),
                      error: fieldErrors.firstName,
                    })}
                    {renderLabeledInput({
                      id: "profile-last-name",
                      label: "Last Name",
                      icon: User,
                      value: personalData.lastName,
                      placeholder: "Last name",
                      onChange: (value) => updatePersonalField("lastName", value),
                      error: fieldErrors.lastName,
                    })}
                  </div>
                  {PERSONAL_FIELDS.filter((field) => field.key !== "firstName" && field.key !== "lastName").map((field) => {
                    const isPhoneField = field.key === "phone";
                    const fieldError = fieldErrors[field.key];
                    return (
                      <div key={field.key}>
                        <FitText style={s.fieldLabel}>{field.label}</FitText>
                        {field.key === "dateOfBirth" ? (
                          <>
                            <FitButton
                              variant="field"
                              aria-label={
                                field.label +
                                ": " +
                                (personalData.dateOfBirth
                                  ? formatDate(personalData.dateOfBirth, "MMM d, yyyy")
                                  : "Select date")
                              }
                              disabled={!editing}
                              onClick={() => {
                                if (!editing) return;
                                markPersonalFieldTouched("dateOfBirth");
                                setShowDobCalendar(true);
                              }}
                              showTrailing={false}
                              style={{
                                ...(editing ? s.inputBase : s.inputDisabled),
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                cursor: editing ? "pointer" : "not-allowed",
                                textAlign: "left"
                              }}
                              textStyle={{ color: personalData.dateOfBirth ? colors.textPrimary : colors.textMuted }}
                            >
                              {personalData.dateOfBirth
                                ? formatDate(personalData.dateOfBirth, "MMM d, yyyy")
                                : "Select date"}
                            </FitButton>
                            <FitText as="p" style={{ color: colors.textMuted, fontSize: 12, margin: "6px 0 0" }}>
                              Selected date:{" "}
                              {personalData.dateOfBirth
                                ? formatDate(personalData.dateOfBirth, "MMM d, yyyy")
                                : "Not set"}
                            </FitText>
                          </>
                        ) : (
                          <div style={{ position: "relative" }}>
                            <field.icon size={14} color={colors.textMuted} style={s.fieldIcon} />
                            {isPhoneField ? (
                              <FitText
                                as="span"
                                aria-hidden="true"
                                style={{
                                  color: colors.textMuted,
                                  fontSize: 12,
                                  fontWeight: 800,
                                  left: 36,
                                  pointerEvents: "none",
                                  position: "absolute",
                                  top: "50%",
                                  transform: "translateY(-50%)",
                                }}
                              >
                                +63
                              </FitText>
                            ) : null}
                            <FitTextInput
                              id={"profile-" + field.key}
                              aria-label={field.label}
                              type={field.type || "text"}
                              value={isPhoneField ? getPhilippinePhoneDigits(personalData.phone) : personalData[field.key]}
                              placeholder={isPhoneField ? "917xxxxxxx" : field.placeholder}
                              disabled={!editing || field.key === "email"}
                              inputMode={isPhoneField ? "numeric" : undefined}
                              pattern={isPhoneField ? "[0-9]{10}" : undefined}
                              maxLength={isPhoneField ? 10 : undefined}
                              onChange={(event) => {
                                const nextValue = isPhoneField
                                  ? toPhilippinePhoneValue(event.target.value)
                                  : event.target.value;
                                updatePersonalField(field.key, nextValue);
                              }}
                              style={{
                                ...(editing && field.key !== "email" ? s.inputBase : s.inputDisabled),
                                ...(isPhoneField ? { paddingLeft: 72 } : {}),
                              }}
                            />
                          </div>
                        )}
                        {field.key === "email" ? (
                          <FitText style={{ fontSize: 12, color: colors.textMuted, marginTop: 6 }}>
                            Email updates are managed outside profile settings.
                          </FitText>
                        ) : null}
                        {fieldError ? (
                          <FitText as="p" role="alert" style={{ color: colors.danger, fontSize: 12, margin: "6px 0 0" }}>
                            {fieldError}
                          </FitText>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
                  {editing ? (
                    <>
                      <FitButton
                        variant="ghost"
                        label="Cancel"
                        fullWidth
                        style={s.actionBtn}
                        onClick={resetPersonalData}
                      />
                      <FitButton
                        variant="primary"
                        label={saving ? saveLabel : "SAVE CHANGES"}
                        icon={Save}
                        loading={saving}
                        disabled={!hasChanges || Object.keys(fieldErrors).length > 0}
                        fullWidth
                        style={s.actionBtn}
                        onClick={handleSave}
                      />
                    </>
                  ) : (
                    <FitButton
                      variant="primary"
                      label="Edit Profile"
                      icon={Pencil}
                      fullWidth
                      style={s.actionBtn}
                      onClick={() => setEditing(true)}
                    />
                  )}
                </div>
              </div>
              {isCoach ? (
                <div style={{ alignContent: "start", display: "grid", gap: 14, minWidth: 0 }}>
                  <CoachProfileSnapshotPanel />
                  <CoachProfileManagementPanel />
                </div>
              ) : null}
              {isCoach ? (
                <div data-profile-section="feedback" style={{ gridColumn: "1 / -1", minWidth: 0 }}>
                  <CoachReceivedReviewsPanel />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <CalendarModal
        isOpen={showDobCalendar}
        minDate={null}
        maxDate={formatDateYMD(new Date())}
        closeOnSelect={false}
        keepViewOnMonthSelect
        keepViewOnYearSelect
        preserveViewOnSelectedDateChange
        yearRangeStart={new Date().getFullYear() - 100}
        yearRangeEnd={new Date().getFullYear()}
        noScroll={false}
        selectedDate={personalData.dateOfBirth}
        onSelect={(dateYmd) => updatePersonalField("dateOfBirth", dateYmd)}
        onClose={() => setShowDobCalendar(false)}
      />
    </FitSection>
  );
}
