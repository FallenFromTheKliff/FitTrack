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

function buildProofPreview(
  initials: string,
  badgeLabel: string,
  accentColor: string,
) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200" fill="none">
      <rect width="320" height="200" rx="24" fill="#161616"/>
      <rect x="18" y="18" width="284" height="164" rx="18" fill="#1F1F1F" stroke="${accentColor}" stroke-width="2"/>
      <rect x="34" y="34" width="92" height="92" rx="20" fill="${accentColor}" opacity="0.22"/>
      <text x="80" y="92" text-anchor="middle" fill="${accentColor}" font-size="28" font-family="Arial, sans-serif" font-weight="700">${initials}</text>
      <text x="34" y="152" fill="#FFFFFF" font-size="19" font-family="Arial, sans-serif" font-weight="700">${badgeLabel}</text>
      <text x="34" y="174" fill="#A1A1AA" font-size="12" font-family="Arial, sans-serif">Milestone proof attached for moderator review</text>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const ACHIEVEMENT_REVIEW_STATUS_COLORS: Record<
  AchievementReviewStatus,
  string
> = {
  Pending: "var(--fit-warning)",
  Approved: "var(--fit-success)",
  Rejected: "var(--fit-danger)",
};

export const ACHIEVEMENT_REVIEW_SEED: AchievementReviewRecord[] = [
  {
    id: "review-50-workouts",
    memberId: "member-active-seed",
    memberName: "Ava Rivera",
    memberInitials: "AR",
    memberEmail: "seed.member.active@fittrack.com",
    badgeLabel: "50 Workouts Milestone",
    proofCaption:
      "Locker mirror photo plus workout summary after the fiftieth completed session.",
    proofImageUrl: buildProofPreview("AR", "50 Workouts", "#E87722"),
    reviewerNotes: "",
    status: "Pending",
    submittedAt: "2026-04-09T09:30:00.000Z",
  },
  {
    id: "review-strength-streak",
    memberId: "member-premium-seed",
    memberName: "Luca Dela Cruz",
    memberInitials: "LD",
    memberEmail: "seed.member.premium@fittrack.com",
    badgeLabel: "Strength Streak Milestone",
    proofCaption:
      "Coach-signed lift log photo and class recap for the streak milestone request.",
    proofImageUrl: buildProofPreview("LD", "Strength Streak", "#F59E0B"),
    reviewerNotes:
      "Pending a quick moderator review of the attached streak summary.",
    status: "Pending",
    submittedAt: "2026-04-08T16:15:00.000Z",
  },
  {
    id: "review-boxing-badge",
    memberId: "member-expired-seed",
    memberName: "Ivy Navarro",
    memberInitials: "IN",
    memberEmail: "seed.member.expired@fittrack.com",
    badgeLabel: "Boxing Fundamentals Milestone",
    proofCaption:
      "Wrapped-hands proof photo reviewed during the previous moderation batch.",
    proofImageUrl: buildProofPreview("IN", "Boxing Basics", "#22C55E"),
    reviewerNotes:
      "Approved after matching the proof photo to the completed session history.",
    status: "Approved",
    reviewedAt: "2026-04-07T12:40:00.000Z",
    submittedAt: "2026-04-07T08:10:00.000Z",
  },
];
