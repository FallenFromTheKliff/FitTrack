"use client";

import { FileText, PanelRightOpen, ShieldCheck, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { ThemeColors } from "@fittrack/types";

import { FitButton, FitPill, FitText, FitTextArea } from "@/components/fit";
import {
  ACHIEVEMENT_REVIEW_STATUS_COLORS,
  type AchievementReviewRecord,
  type AchievementReviewStatus,
} from "@/data/progress/milestones";

import { ExerciseLabField } from "./ExerciseLabShell";
import {
  formatDate,
  formatDateTime,
  getMilestoneMetric,
  getMilestonePrimaryTag,
  getMilestoneSecondaryTag,
  type MilestoneScope,
} from "./exerciseLabShared";

type Props = {
  canAnimate: boolean;
  closedMilestoneCount: number;
  colors: ThemeColors;
  filteredMilestones: AchievementReviewRecord[];
  fullMotion: boolean;
  isCompact: boolean;
  milestoneNotes: string;
  milestoneScope: MilestoneScope;
  milestoneWorkbenchMotionKey: string;
  onDecision: (status: AchievementReviewStatus) => void;
  onNotesChange: (value: string) => void;
  onOpenClosedMilestones: () => void;
  onScopeChange: (scope: MilestoneScope) => void;
  onSelectMilestone: (id: string) => void;
  pendingMilestoneCount: number;
  reviewViewportHeight: number;
  selectedMilestone: AchievementReviewRecord | null;
};

export function ExerciseLabMilestoneSurface({
  canAnimate,
  closedMilestoneCount,
  colors,
  filteredMilestones,
  fullMotion,
  isCompact,
  milestoneNotes,
  milestoneScope,
  milestoneWorkbenchMotionKey,
  onDecision,
  onNotesChange,
  onOpenClosedMilestones,
  onScopeChange,
  onSelectMilestone,
  pendingMilestoneCount,
  reviewViewportHeight,
  selectedMilestone,
}: Props) {
  const selectedMilestoneMetric = selectedMilestone
    ? getMilestoneMetric(selectedMilestone)
    : null;

  return (
    <div
      style={{
        alignItems: "stretch",
        display: "grid",
        gap: 14,
        gridTemplateColumns: isCompact
          ? "minmax(0, 1fr)"
          : "minmax(236px, 266px) minmax(0, 1fr)",
      }}
    >
      <aside
        style={{
          background: `linear-gradient(180deg, ${colors.surfaceRaised} 0%, ${colors.surface} 100%)`,
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          boxShadow: "0 12px 24px rgba(0,0,0,0.14)",
          display: "grid",
          gap: 10,
          gridTemplateRows: "auto auto auto minmax(0, 1fr)",
          maxHeight: reviewViewportHeight,
          minHeight: 0,
          padding: 12,
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <FitText style={{ fontSize: 18, fontWeight: 800 }}>
            Milestone queue
          </FitText>
          <FitText style={{ color: colors.brand, fontSize: 11.5 }}>
            member progression claims awaiting moderation
          </FitText>
        </div>

        <FitPill
          mode="toggle"
          active={milestoneScope}
          onChange={(value) => onScopeChange(value as MilestoneScope)}
          options={[
            { key: "pending", label: `Pending (${pendingMilestoneCount})` },
            { key: "closed", label: `Closed (${closedMilestoneCount})` },
            { key: "all", label: "All Claims" },
          ]}
        />

        <div
          style={{
            alignItems: "center",
            backgroundColor: `${colors.warning}18`,
            border: `1px solid ${colors.warning}35`,
            borderRadius: 999,
            display: "inline-flex",
            gap: 8,
            justifySelf: "start",
            padding: "6px 10px",
          }}
        >
          <Sparkles size={13} color={colors.warning} />
          <FitText
            style={{
              color: colors.warning,
              fontSize: 10.5,
              fontWeight: 700,
            }}
          >
            workout achievements tied to the rep-tracking progression flow
          </FitText>
        </div>

        <div
          style={{
            display: "grid",
            gap: 12,
            minHeight: 0,
            overflowY: "auto",
            paddingRight: 4,
          }}
        >
          {filteredMilestones.length ? (
            filteredMilestones.map((review, index) => {
              const isActive = review.id === selectedMilestone?.id;
              const queueAnimationDelay = fullMotion
                ? `${Math.min(index, 5) * 38}ms`
                : `${Math.min(index, 5) * 24}ms`;
              const statusColor =
                ACHIEVEMENT_REVIEW_STATUS_COLORS[review.status] ??
                colors.textMuted;

              return (
                <button
                  key={review.id}
                  className={
                    canAnimate
                      ? "exercise-lab-queue-card exercise-lab-queue-card--animated"
                      : "exercise-lab-queue-card"
                  }
                  type="button"
                  onClick={() => onSelectMilestone(review.id)}
                  style={{
                    backgroundColor: isActive
                      ? `${colors.brand}12`
                      : colors.surface,
                    border: `1px solid ${
                      isActive ? `${colors.brand}AA` : colors.border
                    }`,
                    borderRadius: 8,
                    boxShadow: isActive
                      ? "0 12px 26px rgba(0,0,0,0.16)"
                      : "none",
                    cursor: "pointer",
                    display: "grid",
                    gap: 8,
                    padding: 12,
                    textAlign: "left",
                    ...(canAnimate ? { animationDelay: queueAnimationDelay } : {}),
                  }}
                >
                  <div
                    style={{
                      alignItems: "flex-start",
                      display: "flex",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        alignItems: "center",
                        backgroundColor: `${colors.brand}12`,
                        border: `1px solid ${colors.brand}30`,
                        borderRadius: 10,
                        display: "flex",
                        flexShrink: 0,
                        height: 34,
                        justifyContent: "center",
                        width: 34,
                      }}
                    >
                      <FileText size={14} color={colors.brand} />
                    </div>
                    <div style={{ display: "grid", flex: 1, gap: 4, minWidth: 0 }}>
                      <FitText style={{ fontSize: 14, fontWeight: 700 }}>
                        {review.badgeLabel}
                      </FitText>
                      <FitText
                        style={{ color: colors.textSecondary, fontSize: 11.5 }}
                      >
                        {review.memberName.toLowerCase()} /{" "}
                        {review.status === "Pending"
                          ? "proof submitted"
                          : "closed review"}
                      </FitText>
                    </div>
                    <div
                      style={{
                        backgroundColor: isActive
                          ? colors.brand
                          : `${statusColor}66`,
                        borderRadius: 999,
                        minHeight: 46,
                        width: 3,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      backgroundColor: `${statusColor}16`,
                      border: `1px solid ${statusColor}55`,
                      borderRadius: 999,
                      justifySelf: "start",
                      padding: "4px 10px",
                    }}
                  >
                    <FitText style={{ color: statusColor, fontSize: 10 }}>
                      {review.status.toLowerCase()}
                    </FitText>
                  </div>
                </button>
              );
            })
          ) : (
            <EmptyMilestoneState colors={colors} />
          )}
        </div>
      </aside>

      <section
        style={{
          background: `linear-gradient(180deg, ${colors.surfaceRaised} 0%, ${colors.surface} 100%)`,
          border: `1px solid ${colors.border}`,
          borderRadius: 22,
          boxShadow: "0 18px 34px rgba(0,0,0,0.18)",
          display: "grid",
          gap: 12,
          minHeight: 0,
          padding: 14,
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <StatusChip
              backgroundColor="rgba(46, 196, 242, 0.15)"
              borderColor="rgba(46, 196, 242, 0.3)"
              color="#7DE2FF"
              label="Pending queue"
            />
            <StatusChip
              backgroundColor={`${colors.brand}10`}
              borderColor={`${colors.brand}30`}
              color={colors.brand}
              label="Closed reviews"
            />
          </div>
          <FitText style={{ fontSize: 20, fontWeight: 800 }}>
            Milestone review
          </FitText>
          <FitText style={{ color: colors.textSecondary, fontSize: 11.5 }}>
            Inspect proof, member context, and reviewer notes before approving
            or rejecting the milestone claim.
          </FitText>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          {selectedMilestone ? (
            <div
              key={milestoneWorkbenchMotionKey}
              className={
                canAnimate
                  ? "exercise-lab-workbench-body exercise-lab-workbench-body--animated"
                  : "exercise-lab-workbench-body"
              }
              style={{ display: "grid", gap: 14 }}
            >
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: isCompact
                    ? "minmax(0, 1fr)"
                    : "minmax(0, 1fr) minmax(300px, 400px)",
                }}
              >
                <div
                  style={{
                    backgroundColor: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 22,
                    display: "grid",
                    gap: 10,
                    padding: 14,
                  }}
                >
                  <StatusChip
                    backgroundColor={`${colors.brand}10`}
                    borderColor={`${colors.brand}35`}
                    color={colors.brand}
                    label="proof image"
                  />
                  <div style={{ display: "grid", gap: 4 }}>
                    <FitText style={{ fontSize: 16, fontWeight: 800 }}>
                      Proof preview
                    </FitText>
                    <FitText
                      style={{ color: colors.textSecondary, fontSize: 11 }}
                    >
                      submitted workout proof / achievement evidence
                    </FitText>
                  </div>
                  <div
                    style={{
                      backgroundColor: colors.surfaceRaised,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 18,
                      display: "grid",
                      gap: 10,
                      padding: 16,
                    }}
                  >
                    <img
                      src={selectedMilestone.proofImageUrl}
                      alt={`${selectedMilestone.badgeLabel} proof preview`}
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 16,
                        height: 170,
                        objectFit: "cover",
                        width: "100%",
                      }}
                    />
                    <FitText
                      style={{ color: colors.textSecondary, fontSize: 11.5 }}
                    >
                      {selectedMilestone.proofCaption}
                    </FitText>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 22,
                    display: "grid",
                    gap: 10,
                    padding: 14,
                  }}
                >
                  <FitText style={{ fontSize: 16, fontWeight: 800 }}>
                    Claim summary
                  </FitText>
                  <div
                    style={{
                      alignItems: "center",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 18,
                    }}
                  >
                    <div
                      style={{
                        border: `3px solid ${colors.brand}`,
                        borderRadius: "50%",
                        display: "grid",
                        height: 68,
                        placeItems: "center",
                        width: 68,
                      }}
                    >
                      <div style={{ display: "grid", placeItems: "center" }}>
                        <FitText
                          style={{
                            color: colors.textPrimary,
                            fontSize: 22,
                            fontWeight: 800,
                          }}
                        >
                          {selectedMilestoneMetric?.value}
                        </FitText>
                        <FitText
                          style={{ color: colors.textMuted, fontSize: 9.5 }}
                        >
                          {selectedMilestoneMetric?.label}
                        </FitText>
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 10 }}>
                      {[
                        getMilestonePrimaryTag(selectedMilestone),
                        getMilestoneSecondaryTag(selectedMilestone),
                      ].map((tag) => (
                        <StatusChip
                          key={tag}
                          backgroundColor={`${colors.brand}10`}
                          borderColor={`${colors.brand}35`}
                          color={colors.textPrimary}
                          label={tag.toLowerCase()}
                        />
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenClosedMilestones}
                    style={{
                      alignItems: "center",
                      backgroundColor: "rgba(46, 56, 71, 0.95)",
                      border: "1px solid rgba(82, 102, 133, 0.75)",
                      borderRadius: 16,
                      color: "#dbe8f7",
                      cursor: "pointer",
                      display: "flex",
                      gap: 12,
                      justifyContent: "space-between",
                      padding: "14px 18px",
                    }}
                  >
                    <span>Open claim history</span>
                    <PanelRightOpen size={16} />
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 14,
                  gridTemplateColumns: isCompact
                    ? "minmax(0, 1fr)"
                    : "minmax(0, 1fr) minmax(0, 1fr)",
                }}
              >
                <MilestoneInfoCard
                  colors={colors}
                  icon={<FileText size={13} color={colors.brand} />}
                  title="Member context"
                  rows={[
                    `member: ${selectedMilestone.memberName.toLowerCase()}`,
                    "source: workout progression",
                    `submitted: ${formatDate(selectedMilestone.submittedAt)}`,
                  ]}
                />
                <MilestoneInfoCard
                  colors={colors}
                  icon={<ShieldCheck size={13} color={colors.brand} />}
                  title="Review state"
                  rows={[
                    `status: ${selectedMilestone.status.toLowerCase()}`,
                    `reviewer note: ${
                      selectedMilestone.reviewerNotes?.trim() ||
                      "proof matches log"
                    }`,
                    `reviewed: ${formatDateTime(selectedMilestone.reviewedAt)}`,
                  ]}
                />
              </div>

              <div
                className={
                  canAnimate
                    ? "exercise-lab-action-dock exercise-lab-action-dock--animated"
                    : "exercise-lab-action-dock"
                }
                style={{
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 20,
                  boxShadow: "0 12px 24px rgba(0,0,0,0.12)",
                  display: "grid",
                  gap: 10,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    backgroundColor: colors.brand,
                    borderRadius: 999,
                    height: 4,
                  }}
                />
                <div
                  style={{
                    display: "grid",
                    gap: 14,
                    gridTemplateColumns: isCompact
                      ? "minmax(0, 1fr)"
                      : "minmax(0, 1.1fr) minmax(0, 0.9fr)",
                  }}
                >
                  <ExerciseLabField
                    label="Reviewer note"
                    hint="Required before rejecting. Saved with the moderation decision."
                  >
                    <div
                      style={{
                        backgroundColor: colors.fieldBg,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 14,
                        padding: "12px 14px",
                      }}
                    >
                      <FitTextArea
                        name="milestoneReviewerNotes"
                        rows={3}
                        value={milestoneNotes}
                        onChange={(event) => onNotesChange(event.target.value)}
                        placeholder="Add a note for the claim audit trail."
                      />
                    </div>
                  </ExerciseLabField>

                  <div
                    style={{
                      display: "grid",
                      gap: 10,
                      gridTemplateColumns: isCompact
                        ? "minmax(0, 1fr)"
                        : "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.85fr)",
                    }}
                  >
                    <MilestoneActionButton
                      disabled={selectedMilestone.status !== "Pending"}
                      label="Approve claim"
                      sublabel="mark milestone earned"
                      variant="primary"
                      onClick={() => onDecision("Approved")}
                    />
                    <MilestoneActionButton
                      label="Closed reviews"
                      sublabel="see recent decisions"
                      variant="ghost"
                      onClick={onOpenClosedMilestones}
                    />
                    <MilestoneActionButton
                      disabled={selectedMilestone.status !== "Pending"}
                      label="Reject claim"
                      sublabel="decline submission"
                      variant="ghost"
                      onClick={() => onDecision("Rejected")}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyMilestoneState colors={colors} large />
          )}
        </div>
      </section>
    </div>
  );
}

