"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AppFeedbackRecord, VenueFeedbackRecord } from "@fittrack/api-client";

import { FitText } from "@/components/fit";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { webApiClient } from "@/lib/api-client";

function formatFeedbackDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function formatCategory(value: string) {
  return value.replaceAll("_", " ");
}

function FeedbackListCard({ children, title }: { children: ReactNode; title: string }) {
  const { colors } = useTheme();

  return (
    <div
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 16,
        display: "grid",
        gap: 12,
        padding: 16,
      }}
    >
      <FitText style={{ color: colors.textPrimary, fontSize: 16, fontWeight: 900 }}>{title}</FitText>
      {children}
    </div>
  );
}

function AppFeedbackList({ entries }: { entries: AppFeedbackRecord[] }) {
  const { colors } = useTheme();

  if (entries.length === 0) {
    return <FitText style={{ color: colors.textSecondary, fontSize: 12 }}>No app feedback submitted yet.</FitText>;
  }

  return (
    <div style={{ display: "grid", gap: 10, maxHeight: 360, overflowY: "auto", paddingRight: 4 }}>
      {entries.map((entry) => (
        <div
          key={entry.id}
          style={{
            backgroundColor: colors.surfaceRaised,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            display: "grid",
            gap: 6,
            padding: "12px 14px",
          }}
        >
          <FitText style={{ color: colors.textPrimary, fontSize: 12.5, fontWeight: 800 }}>
            {entry.submitted_by.name} / {entry.submitted_by.role}
          </FitText>
          <FitText style={{ color: colors.textSecondary, fontSize: 11 }}>
            {formatCategory(entry.category)} / {formatFeedbackDate(entry.created_at)}
          </FitText>
          <FitText style={{ color: colors.textPrimary, fontSize: 12, lineHeight: 1.5 }}>{entry.message}</FitText>
        </div>
      ))}
    </div>
  );
}

function VenueFeedbackList({ entries }: { entries: VenueFeedbackRecord[] }) {
  const { colors } = useTheme();

  if (entries.length === 0) {
    return <FitText style={{ color: colors.textSecondary, fontSize: 12 }}>No facility or venue feedback submitted yet.</FitText>;
  }

  return (
    <div style={{ display: "grid", gap: 10, maxHeight: 360, overflowY: "auto", paddingRight: 4 }}>
      {entries.map((entry) => (
        <div
          key={entry.id}
          style={{
            backgroundColor: colors.surfaceRaised,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            display: "grid",
            gap: 6,
            padding: "12px 14px",
          }}
        >
          <FitText style={{ color: colors.textPrimary, fontSize: 12.5, fontWeight: 800 }}>
            {entry.amenity.name} / {entry.amenity.type}
          </FitText>
          <FitText style={{ color: colors.textSecondary, fontSize: 11 }}>
            {entry.submitted_by.name} / {entry.submitted_by.role} / Rating {entry.rating}/5 / {formatFeedbackDate(entry.created_at)}
          </FitText>
          <FitText style={{ color: colors.textPrimary, fontSize: 12, lineHeight: 1.5 }}>
            {entry.comment ?? "No written comment."}
          </FitText>
        </div>
      ))}
    </div>
  );
}

export default function FeedbackInboxSection() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const canViewFeedbackInbox = user?.role === "ADMIN" || user?.role === "STAFF";
  const { data: appFeedback = [], isLoading: appFeedbackLoading } = useQuery({
    enabled: canViewFeedbackInbox,
    queryFn: () => webApiClient.users.listAppFeedback(),
    queryKey: ["settings", "app-feedback-inbox"],
  });
  const { data: venueFeedback = [], isLoading: venueFeedbackLoading } = useQuery({
    enabled: canViewFeedbackInbox,
    queryFn: () => webApiClient.venues.listFeedback(),
    queryKey: ["settings", "venue-feedback-inbox"],
  });

  if (!canViewFeedbackInbox) return null;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <FeedbackListCard title="Feedback Inbox">
        <FitText style={{ color: colors.textSecondary, fontSize: 12 }}>
          Review member-submitted app and facility feedback from the live database.
        </FitText>
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <FitText style={{ color: colors.brand, fontSize: 13, fontWeight: 800 }}>App Feedback</FitText>
            {appFeedbackLoading ? (
              <FitText style={{ color: colors.textSecondary, fontSize: 12 }}>Loading app feedback...</FitText>
            ) : (
              <AppFeedbackList entries={appFeedback} />
            )}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <FitText style={{ color: colors.brand, fontSize: 13, fontWeight: 800 }}>Facility / Venue Feedback</FitText>
            {venueFeedbackLoading ? (
              <FitText style={{ color: colors.textSecondary, fontSize: 12 }}>Loading facility feedback...</FitText>
            ) : (
              <VenueFeedbackList entries={venueFeedback} />
            )}
          </div>
        </div>
      </FeedbackListCard>
    </div>
  );
}
