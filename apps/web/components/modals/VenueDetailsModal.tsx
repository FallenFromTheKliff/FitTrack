"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { VenueBookingRecord, VenueFeedbackRecord } from "@fittrack/api-client";
import {
  gymLayoutEquipmentQueryOptions,
  venueFeedbackHistoryQueryOptions,
} from "@fittrack/query";
import { listVenueEquipment } from "@fittrack/types";
import { buildRenderableAssetUrl } from "@fittrack/utils";

import { useTheme } from "@/contexts/ThemeContext";
import { WEB_API_BASE_URL, webApiClient } from "@/lib/api-client";
import { FACILITY_FLOOR_MAP, type FloorVenueRecord } from "@/data/facilities/floorPlans";
import { getVenueIcon } from "@/data/facilities/mapTypes";
import FitButton from "@/components/fit/FitButton";
import { FitText } from "@/components/fit/FitText";
import FitModal from "@/components/modals/FitModal";

type Props = {
  venue: FloorVenueRecord | null;
  isOpen: boolean;
  onClose: () => void;
  activeBookings?: VenueBookingRecord[];
  onEditVenue?: (venue: FloorVenueRecord) => void;
  onViewMap?: (venue: FloorVenueRecord) => void;
};

type VenueDetailsContentProps = {
  venue: FloorVenueRecord | null;
  activeBookings?: VenueBookingRecord[];
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

export default function VenueDetailsModal({
  venue,
  isOpen,
  onClose,
  activeBookings = [],
  onEditVenue,
  onViewMap,
}: Props) {
  if (!venue) return null;

  return (
    <FitModal
      isOpen={isOpen}
      onClose={onClose}
      title={venue.name}
      subtitle={getVenueDetailsSubtitle(venue)}
      maxWidth={620}
      closeAriaLabel="Close venue details"
      footer={
        onEditVenue || onViewMap ? (
          <div style={{ display: "flex", gap: 10, width: "100%" }}>
            {onViewMap ? (
              <FitButton
                variant="ghost"
                label={venue.isMapped === false ? "NOT ON MAP" : "VIEW ON MAP"}
                flex={1}
                disabled={venue.isMapped === false}
                title={
                  venue.isMapped === false
                    ? "Place this saved venue from the Layout assets panel."
                    : undefined
                }
                onClick={() => {
                  if (venue.isMapped !== false) onViewMap(venue);
                }}
              />
            ) : null}
            {onEditVenue ? (
              <FitButton
                variant="primary"
                label="EDIT VENUE"
                flex={1}
                onClick={() => onEditVenue(venue)}
              />
            ) : null}
          </div>
        ) : undefined
      }
    >
      <VenueDetailsContent
        key={`${venue.mapId}:${isOpen ? "open" : "closed"}`}
        venue={venue}
        activeBookings={activeBookings}
        equipmentQueryEnabled={isOpen}
      />
    </FitModal>
  );
}

export function VenueDetailsContent({
  venue,
  activeBookings = [],
  equipmentQueryEnabled = true,
  variant = "modal",
}: VenueDetailsContentProps) {
  const { colors } = useTheme();
  const Icon = useMemo(() => getVenueIcon(venue?.iconKey), [venue?.iconKey]);
  const feedbackSummaryQuery = useQuery({
    ...venueFeedbackHistoryQueryOptions(webApiClient, venue?.id, {
      page: 1,
      limit: 3,
    }),
    enabled: !!venue && variant === "modal",
  });
  const [feedbackReaderOpen, setFeedbackReaderOpen] = useState(false);
  const [feedbackReaderPage, setFeedbackReaderPage] = useState(1);
  const [feedbackReaderItems, setFeedbackReaderItems] = useState<
    VenueFeedbackRecord[]
  >([]);
  const feedbackReaderQuery = useQuery({
    ...venueFeedbackHistoryQueryOptions(webApiClient, venue?.id, {
      page: feedbackReaderPage,
      limit: 10,
    }),
    enabled: !!venue && variant === "modal" && feedbackReaderOpen,
  });
  const [heroImageFailed, setHeroImageFailed] = useState(false);
  const equipmentQuery = useQuery({
    ...gymLayoutEquipmentQueryOptions(webApiClient),
    enabled: !!venue && equipmentQueryEnabled,
  });
  const liveEquipment = equipmentQuery.data ?? [];

  useEffect(() => {
    setFeedbackReaderOpen(false);
    setFeedbackReaderPage(1);
    setFeedbackReaderItems([]);
  }, [variant, venue?.id]);

  useEffect(() => {
    const page = feedbackReaderQuery.data;
    if (!feedbackReaderOpen || !page) return;
    setFeedbackReaderItems((current) =>
      feedbackReaderPage === 1
        ? page.items
        : [
            ...current,
            ...page.items.filter(
              (entry) => !current.some((currentEntry) => currentEntry.id === entry.id),
            ),
          ],
    );
  }, [feedbackReaderOpen, feedbackReaderPage, feedbackReaderQuery.data]);

  useEffect(() => {
    setHeroImageFailed(false);
  }, [venue?.id, venue?.imageUrl]);

  if (!venue) return null;

  const subtitle = getVenueDetailsSubtitle(venue);
  const fallbackHeroImage = buildHeroImage(
    venue.name,
    colors.brand,
    colors.surfaceRaised,
  );
  const heroImage = heroImageFailed
    ? fallbackHeroImage
    : buildRenderableAssetUrl({
      apiBaseUrl: WEB_API_BASE_URL,
      assetUrl: venue.imageUrl ?? null,
    }) ?? fallbackHeroImage;
  const assignedEquipment = listVenueEquipment(liveEquipment, venue);
  const venueBookings = activeBookings
    .filter(
      (booking) =>
        String(booking.venueId) === String(venue.sourceVenueId ?? venue.id),
    )
    .sort(
      (left, right) =>
        new Date(left.startTime).getTime() - new Date(right.startTime).getTime(),
    );
  const nextBooking = venueBookings.find(
    (booking) => new Date(booking.endTime).getTime() >= Date.now(),
  );
  const feedbackSummary = feedbackSummaryQuery.data;
  const venueFeedback = feedbackSummary?.items ?? [];
  const averageRating = feedbackSummary?.average_rating ?? null;
  const feedbackTotal = feedbackSummary?.total ?? 0;
  const infoItems = [
    { label: "Capacity", value: String(venue.capacity ?? "N/A") },
    { label: "Minimum Hours", value: `${venue.minimumHours ?? 1}` },
    { label: "Rate", value: venue.hourlyRate ? `PHP ${venue.hourlyRate}/hr` : "Facility only" },
    { label: "Grid Zone", value: `C${venue.gridColumn ?? 1} / R${venue.gridRow ?? 1}` },
    { label: "Map Visibility", value: venue.isMapped === false ? "Hidden" : "Visible" },
    { label: "Dimensions", value: `${venue.gridWidth ?? 1} x ${venue.gridHeight ?? 1} cells` },
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
            onError={() => setHeroImageFailed(true)}
            style={{
              display: "block",
              width: "100%",
              aspectRatio: "16 / 7",
              objectFit: venue.imageFit ?? "cover",
              objectPosition: `${venue.imageFocalX ?? 50}% ${venue.imageFocalY ?? 50}%`,
              transform: `scale(${venue.imageCropZoom ?? 1})`,
              transformOrigin: `${venue.imageFocalX ?? 50}% ${venue.imageFocalY ?? 50}%`,
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

  if (feedbackReaderOpen) {
    const readerPage = feedbackReaderQuery.data;
    const isFirstPagePending =
      feedbackReaderQuery.isPending && feedbackReaderItems.length === 0;
    const isFirstPageError =
      feedbackReaderQuery.isError && feedbackReaderItems.length === 0;

    return (
      <div style={{ display: "grid", gap: 12 }}>
        <FitButton
          variant="ghost"
          label="Back to venue details"
          onClick={() => setFeedbackReaderOpen(false)}
          style={{ justifySelf: "start", minHeight: 34 }}
        />
        <div
          style={{
            backgroundColor: colors.surfaceRaised,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            display: "grid",
            gap: 4,
            padding: "14px 16px",
          }}
        >
          <FitText style={{ fontSize: 16, fontWeight: 850 }}>
            All venue feedback
          </FitText>
          <FitText style={{ color: colors.textSecondary, fontSize: 13 }}>
            {feedbackTotal} response{feedbackTotal === 1 ? "" : "s"} · {averageRating === null
              ? "No ratings yet"
              : `${averageRating.toFixed(1)}/5 overall`}
          </FitText>
        </div>
        {isFirstPagePending ? (
          <FitText style={{ color: colors.textMuted, fontSize: 13 }}>
            Loading feedback history...
          </FitText>
        ) : null}
        {isFirstPageError ? (
          <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
            <FitText style={{ color: colors.danger, flex: 1, fontSize: 13 }}>
              Feedback history could not be loaded.
            </FitText>
            <FitButton
              variant="ghost"
              label="Retry"
              onClick={() => void feedbackReaderQuery.refetch()}
            />
          </div>
        ) : null}
        {!isFirstPagePending && !isFirstPageError && feedbackReaderItems.length === 0 ? (
          <FitText style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 1.5 }}>
            No feedback has been submitted for this venue yet.
          </FitText>
        ) : null}
        {feedbackReaderItems.map((entry) => (
          <div
            key={entry.id}
            style={{
              backgroundColor: colors.surfaceRaised,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              display: "grid",
              gap: 6,
              padding: "13px 14px",
            }}
          >
            <div style={{ alignItems: "baseline", display: "flex", gap: 8, justifyContent: "space-between" }}>
              <FitText style={{ fontSize: 13, fontWeight: 800 }}>
                {entry.submitted_by?.name?.trim() || "Member"}
              </FitText>
              <FitText style={{ color: colors.warning, fontSize: 13, fontWeight: 850 }}>
                {entry.rating}/5
              </FitText>
            </div>
            <FitText style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {entry.comment?.trim() || "No written comment."}
            </FitText>
          </div>
        ))}
        {feedbackReaderQuery.isError && feedbackReaderItems.length > 0 ? (
          <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
            <FitText style={{ color: colors.danger, flex: 1, fontSize: 13 }}>
              More feedback could not be loaded.
            </FitText>
            <FitButton
              variant="ghost"
              label="Retry"
              onClick={() => void feedbackReaderQuery.refetch()}
            />
          </div>
        ) : null}
        {readerPage?.has_more ? (
          <FitButton
            variant="ghost"
            label="Load more feedback"
            loading={feedbackReaderQuery.isFetching}
            loadingLabel="Loading feedback"
            onClick={() => setFeedbackReaderPage((page) => page + 1)}
          />
        ) : null}
      </div>
    );
  }

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
          onError={() => setHeroImageFailed(true)}
          style={{
            width: "100%",
            aspectRatio: "16 / 9",
            objectFit: venue.imageFit ?? "cover",
            objectPosition: `${venue.imageFocalX ?? 50}% ${venue.imageFocalY ?? 50}%`,
            transform: `scale(${venue.imageCropZoom ?? 1})`,
            transformOrigin: `${venue.imageFocalX ?? 50}% ${venue.imageFocalY ?? 50}%`,
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
          gap: 6,
        }}
      >
        <FitText style={{ fontSize: 12, color: colors.textMuted, fontWeight: 700 }}>
          Booking Summary
        </FitText>
        <FitText style={{ fontSize: 14, fontWeight: 700 }}>
          {venueBookings.length} active booking{venueBookings.length === 1 ? "" : "s"}
        </FitText>
        <FitText style={{ fontSize: 13, color: colors.textSecondary }}>
          {nextBooking
            ? `Next: ${new Date(nextBooking.startTime).toLocaleString()}`
            : "No upcoming booking."}
        </FitText>
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
        {equipmentQuery.isPending ? (
          <FitText style={{ fontSize: 13, color: colors.textMuted }}>
            Loading contained equipment...
          </FitText>
        ) : equipmentQuery.isError ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FitText style={{ flex: 1, fontSize: 13, color: colors.danger }}>
              Contained equipment could not be loaded.
            </FitText>
            <FitButton
              variant="ghost"
              label="Retry"
              onClick={() => void equipmentQuery.refetch()}
            />
          </div>
        ) : assignedEquipment.length > 0 ? (
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
        {feedbackSummaryQuery.isPending ? (
          <FitText style={{ fontSize: 13, color: colors.textMuted }}>
            Loading venue feedback...
          </FitText>
        ) : feedbackSummaryQuery.isError ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FitText style={{ flex: 1, fontSize: 13, color: colors.danger }}>
              Venue feedback could not be loaded.
            </FitText>
            <FitButton
              variant="ghost"
              label="Retry"
              onClick={() => void feedbackSummaryQuery.refetch()}
            />
          </div>
        ) : (
          <>
            <FitText style={{ color: colors.textSecondary, fontSize: 13 }}>
              {feedbackTotal} response{feedbackTotal === 1 ? "" : "s"} · {averageRating === null
                ? "No ratings yet"
                : `${averageRating.toFixed(1)}/5 overall`}
            </FitText>
            {venueFeedback.length > 0 ? (
              <div style={{ display: "grid", gap: 7 }}>
                {venueFeedback.map((entry) => (
                  <div key={entry.id} style={{ border: `1px solid ${colors.border}`, borderRadius: 9, display: "grid", gap: 3, padding: "9px 10px" }}>
                    <FitText style={{ fontSize: 12, fontWeight: 800 }}>
                      {entry.submitted_by?.name?.trim() || "Member"} · {entry.rating}/5
                    </FitText>
                    <FitText style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 1.45 }}>
                      {entry.comment?.trim() || "No written comment."}
                    </FitText>
                  </div>
                ))}
              </div>
            ) : (
              <FitText style={{ color: colors.textSecondary, fontSize: 13 }}>
                No feedback has been submitted for this venue yet.
              </FitText>
            )}
            <FitButton
              variant="ghost"
              label="View all feedback"
              onClick={() => {
                setFeedbackReaderPage(1);
                setFeedbackReaderItems([]);
                setFeedbackReaderOpen(true);
              }}
              style={{ justifySelf: "start", minHeight: 34 }}
            />
          </>
        )}
      </div>
    </div>
  );
}
