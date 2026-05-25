export type AchievementReviewStatus = "Pending" | "Approved" | "Rejected";

export type AchievementReviewRecord = {
  badgeLabel: string;
  id: string;
  memberEmail: string;
  memberId: string;
  memberInitials: string;
  memberName: string;
  proofCaption: string;
  proofImageUrl: string;
  reviewedAt?: string;
  reviewerNotes?: string;
  status: AchievementReviewStatus;
  submittedAt: string;
};

export const ACHIEVEMENT_REVIEW_STATUS_COLORS: Record<
  AchievementReviewStatus,
  string
> = {
  Pending: "var(--fit-warning)",
  Approved: "var(--fit-success)",
  Rejected: "var(--fit-danger)",
};
