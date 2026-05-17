"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, CalendarDays, Dumbbell, Repeat, Star, Ticket, UserRoundCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatBookingDate, formatGroupLabel, groupItemsByDate } from "@fittrack/utils";
import type { CoachProfileRecord } from "@fittrack/types";
import { activeCoachesQueryOptions } from "@fittrack/query";

import FitButton from "@/components/fit/FitButton";
import FitSearch from "@/components/fit/FitSearch";
import { FitText, FitTextArea, FitTextInput } from "@/components/fit/FitText";
import { FilterChips } from "@/components/member-only/MemberOnlyPageControls";
import {
  EmptyState,
  MemberCard,
  MemberGrid,
  MemberOnlyScreen,
  MemberPanelHeader,
  MemberPill,
  MemberSection,
  MemberStack,
  MemberSurface,
  MemberText,
  StatTile,
} from "@/components/member-only/MemberOnlyPrimitives";
import {
  BOOKING_STATUS_FILTERS,
  MEMBER_BOOKING_SECTIONS,
  formatStatusLabel,
  toMemberAppointment,
  toMemberBookings,
  type BookingSection,
  type BookingStatusFilter,
  type MemberBookingItem,
} from "@/components/member-only/memberOnlyUtils";
import { getStatusTone } from "@/components/member-only/MemberOnlyPageShared";
import { useTheme } from "@/contexts/ThemeContext";
import { webApiClient } from "@/lib/api-client";
import { useMemberOnlyAccess, useMemberOnlyBookingsData } from "@/hooks/member-only/useMemberOnlyData";

type BookingMode = "find" | "bookings";
type CoachRatingFilter = "all" | "4" | "4.5";
type CoachSkillFilter = "all" | string;
type CoachBookingIntent = "single" | "pack" | "recurring";

const BOOKING_MODE_OPTIONS: ReadonlyArray<{ label: string; value: BookingMode }> = [
  { label: "Find a coach", value: "find" },
  { label: "My bookings", value: "bookings" },
];

const COACH_RATING_FILTERS: ReadonlyArray<{ label: string; value: CoachRatingFilter }> = [
  { label: "All ratings", value: "all" },
  { label: "4.0+", value: "4" },
  { label: "4.5+", value: "4.5" },
];

const BOOKING_INTENT_OPTIONS: ReadonlyArray<{
  description: string;
  icon: typeof UserRoundCheck;
  label: string;
  value: CoachBookingIntent;
}> = [
  {
    description: "One focused session with a coach.",
    icon: UserRoundCheck,
    label: "Single session",
    value: "single",
  },
  {
    description: "Reserve a small block of sessions.",
    icon: Ticket,
    label: "Multi-session pack",
    value: "pack",
  },
  {
    description: "Plan a repeated weekly coaching rhythm.",
    icon: Repeat,
    label: "Recurring plan",
    value: "recurring",
  },
];

function getCoachName(coach: CoachProfileRecord) {
  const standaloneName = coach.displayName?.trim();
  if (standaloneName && !standaloneName.includes("@")) return standaloneName;
  return "Coach Profile";
}

function getCoachInitials(coach: CoachProfileRecord) {
  return getCoachName(coach)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "CP";
}

function getCoachRatingLabel(coach: CoachProfileRecord) {
  if (!coach.averageRating || coach.ratingCount === 0) {
    return "New coach";
  }

  return `${coach.averageRating.toFixed(1)} stars (${coach.ratingCount ?? 0})`;
}

function getCoachRatingValue(coach: CoachProfileRecord) {
  return coach.averageRating ?? 0;
}

function getCoachRatingStat(coach: CoachProfileRecord) {
  return coach.averageRating && coach.ratingCount ? coach.averageRating.toFixed(1) : "New";
}

function getCoachSpecialtySummary(coach: CoachProfileRecord) {
  return coach.specialties?.filter(Boolean).slice(0, 2).join(" / ") || "General coaching";
}

function getCoachRateLabel(coach: CoachProfileRecord) {
  return coach.hourlyRate ? `PHP ${coach.hourlyRate.toLocaleString()} / session` : "Rate confirmed by staff";
}

function getCoachAvailabilityLabel(coach: CoachProfileRecord) {
  const availableSlots = coach.availability?.filter((slot) => slot.isAvailable) ?? [];
  if (availableSlots.length === 0) return "Availability on request";
  return `${availableSlots.length} open slot${availableSlots.length === 1 ? "" : "s"} listed`;
}

