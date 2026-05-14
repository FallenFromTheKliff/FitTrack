"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, CalendarDays, Dumbbell } from "lucide-react";
import { formatBookingDate, formatGroupLabel, groupItemsByDate } from "@fittrack/utils";

import FitButton from "@/components/fit/FitButton";
import FitSearch from "@/components/fit/FitSearch";
import { FitText, FitTextArea } from "@/components/fit/FitText";
import { FilterChips } from "@/components/member-only/MemberOnlyPageControls";
import {
  EmptyState,
  MemberCard,
  MemberGrid,
  MemberOnlyScreen,
  MemberPanelHeader,
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
import { useMemberOnlyAccess, useMemberOnlyBookingsData } from "@/hooks/member-only/useMemberOnlyData";

export default function BookingsPage() {
  const { colors } = useTheme();
  const { user } = useMemberOnlyAccess("Bookings");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState<BookingSection>("bookings");
  const [statusFilter, setStatusFilter] = useState<BookingStatusFilter>("all");
  const [selectedBooking, setSelectedBooking] = useState<MemberBookingItem | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewState, setReviewState] = useState<{
    text: string;
    tone: "danger" | "success";
  } | null>(null);
  const data = useMemberOnlyBookingsData(user?.id);
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
        Venue reservations and coaching appointments are read from the shared booking contract.
      </MemberText>

      <MemberSurface padded>
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
    </MemberOnlyScreen>
  );
}