function EmptyMilestoneState({
  colors,
  large = false,
}: {
  colors: ThemeColors;
  large?: boolean;
}) {
  return (
    <div
      style={{
        backgroundColor: colors.surface,
        border: `1px dashed ${colors.border}`,
        borderRadius: large ? 24 : 8,
        padding: large ? 20 : 18,
      }}
    >
      <FitText style={{ color: colors.textSecondary, fontSize: large ? 14 : 13 }}>
        No milestone claims match the current filter.
      </FitText>
    </div>
  );
}

function MilestoneActionButton({
  disabled,
  label,
  onClick,
  sublabel,
  variant,
}: {
  disabled?: boolean;
  label: string;
  onClick: () => void;
  sublabel: string;
  variant: "primary" | "ghost";
}) {
  return (
    <FitButton
      label={label}
      variant={variant}
      onClick={onClick}
      disabled={disabled}
      style={{
        justifyContent: "flex-start",
        minHeight: 64,
        paddingInline: 16,
      }}
    >
      <div style={{ display: "grid", gap: 2, textAlign: "left" }}>
        <span style={{ fontWeight: 800 }}>{label}</span>
        <span style={{ fontSize: 10.5, opacity: 0.82 }}>{sublabel}</span>
      </div>
    </FitButton>
  );
}

