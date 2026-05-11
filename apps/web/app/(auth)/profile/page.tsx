"use client";

import { useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
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
import type { FitnessRankingVisibility } from "@fittrack/types";

import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { buildRenderableAssetUrl, calcBMI, formatDate } from "@fittrack/utils";
import { profileStyles } from "@/styles/pageStyles";
import { PERSONAL_FIELDS } from "@/data/profile/profile";
import { useProfilePage } from "@/hooks/profile/useProfile";

import { FitText, FitTextInput } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
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
import { WEB_API_BASE_URL } from "@/lib/api-client";
import { sanitizePhoneInput } from "./helpers";
import GymProfileSection from "@/components/profile/GymProfileSection";

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
                  onClick={() => router.push("/mastery")}
                  subtitle={topMuscle ? `${topMuscle.muscleGroup} leads with ${formatCompactNumber(topMuscle.xpPoints)} EXP.` : "Complete a workout to start earning live mastery badges."}
                  trailingLabel={highestRankEntry ? `${highestRankEntry.rankDisplay} badge` : "First badge pending"}
                />
                <MemberCard
                  hasBorder
                  icon={Trophy}
                  label="Gym Standing"
                  onClick={() => router.push("/mastery")}
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
              <div className="member-only-profile-actions">
                <FitButton label="Open Muscle Mastery" icon={Trophy} onClick={() => router.push("/mastery")} fullWidth />
                <FitButton label="Open Workout" icon={Dumbbell} onClick={() => router.push("/workout")} fullWidth variant="ghost" />
              </div>
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
            label="Edit Profile"
            onClick={() => router.push("/settings")}
            subtitle="Update member-facing preferences and account controls."
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

function OperationsProfileSettingsPage() {
  const { colors, onBrandTextColor } = useTheme();
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();
  const s = useMemo(() => profileStyles(colors), [colors]);

  const {
    personalData,
    setPersonalData,
    editing,
    setEditing,
    saving,
    saveLabel,
    showDobCalendar,
    setShowDobCalendar,
    hasChanges,
    roleValue,
    initials,
    displayedAvatarUri,
    isAdmin,
    message,
    setAvatarFile,
    handleSave,
    resetPersonalData
  } = useProfilePage();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const renderLabeledInput = ({
    label,
    icon: Icon,
    value,
    placeholder,
    type = "text",
    onChange
  }: {
    label: string;
    icon: typeof User;
    value: string;
    placeholder: string;
    type?: string;
    onChange: (value: string) => void;
  }) => (
    <div>
      <FitText style={s.fieldLabel}>{label}</FitText>
      <div style={{ position: "relative" }}>
        <Icon size={14} color={colors.textMuted} style={s.fieldIcon} />
        <FitTextInput
          type={type}
          value={value}
          placeholder={placeholder}
          disabled={!editing}
          onChange={(event) => onChange(event.target.value)}
          style={editing ? s.inputBase : s.inputDisabled}
        />
      </div>
    </div>
  );

  return (
    <FitSection as="section" heading="" hideHeading bare noPadding className={themeTransition} style={fadeIn}>
      <div style={s.outerWrap}>
        <div style={s.innerWrap}>
          {message ? (
            <div style={{ marginBottom: 10, display: "flex", justifyContent: "flex-end" }}>
              <FitText style={{ fontSize: 13, color: colors.success, fontWeight: 600 }}>{message}</FitText>
            </div>
          ) : null}
          <div style={s.shell}>
            <div style={s.twoColGrid}>
              <div style={{ ...s.panel, display: "flex", flexDirection: "column" }}>
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
                <FitText as="p" style={{ fontSize: 13, color: colors.textMuted, marginBottom: 14 }}>
                  Keep this surface focused on personal management details for the active web account.
                </FitText>
                <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
                  <div style={s.twoColumnFieldGrid}>
                    {renderLabeledInput({
                      label: "First Name",
                      icon: User,
                      value: personalData.firstName,
                      placeholder: "First name",
                      onChange: (value) => setPersonalData((prev) => ({ ...prev, firstName: value }))
                    })}
                    {renderLabeledInput({
                      label: "Last Name",
                      icon: User,
                      value: personalData.lastName,
                      placeholder: "Last name",
                      onChange: (value) => setPersonalData((prev) => ({ ...prev, lastName: value }))
                    })}
                  </div>
                  {PERSONAL_FIELDS.filter((field) => field.key !== "firstName" && field.key !== "lastName").map((field) => (
                    <div key={field.key}>
                      <FitText style={s.fieldLabel}>{field.label}</FitText>
                      {field.key === "dateOfBirth" ? (
                        <FitButton
                          variant="field"
                          disabled={!editing}
                          onClick={() => {
                            if (!editing) return;
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
                          {personalData.dateOfBirth ? formatDate(personalData.dateOfBirth, "MMM d, yyyy") : "Select date"}
                        </FitButton>
                      ) : (
                        <div style={{ position: "relative" }}>
                          <field.icon size={14} color={colors.textMuted} style={s.fieldIcon} />
                          <FitTextInput
                            type={field.type || "text"}
                            value={personalData[field.key]}
                            placeholder={field.placeholder}
                            disabled={!editing || field.key === "email"}
                            inputMode={field.key === "phone" ? "numeric" : undefined}
                            pattern={field.key === "phone" ? "[0-9]*" : undefined}
                            maxLength={field.key === "phone" ? 11 : undefined}
                            onChange={(event) => {
                              const nextValue = field.key === "phone"
                                ? sanitizePhoneInput(event.target.value)
                                : event.target.value;
                              setPersonalData((prev) => ({ ...prev, [field.key]: nextValue }));
                            }}
                            style={editing && field.key !== "email" ? s.inputBase : s.inputDisabled}
                          />
                        </div>
                      )}
                      {field.key === "email" ? (
                        <FitText style={{ fontSize: 12, color: colors.textMuted, marginTop: 6 }}>
                          Email updates are managed outside profile settings.
                        </FitText>
                      ) : null}
                    </div>
                  ))}
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
                        disabled={!hasChanges}
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
              <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
                <GymProfileSection canEdit={isAdmin} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <CalendarModal
        isOpen={showDobCalendar}
        selectedDate={personalData.dateOfBirth}
        onSelect={(dateYmd) => setPersonalData((prev) => ({ ...prev, dateOfBirth: dateYmd }))}
        onClose={() => setShowDobCalendar(false)}
      />
    </FitSection>
  );
}
