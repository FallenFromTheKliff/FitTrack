"use client";

import { useQuery } from "@tanstack/react-query";
import type { CoachReceivedReviewRecord } from "@fittrack/api-client";

import { FitPill, FitText } from "@/components/fit";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { webApiClient } from "@/lib/api-client";

function formatReviewDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export default function CoachReceivedReviewsPanel() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const isCoach = user?.role === "COACH";
  const { data: reviews = [], isError, isLoading } = useQuery({
    queryKey: ["coach", "received-reviews", user?.id],
    queryFn: () => webApiClient.coaches.listReceivedReviews(),
    enabled: isCoach,
  });
  const averageRating = reviews.length
    ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length
    : 0;

  if (!isCoach) return null;

  return (
    <div
      style={{
        display: "grid",
        gap: 16,
        padding: 20,
        borderRadius: 18,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surface,
      }}
    >
      <div
        style={{
          alignItems: "flex-start",
          display: "flex",
          gap: 16,
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <FitText style={{ color: colors.textPrimary, fontSize: 18, fontWeight: 900 }}>
            Received member feedback
          </FitText>
          <FitText style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 1.5, marginTop: 4 }}>
            Reviews submitted after completed coaching sessions.
          </FitText>
        </div>
        {reviews.length > 0 ? (
          <FitPill
            mode="status"
            label={`${averageRating.toFixed(1)} / 5 · ${reviews.length} ${reviews.length === 1 ? "review" : "reviews"}`}
            color={colors.brand}
            fontSize={10}
            fontWeight={800}
            borderOpacity="35"
            bgOpacity="14"
            style={{ borderRadius: 6, flexShrink: 0 }}
          />
        ) : null}
      </div>
      {isLoading ? (
        <FitText style={{ fontSize: 12, color: colors.textSecondary }}>Loading coach reviews...</FitText>
      ) : isError ? (
        <FitText style={{ color: colors.danger, fontSize: 12, lineHeight: 1.5 }}>
          Member feedback is temporarily unavailable. Try refreshing this page.
        </FitText>
      ) : reviews.length === 0 ? (
        <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
          No member reviews have been submitted yet.
        </FitText>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          }}
        >
          {reviews.map((review: CoachReceivedReviewRecord) => (
            <div
              key={review.id}
              style={{
                display: "grid",
                gap: 6,
                padding: "12px 14px",
                borderRadius: 12,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surfaceRaised,
                minWidth: 0,
              }}
            >
              <FitText style={{ fontSize: 12.5, fontWeight: 800, color: colors.textPrimary }}>
                {review.reviewer.name} / {review.rating}/5
              </FitText>
              <FitText style={{ fontSize: 11, color: colors.textSecondary }}>
                Session: {formatReviewDate(review.scheduled_at)}
              </FitText>
              <FitText style={{ fontSize: 11, color: colors.textSecondary }}>
                Submitted: {formatReviewDate(review.created_at)}
              </FitText>
              <FitText style={{ fontSize: 12, color: colors.textPrimary, lineHeight: 1.5 }}>
                {review.comment?.trim() ? review.comment : "No written comment provided."}
              </FitText>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