function MilestoneInfoCard({
  colors,
  icon,
  rows,
  title,
}: {
  colors: ThemeColors;
  icon: ReactNode;
  rows: string[];
  title: string;
}) {
  return (
    <div
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 20,
        display: "grid",
        gap: 6,
        padding: 14,
      }}
    >
      <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
        <div
          style={{
            backgroundColor: `${colors.brand}12`,
            border: `1px solid ${colors.brand}30`,
            borderRadius: 8,
            display: "grid",
            height: 28,
            placeItems: "center",
            width: 28,
          }}
        >
          {icon}
        </div>
        <FitText style={{ fontSize: 16, fontWeight: 700 }}>{title}</FitText>
      </div>
      {rows.map((row) => (
        <FitText
          key={row}
          style={{ color: colors.textSecondary, fontSize: 11.5 }}
        >
          {row}
        </FitText>
      ))}
    </div>
  );
}

function StatusChip({
  backgroundColor,
  borderColor,
  color,
  label,
}: {
  backgroundColor: string;
  borderColor: string;
  color: string;
  label: string;
}) {
  return (
    <div
      style={{
        backgroundColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 999,
        justifySelf: "start",
        padding: "4px 10px",
      }}
    >
      <FitText style={{ color, fontSize: 10 }}>{label}</FitText>
    </div>
  );
}
