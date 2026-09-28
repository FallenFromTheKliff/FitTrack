"use client";

import { useEffect, useState } from "react";
import { EyeOff, ShieldAlert, ShieldCheck } from "lucide-react";
import type {
  AdminGamificationSeasonStandingRecord,
  FitnessRankingGovernanceStatus,
} from "@fittrack/types";

import { FitButton, FitPill, FitText, FitTextArea } from "@/components/fit";
import { FitModal } from "@/components/modals";
import { useTheme } from "@/contexts/ThemeContext";

type RankingDecision = Extract<
  FitnessRankingGovernanceStatus,
  "normal" | "hidden_by_admin" | "disqualified"
>;

type Props = {
  isPending: boolean;
  onClose: () => void;
  onDecision: (
    standing: AdminGamificationSeasonStandingRecord,
    status: RankingDecision,
    rationale: string,
  ) => void;
  reviewContext?: "overall" | "muscle";
  standing: AdminGamificationSeasonStandingRecord | null;
};

function formatDateTime(value: string | null) {
  if (!value) return "No recorded activity";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function labelize(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function RankingReviewModal({
  isPending,
  onClose,
  onDecision,
  reviewContext = "overall",
  standing,
}: Props) {
  const { colors } = useTheme();
  const [rationale, setRationale] = useState("");

  useEffect(() => {
    setRationale(
      standing ? `Manual ranking review for ${standing.memberName}.` : "",
    );
  }, [standing]);

  const submitDecision = (status: RankingDecision) => {
    if (!standing || rationale.trim().length < 8) return;
    onDecision(standing, status, rationale.trim());
  };

  const statusColor = standing?.isDisqualified
    ? colors.danger
    : standing?.isHidden
      ? colors.warning
      : colors.success;
  const isPriorityPlacement =
    standing?.rankPosition !== null &&
    standing?.rankPosition !== undefined &&
    standing.rankPosition <= 3;
  const reviewStats = standing
    ? reviewContext === "muscle"
      ? [
          {
            label: "Rank",
            value: standing.rankPosition
              ? `#${standing.rankPosition}`
              : "Unranked",
          },
          {
            label: "Muscle EXP",
            value: `${standing.topMuscleXp.toLocaleString("en-US")} EXP`,
          },
          {
            label: "Muscle",
            value: standing.topMuscle ?? "No muscle data",
          },
          {
            label: "Ranking scope",
            value: standing.seasonTitle,
          },
          {
            label: "Visibility",
            value: labelize(standing.visibility),
          },
          {
            label: "Last activity",
            value: formatDateTime(standing.lastEarnedAt),
          },
        ]
      : [
          {
            label: "Rank",
            value: standing.rankPosition
              ? `#${standing.rankPosition}`
              : "Unranked",
          },
          {
            label: "Season score",
            value: `${standing.seasonPoints.toLocaleString("en-US")} pts`,
          },
          {
            label: "Total EXP",
            value: standing.totalXp.toLocaleString("en-US"),
          },
          {
            label: "Top muscle",
            value: standing.topMuscle ?? "No muscle data",
          },
          {
            label: "Top muscle EXP",
            value: standing.topMuscleXp.toLocaleString("en-US"),
          },
          {
            label: "Milestones",
            value: `${standing.milestoneClaimedCount}/${standing.milestoneUnlockedCount} claimed`,
          },
        ]
    : [];

  return (
    <FitModal
      isOpen={standing !== null}
      onClose={onClose}
      title={
        reviewContext === "muscle"
          ? "Review muscle ranking"
          : "Review competitor"
      }
      subtitle={
        reviewContext === "muscle"
          ? "Inspect per-muscle performance and apply a ranking-only moderation decision."
          : "Inspect ranking evidence and apply a ranking-only moderation decision."
      }
      icon={ShieldAlert}
      maxWidth={720}
      closeAriaLabel="Close competitor review"
      containerStyle={{ borderRadius: 8 }}
      contentStyle={{ padding: 18 }}
      footer={
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <FitButton
            variant="ghost"
            label="Cancel"
            disabled={isPending}
            onClick={onClose}
            style={{ minHeight: 36 }}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {standing?.governanceStatus !== "normal" ? (
              <FitButton
                variant="positive"
                icon={ShieldCheck}
                label="Restore ranking"
                loading={isPending}
                disabled={rationale.trim().length < 8}
                onClick={() => submitDecision("normal")}
                style={{ minHeight: 36 }}
              />
            ) : null}
            <FitButton
              variant="ghost"
              icon={EyeOff}
              label="Hide from rankings"
              loading={isPending}
              disabled={rationale.trim().length < 8}
              onClick={() => submitDecision("hidden_by_admin")}
              style={{ minHeight: 36 }}
            />
            <FitButton
              variant="danger"
              icon={ShieldAlert}
              label="Disqualify"
              loading={isPending}
              disabled={rationale.trim().length < 8}
              onClick={() => submitDecision("disqualified")}
              style={{ minHeight: 36 }}
            />
          </div>
        </div>
      }
    >
      {standing ? (
        <div style={{ display: "grid", gap: 14 }}>
          <div
            style={{
              alignItems: "flex-start",
              borderBottom: `1px solid ${colors.border}`,
              display: "flex",
              gap: 12,
              justifyContent: "space-between",
              paddingBottom: 14,
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <FitText as="h3" style={{ fontSize: 18, fontWeight: 900 }}>
                {standing.displayAlias ?? standing.memberName}
              </FitText>
              {standing.displayAlias ? (
                <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
                  {standing.memberName}
                </FitText>
              ) : null}
              <FitText style={{ color: colors.textSecondary, fontSize: 12 }}>
                {standing.seasonTitle}
              </FitText>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {isPriorityPlacement ? (
                <FitPill
                  mode="status"
                  label={`Top ${standing.rankPosition} placement`}
                  color={colors.warning}
                />
              ) : null}
              <FitPill
                mode="status"
                label={labelize(standing.governanceStatus)}
                color={statusColor}
              />
            </div>
          </div>

          {isPriorityPlacement ? (
            <div
              style={{
                backgroundColor: `${colors.warning}12`,
                border: `1px solid ${colors.warning}44`,
                borderRadius: 6,
                color: colors.textSecondary,
                fontSize: 12,
                lineHeight: 1.5,
                padding: "10px 12px",
              }}
            >
              This member is highly visible in the leaderboard. Review recent EXP
              and muscle distribution before changing ranking eligibility.
            </div>
          ) : null}

          <div
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 6,
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              overflow: "hidden",
            }}
          >
            {reviewStats.map((stat) => (
              <div
                key={stat.label}
                style={{
                  borderBottom: `1px solid ${colors.border}`,
                  borderRight: `1px solid ${colors.border}`,
                  display: "grid",
                  gap: 4,
                  minHeight: 72,
                  padding: 12,
                }}
              >
                <FitText
                  style={{
                    color: colors.textMuted,
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: "uppercase",
                  }}
                >
                  {stat.label}
                </FitText>
                <FitText style={{ fontSize: 14, fontWeight: 850 }}>
                  {stat.value}
                </FitText>
              </div>
            ))}
          </div>

          {reviewContext === "overall" ? (
            <div
              style={{
                alignItems: "center",
                display: "flex",
                gap: 12,
                justifyContent: "space-between",
              }}
            >
              <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
                Last EXP activity
              </FitText>
              <FitText style={{ fontSize: 12, fontWeight: 750 }}>
                {formatDateTime(standing.lastEarnedAt)}
              </FitText>
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 6 }}>
            <label htmlFor="ranking-review-rationale">
              <FitText style={{ fontSize: 12, fontWeight: 800 }}>
                Review rationale
              </FitText>
            </label>
            <FitTextArea
              id="ranking-review-rationale"
              rows={3}
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
              placeholder="Explain why this competitor should remain, be hidden, or be disqualified."
            />
            <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
              Ranking actions do not suspend the member&apos;s FitTrack account.
            </FitText>
          </div>
        </div>
      ) : null}
    </FitModal>
  );
}