function getCoachReviewSnippet(coach: CoachProfileRecord) {
  return coach.recentReviews?.find((review) => review.comment?.trim())?.comment?.trim() ?? "Recent feedback appears after completed sessions.";
}

function coachMatchesSearch(coach: CoachProfileRecord, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    getCoachName(coach),
    coach.bio ?? "",
    ...(coach.specialties ?? []),
    ...(coach.certifications ?? []),
  ].some((value) => value.toLowerCase().includes(normalized));
}

export default function BookingsPage() {
  const { colors } = useTheme();
  const { user } = useMemberOnlyAccess("Bookings");
  const [bookingMode, setBookingMode] = useState<BookingMode>("find");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState<BookingSection>("bookings");
  const [statusFilter, setStatusFilter] = useState<BookingStatusFilter>("all");
  const [selectedBooking, setSelectedBooking] = useState<MemberBookingItem | null>(null);
  const [coachSearchQuery, setCoachSearchQuery] = useState("");
  const [coachSkillFilter, setCoachSkillFilter] = useState<CoachSkillFilter>("all");
  const [coachRatingFilter, setCoachRatingFilter] = useState<CoachRatingFilter>("all");
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [bookingIntent, setBookingIntent] = useState<CoachBookingIntent>("single");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");
  const [bookingDraftState, setBookingDraftState] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewState, setReviewState] = useState<{
    text: string;
    tone: "danger" | "success";
  } | null>(null);
  const data = useMemberOnlyBookingsData(user?.id);
  const coachFilters = useMemo(
    () => ({
      ...(coachSkillFilter !== "all" ? { specialization: coachSkillFilter } : {}),
      ...(coachRatingFilter !== "all" ? { minRating: Number(coachRatingFilter) } : {}),
    }),
    [coachRatingFilter, coachSkillFilter],
  );
  const coachesQuery = useQuery({
    ...activeCoachesQueryOptions<CoachProfileRecord>(webApiClient, coachFilters),
    enabled: !!user?.id,
  });
  const coaches = coachesQuery.data ?? [];
  const coachSkillOptions = useMemo(() => {
    const values = new Set<string>();
    if (coachSkillFilter !== "all") {
      values.add(coachSkillFilter);
    }
    coaches.forEach((coach) => {
      coach.specialties?.forEach((specialty) => {
        const trimmed = specialty.trim();
        if (trimmed) values.add(trimmed);
      });
    });

    return [
      { label: "All skills", value: "all" },
      ...Array.from(values)
        .sort((a, b) => a.localeCompare(b))
        .map((specialty) => ({ label: specialty, value: specialty })),
    ];
  }, [coachSkillFilter, coaches]);
  const filteredCoaches = useMemo(() => {
    const minRating = coachRatingFilter === "all" ? 0 : Number(coachRatingFilter);
    return coaches.filter((coach) => {
      const matchesSearch = coachMatchesSearch(coach, coachSearchQuery);
      const matchesSkill =
        coachSkillFilter === "all" ||
        coach.specialties?.some((specialty) => specialty.toLowerCase() === coachSkillFilter.toLowerCase());
      const matchesRating = getCoachRatingValue(coach) >= minRating || (minRating === 0 && coach.ratingCount === 0);
      return matchesSearch && matchesSkill && matchesRating;
    });
  }, [coachRatingFilter, coachSearchQuery, coachSkillFilter, coaches]);
  const selectedCoach = filteredCoaches.find((coach) => coach.id === selectedCoachId) ?? filteredCoaches[0] ?? null;
  const reservations = useMemo(() => toMemberBookings(data.bookingsQuery.data ?? [], data.venuesQuery.data ?? []), [data.bookingsQuery.data, data.venuesQuery.data]);
  const appointments = useMemo(() => (data.appointmentsQuery.data ?? []).map(toMemberAppointment), [data.appointmentsQuery.data]);
  const activeItems = activeSection === "bookings" ? reservations : appointments;
  const filtered = activeItems.filter((booking) => {
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "pending"
        ? booking.status.includes("pending")
        : booking.status === statusFilter);
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      booking.resourceName.toLowerCase().includes(query) ||
      (booking.participantName ?? "").toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });
  const grouped = groupItemsByDate(filtered);
  const selected = filtered.find((booking) => booking.id === selectedBooking?.id) ?? filtered[0] ?? null;
  const isLoading = data.bookingsQuery.isPending || data.appointmentsQuery.isPending;
  const canReviewCoach =
    activeSection === "appointments" &&
    selected?.status === "completed" &&
    typeof selected.coachId === "string" &&
    selected.coachId.length > 0;

  useEffect(() => {
    setReviewComment("");
    setReviewRating(5);
    setReviewState(null);
  }, [selected?.id]);

  useEffect(() => {
    setBookingDraftState(null);
  }, [bookingIntent, selectedCoach?.id]);

  const handlePrepareBookingRequest = () => {
    if (!selectedCoach) return;

    const dateLabel = preferredDate ? ` for ${preferredDate}` : "";
    const timeLabel = preferredTime ? ` around ${preferredTime}` : "";
    setBookingDraftState(`Draft ready: ${BOOKING_INTENT_OPTIONS.find((option) => option.value === bookingIntent)?.label} with ${getCoachName(selectedCoach)}${dateLabel}${timeLabel}.`);
  };

  const handleCoachReviewSubmit = async () => {
    if (!selected?.coachId) return;

    const trimmedComment = reviewComment.trim();
    if (!trimmedComment) {
      setReviewState({
        text: "Add a short note before submitting coach feedback.",
        tone: "danger",
      });
      return;
    }

    try {
      await data.submitCoachReviewMutation.mutateAsync({
        coachId: selected.coachId,
        payload: {
          appointmentId: selected.id,
          comment: trimmedComment,
          rating: reviewRating,
        },
        userId: user?.id,
      });
      setReviewComment("");
      setReviewState({
        text: "Coach feedback submitted for this completed session.",
        tone: "success",
      });
    } catch {
      setReviewState({
        text: "Coach feedback could not be submitted right now.",
        tone: "danger",
      });
    }
  };

  return (
    <MemberOnlyScreen>
      <MemberText as="h1" variant="title">Bookings</MemberText>
      <MemberText as="p" variant="subtitle">
        Find a coach, prepare a session request, and review your venue reservations or coaching appointments.
      </MemberText>

      <MemberSurface
        padded
        style={{ alignContent: "start", minHeight: 66, overflow: "visible" }}
      >
        <FilterChips options={BOOKING_MODE_OPTIONS} value={bookingMode} onChange={setBookingMode} />
      </MemberSurface>

      {bookingMode === "find" ? (
        <>
          <MemberSurface
            padded
            style={{ alignContent: "start", minHeight: 180, overflow: "visible" }}
          >
            <FitSearch value={coachSearchQuery} onChangeText={setCoachSearchQuery} placeholder="Search coach, skill, or certification" />
            <div style={{ display: "grid", gap: 10 }}>
              <MemberText variant="brand">Skills and specialization</MemberText>
              <FilterChips options={coachSkillOptions} value={coachSkillFilter} onChange={setCoachSkillFilter} />
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <MemberText variant="brand">Rating</MemberText>
              <FilterChips options={COACH_RATING_FILTERS} value={coachRatingFilter} onChange={setCoachRatingFilter} />
            </div>
          </MemberSurface>

          <div className="member-only-page-row">
            <MemberSection
              heading="Coach discovery"
              action={<MemberPill tone={filteredCoaches.length > 0 ? "success" : "muted"}>{filteredCoaches.length} available</MemberPill>}
            >
              <MemberSurface>
                {coachesQuery.isPending ? (
                  <EmptyState icon={UserRoundCheck} title="Loading coaches" hint="Coach profiles and recent feedback are loading." />
                ) : coachesQuery.isError ? (
                  <EmptyState icon={UserRoundCheck} title="Coaches unavailable" hint="Try again once the coaching directory is reachable." />
                ) : filteredCoaches.length === 0 ? (
                  <EmptyState icon={UserRoundCheck} title="No coaches match" hint="Adjust the skill, rating, or search filters." />
                ) : (
                  filteredCoaches.map((coach, index) => (
                    <MemberCard
                      key={coach.id}
                      avatarInitials={getCoachInitials(coach)}
                      hasBorder={index < filteredCoaches.length - 1}
                      label={getCoachName(coach)}
                      subtitle={`${getCoachSpecialtySummary(coach)} | ${getCoachRateLabel(coach)}`}
                      trailingLabel={getCoachRatingLabel(coach)}
                      trailingTone={getCoachRatingValue(coach) >= 4.5 ? "success" : "brand"}
                      selected={selectedCoach?.id === coach.id}
                      onClick={() => setSelectedCoachId(coach.id)}
                    >
                      <div style={{ display: "grid", gap: 8 }}>
                        <MemberText variant="muted">{getCoachReviewSnippet(coach)}</MemberText>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          <MemberPill tone="muted">{getCoachAvailabilityLabel(coach)}</MemberPill>
                          {coach.certifications?.slice(0, 2).map((certification) => (
                            <MemberPill key={certification} tone="brand">{certification}</MemberPill>
                          ))}
                        </div>
                      </div>
                    </MemberCard>
                  ))
                )}
              </MemberSurface>
            </MemberSection>

            <MemberSection heading="Booking composer">
              <MemberSurface padded>
                {selectedCoach ? (
                  <>
                    <MemberPanelHeader
                      eyebrow="Selected coach"
                      title={getCoachName(selectedCoach)}
                      action={<MemberPill tone={selectedCoach.ratingCount ? "success" : "warning"}>{getCoachRatingLabel(selectedCoach)}</MemberPill>}
                    />
                    <MemberText variant="subtitle">{selectedCoach.bio?.trim() || "Choose a session intent and preferred schedule so staff can confirm the final booking path."}</MemberText>
                    <MemberGrid columns={2}>
                      <StatTile icon={Star} label="Rating" value={getCoachRatingStat(selectedCoach)} tone={selectedCoach.ratingCount ? "success" : "warning"} />
                      <StatTile label="Rate" value={getCoachRateLabel(selectedCoach)} tone="brand" />
                    </MemberGrid>

                    <div
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 14,
                        display: "grid",
                        gap: 10,
                        padding: 14,
                      }}
                    >
                      <MemberText variant="brand">Recent feedback</MemberText>
                      {selectedCoach.recentReviews?.length ? (
                        selectedCoach.recentReviews.slice(0, 2).map((review) => (
                          <div key={review.id} style={{ display: "grid", gap: 3 }}>
                            <MemberText variant="subtitle">{review.comment?.trim() || "Member left a rating without a note."}</MemberText>
                            <MemberText variant="muted">
                              {review.rating} stars from {review.reviewerName}
                            </MemberText>
                          </div>
                        ))
                      ) : (
                        <MemberText variant="subtitle">Member reviews will appear here after completed sessions.</MemberText>
                      )}
                    </div>

                    <div style={{ display: "grid", gap: 10 }}>
                      <MemberText variant="brand">Session intent</MemberText>
                      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                        {BOOKING_INTENT_OPTIONS.map((option) => (
                          <FitButton
                            key={option.value}
                            variant="card"
                            active={bookingIntent === option.value}
                            icon={option.icon}
                            onClick={() => setBookingIntent(option.value)}
                          >
                            <span style={{ display: "grid", gap: 4 }}>
                              <span style={{ fontSize: 13, fontWeight: 800 }}>{option.label}</span>
                              <span style={{ color: colors.textMuted, fontSize: 12, lineHeight: 1.35 }}>{option.description}</span>
                            </span>
                          </FitButton>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                      <label style={{ display: "grid", gap: 8 }}>
                        <MemberText variant="brand">Preferred date</MemberText>
                        <FitTextInput type="date" value={preferredDate} onChange={(event) => setPreferredDate(event.target.value)} />
                      </label>
                      <label style={{ display: "grid", gap: 8 }}>
                        <MemberText variant="brand">Preferred time</MemberText>
                        <FitTextInput type="time" value={preferredTime} onChange={(event) => setPreferredTime(event.target.value)} />
                      </label>
                    </div>

                    <div style={{ display: "grid", gap: 8 }}>
                      <MemberText variant="brand">Notes</MemberText>
                      <FitTextArea
                        value={bookingNotes}
                        onChange={(event) => setBookingNotes(event.target.value)}
                        placeholder="Goals, injuries, preferred cadence, or questions for this coach."
                        rows={4}
                        maxLength={1000}
                      />
                    </div>

                    <div
                      style={{
                        backgroundColor: `${colors.brand}10`,
                        border: `1px solid ${colors.brand}26`,
                        borderRadius: 14,
                        display: "grid",
                        gap: 6,
                        padding: 14,
                      }}
                    >
                      <MemberText variant="brand">Request summary</MemberText>
                      <MemberText variant="subtitle">
                        {BOOKING_INTENT_OPTIONS.find((option) => option.value === bookingIntent)?.label} with {getCoachName(selectedCoach)}
                        {preferredDate ? ` on ${preferredDate}` : ""}{preferredTime ? ` at ${preferredTime}` : ""}.
                      </MemberText>
                      <MemberText variant="muted">
                        Staff confirmation is required before this becomes an appointment.
                      </MemberText>
                    </div>

                    {bookingDraftState ? (
                      <FitText style={{ color: colors.success, fontSize: 13, fontWeight: 700 }}>
                        {bookingDraftState}
                      </FitText>
                    ) : null}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      <FitButton
                        variant="ghost"
                        label="Clear composer"
                        flex={1}
                        onClick={() => {
                          setPreferredDate("");
                          setPreferredTime("");
                          setBookingNotes("");
                          setBookingDraftState(null);
                        }}
                      />
                      <FitButton
                        variant="primary"
                        label="Prepare request"
                        flex={1}
                        onClick={handlePrepareBookingRequest}
                      />
                    </div>
                  </>
                ) : (
                  <EmptyState icon={UserRoundCheck} title="Select a coach" hint="Coach details and booking intent controls will appear here." />
                )}
              </MemberSurface>
            </MemberSection>
          </div>
        </>
      ) : (
        <>
      <MemberSurface
        padded
        style={{ alignContent: "start", minHeight: 148, overflow: "visible" }}
      >
        <FitSearch value={searchQuery} onChangeText={setSearchQuery} placeholder="Search bookings" />
        <FilterChips options={MEMBER_BOOKING_SECTIONS} value={activeSection} onChange={setActiveSection} />
        <FilterChips options={BOOKING_STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
      </MemberSurface>

      <div className="member-only-page-row">
        <MemberSection heading="Records">
          <MemberSurface>
            {isLoading ? (
              <EmptyState icon={CalendarDays} title="Loading bookings" hint="Please wait a moment." />
            ) : filtered.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No matching bookings" hint="Try a different filter or search term." />
            ) : (
              grouped.map(([groupDate, groupItems]) => (
                <MemberStack key={groupDate}>
                  <MemberSurface padded>
                    <MemberText variant="brand">{formatGroupLabel(groupDate)}</MemberText>
                  </MemberSurface>
                  {groupItems.map((booking, index) => (
                    <MemberCard
                      key={booking.id}
                      hasBorder={index < groupItems.length - 1}
                      icon={activeSection === "bookings" ? CalendarDays : Dumbbell}
                      label={booking.resourceName}
                      subtitle={`${booking.time} | ${booking.participantLabel ?? "Member"}`}
                      trailingLabel={formatStatusLabel(booking.status)}
                      trailingTone={getStatusTone(booking.status)}
                      selected={selected?.id === booking.id}
                      onClick={() => setSelectedBooking(booking)}
                    />
                  ))}
                </MemberStack>
              ))
            )}
          </MemberSurface>
        </MemberSection>

        <MemberSection heading="Details">
          <MemberSurface padded>
            {selected ? (
              <>
                <MemberPanelHeader eyebrow={activeSection === "bookings" ? "Reservation" : "Appointment"} title={selected.detailTitle ?? selected.resourceName} />
                <MemberText variant="subtitle">{selected.detailSubtitle ?? `${formatBookingDate(selected.date)} | ${selected.time}`}</MemberText>
                <MemberGrid columns={2}>
                  <StatTile label="Status" value={formatStatusLabel(selected.status)} tone={getStatusTone(selected.status)} />
                  <StatTile label="Amount Due" value={`PHP ${selected.amountDueNow ?? 0}`} tone="brand" />
                </MemberGrid>
                {activeSection === "appointments" ? (
                  <div
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: 16,
                      backgroundColor: colors.surface,
                      display: "grid",
                      gap: 10,
                      marginTop: 16,
                      padding: 16,
                    }}
                  >
                    <MemberText variant="brand">Session Timeline</MemberText>
                    {[
                      {
                        label: "Booking requested",
                        meta: `${formatBookingDate(selected.date)} | ${selected.time}`,
                        tone: colors.textMuted,
                      },
                      {
                        label: formatStatusLabel(selected.status),
                        meta:
                          selected.bookingType === "recurring"
                            ? "Recurring plan session"
                            : "One-time coaching session",
                        tone: colors.brand,
                      },
                      ...(selected.status === "completed"
                        ? [
                            {
                              label: "Session completed",
                              meta: "Coach report and member review unlock after completion.",
                              tone: colors.success,
                            },
                          ]
                        : []),
                    ].map((item, index, items) => (
                      <div key={`${item.label}-${index}`} style={{ display: "grid", gridTemplateColumns: "18px 1fr", gap: 10 }}>
                        <div style={{ alignItems: "center", display: "flex", flexDirection: "column" }}>
                          <span
                            style={{
                              backgroundColor: item.tone,
                              borderRadius: 999,
                              display: "block",
                              height: 10,
                              marginTop: 4,
                              width: 10,
                            }}
                          />
                          {index < items.length - 1 ? (
                            <span style={{ borderLeft: `1px dotted ${colors.border}`, flex: 1, minHeight: 24 }} />
                          ) : null}
                        </div>
                        <div style={{ display: "grid", gap: 2, paddingBottom: 10 }}>
                          <MemberText variant="brand">{item.label}</MemberText>
                          <MemberText variant="subtitle">{item.meta}</MemberText>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {selected.status === "confirmed" || selected.status === "pending" ? (
                  <FitButton
                    variant="danger"
                    label="Cancel Booking"
                    disabled={data.cancelBookingMutation.isPending || data.cancelAppointmentMutation.isPending}
                    onClick={() => {
                      if (activeSection === "bookings") {
                        void data.cancelBookingMutation.mutateAsync({
                          bookingId: selected.id,
                          cancelReason: "Cancelled from the member web portal.",
                          userId: user?.id,
                        });
                      } else {
                        void data.cancelAppointmentMutation.mutateAsync({
                          appointmentId: selected.id,
                          cancelReason: "Cancelled from the member web portal.",
                          userId: user?.id,
                        });
                      }
                    }}
                  />
                ) : null}
                {canReviewCoach ? (
                  <div
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: 16,
                      backgroundColor: colors.surface,
                      display: "grid",
                      gap: 12,
                      marginTop: 16,
                      padding: 16,
                    }}
                  >
                    <div style={{ display: "grid", gap: 4 }}>
                      <MemberText variant="brand">Coach Feedback</MemberText>
                      <MemberText variant="subtitle">
                        Share how this completed session went so staff and the coaching team can review it.
                      </MemberText>
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      <MemberText variant="subtitle">Session Rating</MemberText>
                      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
                        {[1, 2, 3, 4, 5].map((value) => (
                          <FitButton
                            key={value}
                            variant={reviewRating === value ? "primary" : "ghost"}
                            label={`${value}`}
                            onClick={() => setReviewRating(value)}
                          />
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      <MemberText variant="subtitle">Comments</MemberText>
                      <FitTextArea
                        value={reviewComment}
                        onChange={(event) => {
                          setReviewComment(event.target.value);
                          if (reviewState) {
                            setReviewState(null);
                          }
                        }}
                        placeholder="What stood out about the coaching, pace, or guidance?"
                        rows={4}
                        maxLength={1000}
                        disabled={data.submitCoachReviewMutation.isPending}
                      />
                    </div>
                    {reviewState ? (
                      <FitText
                        style={{
                          color: reviewState.tone === "success" ? colors.success : colors.danger,
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        {reviewState.text}
                      </FitText>
                    ) : null}
                    <div style={{ display: "flex", gap: 10 }}>
                      <FitButton
                        variant="ghost"
                        label="Clear"
                        flex={1}
                        disabled={data.submitCoachReviewMutation.isPending && !reviewComment}
                        onClick={() => {
                          setReviewComment("");
                          setReviewRating(5);
                          setReviewState(null);
                        }}
                      />
                      <FitButton
                        variant="primary"
                        label="Submit Feedback"
                        loading={data.submitCoachReviewMutation.isPending}
                        loadingLabel="Submitting Feedback"
                        flex={1}
                        onClick={() => void handleCoachReviewSubmit()}
                      />
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <EmptyState icon={CalendarCheck} title="Select a record" hint="Booking details will appear here." />
            )}
          </MemberSurface>
        </MemberSection>
      </div>
        </>
      )}
    </MemberOnlyScreen>
  );
}
