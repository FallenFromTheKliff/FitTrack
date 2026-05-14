"use client";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  gymLayoutEquipmentQueryOptions,
  submitVenueFeedbackMutationOptions,
  venueFeedbackQueryOptions,
} from "@fittrack/query";
import { listVenueEquipment } from "@fittrack/types";
import { buildRenderableAssetUrl } from "@fittrack/utils";

import { useTheme } from "@/contexts/ThemeContext";
import { WEB_API_BASE_URL, webApiClient } from "@/lib/api-client";
import { FACILITY_FLOOR_MAP, type FloorVenueRecord } from "@/data/facilities/floorPlans";
import { getVenueIcon } from "@/data/facilities/mapTypes";
import FitButton from "@/components/fit/FitButton";
import { FitText, FitTextArea } from "@/components/fit/FitText";
import FitModal from "@/components/modals/FitModal";

type Props = {
  venue: FloorVenueRecord | null;
  isOpen: boolean;
  onClose: () => void;
};

type VenueDetailsContentProps = {
  venue: FloorVenueRecord | null;
  equipmentQueryEnabled?: boolean;
  variant?: "modal" | "rail";
};

function buildHeroImage(name: string, accent: string, background: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${background}" />
          <stop offset="100%" stop-color="${accent}" />
        </linearGradient>
      </defs>
      <rect width="1200" height="675" fill="url(#bg)" rx="36" />
      <rect x="88" y="92" width="1024" height="491" rx="28" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)" />
      <text x="600" y="322" font-size="68" font-family="Arial, sans-serif" font-weight="700" fill="white" text-anchor="middle">${name}</text>
      <text x="600" y="382" font-size="28" font-family="Arial, sans-serif" fill="rgba(255,255,255,0.82)" text-anchor="middle">FitTrack Venue Preview</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getVenueDetailsSubtitle(venue: FloorVenueRecord) {
  return `${FACILITY_FLOOR_MAP[venue.floorId].label} | ${
    venue.isReservable === false ? "Facility zone" : "Reservable venue"
  }`;
}

export default function VenueDetailsModal({ venue, isOpen, onClose }: Props) {
  if (!venue) return null;

  return (
    <FitModal
      isOpen={isOpen}
      onClose={onClose}
      title={venue.name}
      subtitle={getVenueDetailsSubtitle(venue)}
      maxWidth={520}
      closeAriaLabel="Close venue details"
    >
      <VenueDetailsContent venue={venue} equipmentQueryEnabled={isOpen} />
    </FitModal>
  );
}

