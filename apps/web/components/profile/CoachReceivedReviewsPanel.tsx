"use client";

import { useQuery } from "@tanstack/react-query";
import type { CoachReceivedReviewRecord } from "@fittrack/api-client";

import { FitText } from "@/components/fit";
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
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["coach", "received-reviews", user?.id],
    queryFn: () => webApiClient.coaches.listReceivedReviews(),
    enabled: isCoach,
  });

  if (!isCoach) return null;

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        padding: 16,
        borderRadius: 18,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surface,
      }}
    >
      <FitText style={{ fontSize: 16, fontWeight: 900, color: colors.textPrimary }}>
        Received Member Feedback
      </FitText>
      <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
        Reviews submitted by members after completed coaching sessions.
      </FitText>
      {isLoading ? (
        <FitText style={{ fontSize: 12, color: colors.textSecondary }}>Loading coach reviews...</FitText>
      ) : reviews.length === 0 ? (
        <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
          No member reviews have been submitted yet.
        </FitText>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
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
