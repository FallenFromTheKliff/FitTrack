"use client";

import { FitButton, FitPagination, FitPill, FitText } from "@/components/fit";
import { useTheme } from "@/contexts/ThemeContext";
import { ACHIEVEMENT_REVIEW_STATUS_COLORS } from "@/data/members/members";
import type {
  AchievementReviewRecord,
  AchievementReviewStatus,
} from "@/data/members/members";

type Props = {
  closedCount: number;
  countLabel: string;
  currentPage: number;
  motionKey?: string;
  onOpenReview: (review: AchievementReviewRecord) => void;
  onPageChange: (page: number) => void;
  pageSize: number;
  pendingCount: number;
  reviewFilter: string;
  reviews: AchievementReviewRecord[];
  totalPages: number;
  totalReviews: number;
};

function formatReviewDate(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getStatusAccent(
  status: AchievementReviewStatus,
  fallback: string,
) {
  return ACHIEVEMENT_REVIEW_STATUS_COLORS[status] ?? fallback;
}

function getCardSurfaceColor(
  status: AchievementReviewStatus,
  colors: ReturnType<typeof useTheme>["colors"],
) {
  switch (status) {
    case "Pending":
      return `${colors.warning}12`;
    case "Approved":
      return `${colors.success}10`;
    case "Rejected":
      return `${colors.danger}10`;
    default:
      return colors.surface;
  }
}

export default function MembersReviewRail({
  closedCount,
  countLabel,
  currentPage,
  motionKey,
  onOpenReview,
  onPageChange,
  pageSize,
  pendingCount,
  reviewFilter,
  reviews,
  totalPages,
  totalReviews,
}: Props) {
  const { colors } = useTheme();
  const pageStart = totalReviews === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = totalReviews === 0 ? 0 : Math.min(totalReviews, currentPage * pageSize);

  return (
    <section
      className="members-review-panel"
      style={{
        display: "grid",
        gap: 16,
      }}
    >
      <div
        className="members-review-panel__body"
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 304px)",
          alignItems: "start",
        }}
      >
        <div
          className="members-review-panel__queue"
          style={{
            display: "grid",
            gap: 16,
            padding: 18,
            borderRadius: 24,
            border: `1px solid ${colors.border}`,
            background: `linear-gradient(180deg, ${colors.surfaceRaised} 0%, ${colors.surface} 100%)`,
            boxShadow: "0 16px 30px rgba(0,0,0,0.14)",
          }}
        >
          <div
            className="members-review-panel__header"
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "grid", gap: 4, maxWidth: 720 }}>
              <FitText style={{ fontSize: 20, fontWeight: 800, color: colors.textPrimary, lineHeight: 1.05 }}>
                Milestone approvals
              </FitText>
              <FitText style={{ fontSize: 12.5, lineHeight: 1.5, color: colors.textSecondary }}>
                Photo previews and recent notes stay visible enough to make a milestone decision quickly.
              </FitText>
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "7px 11px",
                borderRadius: 999,
                border: `1px solid ${colors.brand}33`,
                backgroundColor: `${colors.brand}12`,
              }}
            >
              <FitText style={{ fontSize: 10.5, fontWeight: 700, color: colors.brand, letterSpacing: "0.06em" }}>
                {countLabel}
              </FitText>
            </div>
          </div>

          <div key={motionKey} className="members-review-panel__list" style={{ display: "grid", gap: 12 }}>
            {reviews.length > 0 ? (
              reviews.map((review) => {
                const accent = getStatusAccent(review.status, colors.textMuted);

                return (
                  <article
                    key={review.id}
                    className="members-review-card"
                    style={{
                      display: "grid",
                      gap: 14,
                      padding: 14,
                      borderRadius: 24,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: getCardSurfaceColor(review.status, colors),
                      boxShadow: "0 14px 28px rgba(0,0,0,0.08)",
                    }}
                  >
                    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                      <img
                        src={review.proofImageUrl}
                        alt={`${review.badgeLabel} proof preview`}
                        style={{
                          width: 96,
                          height: 96,
                          objectFit: "cover",
                          borderRadius: 18,
                          border: `1px solid ${colors.border}`,
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ minWidth: 0, display: "grid", gap: 10, flex: 1 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <FitText style={{ fontSize: 16, fontWeight: 800, color: colors.textPrimary }}>
                            {review.badgeLabel}
                          </FitText>
                          <FitPill
                            mode="status"
                            label={review.status}
                            color={accent}
                            fontSize={11}
                          />
                        </div>
                        <div style={{ display: "grid", gap: 4 }}>
                          <FitText style={{ fontSize: 12.5, fontWeight: 700, color: colors.textPrimary }}>
                            {review.memberName}
                          </FitText>
                          <FitText style={{ fontSize: 11.5, color: colors.textMuted }}>
                            Submitted {formatReviewDate(review.submittedAt)}
                          </FitText>
                          <FitText style={{ fontSize: 12, lineHeight: 1.6, color: colors.textSecondary }}>
                            {review.proofCaption}
                          </FitText>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                          <FitText style={{ fontSize: 11.5, color: colors.textSecondary }}>
                            {review.memberEmail}
                          </FitText>
                          <FitButton
                            variant="ghost"
                            label="Review milestone"
                            onClick={() => onOpenReview(review)}
                            style={{
                              border: `1px solid ${colors.brand}24`,
                              backgroundColor: `${colors.brand}10`,
                              color: colors.brand,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div
                style={{
                  padding: 18,
                  borderRadius: 20,
                  border: `1px dashed ${colors.border}`,
                  backgroundColor: `${colors.surface}d8`,
                }}
              >
                <FitText style={{ fontSize: 13, lineHeight: 1.65, color: colors.textSecondary }}>
                  No milestone reviews match the current filter. Try another status or return to the directory.
                </FitText>
              </div>
            )}
          </div>

          {totalReviews > 0 ? (
            <div
              key={`${motionKey ?? "stable"}-footer`}
              className="members-review-panel__footer members-review-panel__footer--animated"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
                Showing {pageStart} - {pageEnd} of {totalReviews}
              </FitText>
              <FitPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={onPageChange}
                ariaLabel="Milestone approval pagination"
              />
            </div>
          ) : null}
        </div>

        <aside
          className="members-review-panel__summary"
          style={{
            display: "grid",
            gap: 14,
            padding: 18,
            borderRadius: 24,
            border: `1px solid ${colors.border}`,
            background: `linear-gradient(180deg, ${colors.surfaceRaised} 0%, ${colors.surface} 100%)`,
            boxShadow: "0 16px 30px rgba(0,0,0,0.14)",
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <FitText style={{ fontSize: 20, fontWeight: 800, color: colors.textPrimary, lineHeight: 1.05 }}>
              At a glance
            </FitText>
            <FitText style={{ fontSize: 12.5, lineHeight: 1.5, color: colors.textSecondary }}>
              Keep review metrics visible, but secondary to the current milestone decision.
            </FitText>
          </div>

          {[
            { label: "Pending now", value: `${pendingCount}` },
            { label: "Closed in queue", value: `${closedCount}` },
            { label: "Current filter", value: reviewFilter === "Pending" ? "Waiting" : reviewFilter },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                display: "grid",
                gap: 6,
                padding: "14px 16px",
                borderRadius: 18,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.textPrimary,
              }}
            >
              <FitText style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, letterSpacing: "0.08em" }}>
                {item.label}
              </FitText>
              <FitText style={{ fontSize: 18, fontWeight: 800, color: colors.surfaceRaised }}>
                {item.value}
              </FitText>
            </div>
          ))}

          <FitText style={{ fontSize: 12.5, lineHeight: 1.6, color: colors.textSecondary }}>
            Approve or ask for another submission from the focused review overlay.
          </FitText>
        </aside>
      </div>

      <style>{`
        @keyframes members-review-panel-in {
          0% {
            opacity: 0;
            transform: translateY(14px) scale(0.985);
          }

          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes members-review-card-in {
          0% {
            opacity: 0;
            transform: translateY(16px) scale(0.992);
          }

          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes members-review-footer-in {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }

          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .members-review-panel__queue,
        .members-review-panel__summary {
          animation: members-review-panel-in 240ms cubic-bezier(0.18, 0.88, 0.24, 1) both;
        }

        .members-review-card {
          animation: members-review-card-in 280ms cubic-bezier(0.18, 0.88, 0.24, 1) both;
          transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 180ms cubic-bezier(0.2, 0.8, 0.2, 1), border-color 180ms ease;
        }

        .members-review-panel__footer--animated {
          animation: members-review-footer-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1) 90ms both;
        }

        .members-review-card:hover {
          transform: translateY(-3px) scale(1.004);
          box-shadow: 0 22px 38px rgba(0, 0, 0, 0.16);
        }

        .members-review-card:nth-child(1) {
          animation-delay: 45ms;
        }

        .members-review-card:nth-child(2) {
          animation-delay: 90ms;
        }

        .members-review-card:nth-child(3) {
          animation-delay: 135ms;
        }

        @media (max-width: 1040px) {
          .members-review-panel__body {
            grid-template-columns: 1fr !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .members-review-panel__queue,
          .members-review-panel__summary,
          .members-review-card,
          .members-review-panel__footer--animated {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </section>
  );
}