export function VenueDetailsContent({
  venue,
  equipmentQueryEnabled = true,
  variant = "modal",
}: VenueDetailsContentProps) {
  const { colors } = useTheme();
  const Icon = useMemo(() => getVenueIcon(venue?.iconKey), [venue?.iconKey]);
  const feedbackQuery = useQuery({
    ...venueFeedbackQueryOptions(webApiClient, venue?.id),
    enabled: !!venue,
  });
  const feedbackMutation = useMutation({
    ...submitVenueFeedbackMutationOptions(webApiClient),
    onSuccess: async () => {
      await feedbackQuery.refetch();
    },
  });
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackState, setFeedbackState] = useState<{
    text: string;
    tone: "danger" | "success";
  } | null>(null);
  const { data: liveEquipment = [] } = useQuery({
    ...gymLayoutEquipmentQueryOptions(webApiClient),
    enabled: !!venue && equipmentQueryEnabled,
  });

  useEffect(() => {
    setFeedbackRating(5);
    setFeedbackComment("");
    setFeedbackState(null);
  }, [variant, venue?.id]);

  if (!venue) return null;

  const subtitle = getVenueDetailsSubtitle(venue);
  const heroImage =
    buildRenderableAssetUrl({
      apiBaseUrl: WEB_API_BASE_URL,
      assetUrl: venue.imageUrl ?? null,
    }) ?? buildHeroImage(venue.name, colors.brand, colors.surfaceRaised);
  const assignedEquipment = listVenueEquipment(liveEquipment, venue);
  const venueFeedback = feedbackQuery.data ?? [];
  const averageRating =
    venueFeedback.length > 0
      ? venueFeedback.reduce((sum, entry) => sum + entry.rating, 0) /
        venueFeedback.length
      : null;
  const infoItems = [
    { label: "Capacity", value: String(venue.capacity ?? "N/A") },
    { label: "Minimum Hours", value: `${venue.minimumHours ?? 1}` },
    { label: "Rate", value: venue.hourlyRate ? `PHP ${venue.hourlyRate}/hr` : "Facility only" },
    { label: "Grid Zone", value: `C${venue.gridColumn ?? 1} / R${venue.gridRow ?? 1}` },
  ];

  if (variant === "rail") {
    const visibleEquipment = assignedEquipment.slice(0, 3);

    return (
      <div
        style={{
          alignContent: "center",
          display: "grid",
          gap: 10,
          justifyItems: "center",
          minWidth: 0,
          textAlign: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            overflow: "hidden",
            borderRadius: 10,
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.surfaceRaised,
          }}
        >
          <img
            src={heroImage}
            alt={`${venue.name} preview`}
            style={{
              display: "block",
              width: "100%",
              aspectRatio: "16 / 7",
              objectFit: "cover",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: "auto 8px 8px 8px",
              display: "grid",
              gridTemplateColumns: "30px minmax(0, 1fr)",
              alignItems: "center",
              gap: 8,
              padding: "8px 9px",
              borderRadius: 8,
              backgroundColor: "rgba(0,0,0,0.38)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                display: "grid",
                placeItems: "center",
                backgroundColor: "rgba(255,255,255,0.14)",
                color: "#fff",
              }}
            >
              <Icon size={16} strokeWidth={2} />
            </div>
            <div style={{ minWidth: 0, textAlign: "left" }}>
              <FitText
                style={{
                  color: "#fff",
                  display: "block",
                  fontSize: 13,
                  fontWeight: 900,
                  lineHeight: 1.12,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {venue.name}
              </FitText>
              <FitText
                style={{
                  color: "rgba(255,255,255,0.82)",
                  display: "block",
                  fontSize: 10.5,
                  lineHeight: 1.25,
                  marginTop: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {subtitle}
              </FitText>
            </div>
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gap: 7,
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            width: "100%",
          }}
        >
          {infoItems.map((item) => (
            <div
              key={item.label}
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                backgroundColor: colors.surfaceRaised,
                display: "grid",
                gap: 3,
                minWidth: 0,
                padding: "8px 9px",
              }}
            >
              <FitText style={{ color: colors.textMuted, fontSize: 9.5, fontWeight: 800 }}>
                {item.label}
              </FitText>
              <FitText style={{ fontSize: 12, fontWeight: 850 }}>
                {item.value}
              </FitText>
            </div>
          ))}
        </div>
        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            backgroundColor: colors.surfaceRaised,
            display: "grid",
            gap: 6,
            padding: "9px 10px",
            width: "100%",
          }}
        >
          <FitText style={{ color: colors.textMuted, fontSize: 10, fontWeight: 850 }}>
            Live Equipment
          </FitText>
          <FitText style={{ fontSize: 12.5, fontWeight: 800, lineHeight: 1.32 }}>
            {visibleEquipment.length > 0
              ? visibleEquipment.map((item) => item.name).join(", ")
              : "No assigned equipment yet."}
          </FitText>
        </div>
        <FitText
          style={{
            color: colors.textSecondary,
            display: "-webkit-box",
            fontSize: 12,
            lineHeight: 1.35,
            maxWidth: 300,
            overflow: "hidden",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
          }}
        >
          {venue.description ?? "No description provided for this venue yet."}
        </FitText>
      </div>
    );
  }

  const handleFeedbackSubmit = async () => {
    const trimmedComment = feedbackComment.trim();

    try {
      await feedbackMutation.mutateAsync({
        id: venue.id,
        comment: trimmedComment || undefined,
        rating: feedbackRating,
      });
      setFeedbackComment("");
      setFeedbackRating(5);
      setFeedbackState({
        text: "Venue feedback submitted.",
        tone: "success",
      });
    } catch {
      setFeedbackState({
        text: "Venue feedback could not be sent right now.",
        tone: "danger",
      });
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 16,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.surfaceRaised,
        }}
      >
        <img
          src={heroImage}
          alt={`${venue.name} preview`}
          style={{
            width: "100%",
            aspectRatio: "16 / 9",
            objectFit: "cover",
            display: "block",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "auto 12px 12px 12px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            borderRadius: 12,
            backgroundColor: "rgba(0,0,0,0.34)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.12)",
              color: "#fff",
              flexShrink: 0,
            }}
          >
            <Icon size={18} strokeWidth={2} />
          </div>
          <div style={{ minWidth: 0 }}>
            <FitText style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{venue.name}</FitText>
            <FitText style={{ fontSize: 12, color: "rgba(255,255,255,0.82)" }}>{subtitle}</FitText>
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        {infoItems.map((item) => (
          <div
            key={item.label}
            style={{
              borderRadius: 12,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surfaceRaised,
              padding: "12px 14px",
              display: "grid",
              gap: 6,
            }}
          >
            <FitText style={{ fontSize: 11, color: colors.textMuted, fontWeight: 700 }}>
              {item.label}
            </FitText>
            <FitText style={{ fontSize: 15, fontWeight: 700 }}>{item.value}</FitText>
          </div>
        ))}
      </div>
      <div
        style={{
          borderRadius: 12,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.surfaceRaised,
          padding: "14px 16px",
          display: "grid",
          gap: 8,
        }}
      >
        <FitText style={{ fontSize: 12, color: colors.textMuted, fontWeight: 700 }}>Live Equipment</FitText>
        {assignedEquipment.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {assignedEquipment.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surface,
                }}
              >
                <FitText style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</FitText>
              </div>
            ))}
          </div>
        ) : (
          <FitText style={{ fontSize: 14, lineHeight: 1.55 }}>
            No live equipment is assigned to this zone yet.
          </FitText>
        )}
      </div>
      <div
        style={{
          borderRadius: 12,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.surfaceRaised,
          padding: "14px 16px",
          display: "grid",
          gap: 8,
        }}
      >
        <FitText style={{ fontSize: 12, color: colors.textMuted, fontWeight: 700 }}>Description</FitText>
        <FitText style={{ fontSize: 14, lineHeight: 1.55 }}>
          {venue.description ?? "No description provided for this venue yet."}
        </FitText>
      </div>
      <div
        style={{
          borderRadius: 12,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.surfaceRaised,
          padding: "14px 16px",
          display: "grid",
          gap: 10,
        }}
      >
        <FitText style={{ fontSize: 12, color: colors.textMuted, fontWeight: 700 }}>
          Venue Feedback
        </FitText>
        <FitText style={{ fontSize: 14, lineHeight: 1.55 }}>
          Tell the team what worked well or what needs attention in this facility or venue.
        </FitText>
        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            display: "grid",
            gap: 6,
            padding: "10px 12px",
          }}
        >
          <FitText style={{ fontSize: 13, fontWeight: 800 }}>
            Average rating: {averageRating ? `${averageRating.toFixed(1)}/5` : "No ratings yet"}
          </FitText>
          {venueFeedback.slice(0, 3).map((entry) => (
            <FitText key={entry.id} style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 1.45 }}>
              {entry.rating}/5 - {entry.comment ?? "No written comment."}
            </FitText>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => setFeedbackRating(rating)}
              disabled={feedbackMutation.isPending}
              aria-label={`Rate venue ${rating} star${rating === 1 ? "" : "s"}`}
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                border: `1px solid ${rating <= feedbackRating ? colors.warning : colors.border}`,
                background: colors.surface,
                color: rating <= feedbackRating ? colors.warning : colors.textMuted,
                cursor: feedbackMutation.isPending ? "not-allowed" : "pointer",
                fontWeight: 900,
              }}
            >
              *
            </button>
          ))}
        </div>
        <FitTextArea
          value={feedbackComment}
          onChange={(event) => {
            setFeedbackComment(event.target.value);
            if (feedbackState) {
              setFeedbackState(null);
            }
          }}
          placeholder="Share a quick note about the space, booking experience, or equipment condition."
          rows={4}
          maxLength={1500}
          disabled={feedbackMutation.isPending}
        />
        {feedbackState ? (
          <FitText
            style={{
              color: feedbackState.tone === "success" ? colors.success : colors.danger,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {feedbackState.text}
          </FitText>
        ) : null}
        <div style={{ display: "flex", gap: 10 }}>
          <FitButton
            variant="ghost"
            label="Clear"
            flex={1}
            disabled={feedbackMutation.isPending && !feedbackComment}
            onClick={() => {
              setFeedbackComment("");
              setFeedbackState(null);
            }}
          />
          <FitButton
            variant="primary"
            label="Send Feedback"
            loading={feedbackMutation.isPending}
            loadingLabel="Sending Feedback"
            flex={1}
            onClick={() => void handleFeedbackSubmit()}
          />
        </div>
      </div>
    </div>
  );
}
