"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Users,
} from "lucide-react";
import type {
  StaffAppointmentRecord,
  VenueBookingRecord,
} from "@fittrack/api-client";
import {
  adminBookingsQueryOptions,
  staffAppointmentsQueryOptions,
  staffBookingsQueryOptions,
} from "@fittrack/query";

import { FitButton, FitPill, FitText } from "@/components/fit";
import { FitModal } from "@/components/modals";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { webApiClient } from "@/lib/api-client";

import {
  getAppointmentStatusColor,
  getCoachDisplayName,
  getPersonDisplayName,
  getReadableStatus,
} from "./operationsUtils";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type CalendarEvent = {
  color: string;
  end: Date;
  id: string;
  kind: "coach" | "venue";
  primaryLabel: string;
  secondaryLabel: string;
  start: Date;
  status: string;
  title: string;
};

function toDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthBounds(value: Date) {
  const start = new Date(value.getFullYear(), value.getMonth(), 1);
  const end = new Date(value.getFullYear(), value.getMonth() + 1, 0);
  return { end, start };
}

function formatEventTime(start: Date, end: Date) {
  const format = (value: Date) =>
    value.toLocaleTimeString("en-PH", {
      hour: "numeric",
      minute: "2-digit",
    });
  return `${format(start)} - ${format(end)}`;
}

export function GymOperationsMonthCalendar() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const isAdmin = user?.role === "ADMIN";
  const isStaff = user?.role === "STAFF";
  const { start: monthStart, end: monthEnd } = useMemo(
    () => getMonthBounds(visibleMonth),
    [visibleMonth],
  );
  const monthFilters = useMemo(
    () => ({
      endDate: toDateKey(monthEnd),
      limit: 100,
      startDate: toDateKey(monthStart),
    }),
    [monthEnd, monthStart],
  );

  const appointmentsQuery = useQuery({
    ...staffAppointmentsQueryOptions<StaffAppointmentRecord>(webApiClient, {
      ...monthFilters,
      page: 1,
    }),
    enabled: isAdmin || isStaff,
    staleTime: 30_000,
  });
  const adminBookingsQuery = useQuery({
    ...adminBookingsQueryOptions<VenueBookingRecord>(
      webApiClient,
      monthFilters,
    ),
    enabled: isAdmin,
    staleTime: 30_000,
  });
  const staffBookingsQuery = useQuery({
    ...staffBookingsQueryOptions<VenueBookingRecord>(
      webApiClient,
      "all",
      monthFilters,
    ),
    enabled: isStaff,
    staleTime: 30_000,
  });

  const appointments = useMemo(
    () => appointmentsQuery.data?.data ?? [],
    [appointmentsQuery.data?.data],
  );
  const venueBookings = useMemo(
    () =>
      isAdmin
        ? adminBookingsQuery.data ?? []
        : staffBookingsQuery.data ?? [],
    [adminBookingsQuery.data, isAdmin, staffBookingsQuery.data],
  );
  const events = useMemo<CalendarEvent[]>(() => {
    const coachEvents = appointments.map((appointment) => {
      const start = new Date(appointment.scheduledAt);
      const end = new Date(start.getTime() + appointment.duration * 60_000);
      const status = appointment.status ?? "pending";
      const memberName = getPersonDisplayName(
        appointment.user?.profile,
        appointment.user?.email,
        "Member",
      );
      const coachName = getCoachDisplayName(appointment.coach, "Coach");

      return {
        color: getAppointmentStatusColor(status, colors),
        end,
        id: `coach-${appointment.id}`,
        kind: "coach" as const,
        primaryLabel: `Coach: ${coachName}`,
        secondaryLabel: `Client: ${memberName}`,
        start,
        status,
        title: appointment.recurringPlanId
          ? "Recurring coach session"
          : "Coach session",
      };
    });
    const venueEvents = venueBookings.map((booking) => {
      const start = new Date(booking.startTime);
      const end = new Date(booking.endTime);
      const status = booking.status ?? "pending";
      const memberName = getPersonDisplayName(
        booking.user?.profile,
        booking.user?.email,
        "Member",
      );

      return {
        color: getAppointmentStatusColor(status, colors),
        end,
        id: `venue-${booking.id}`,
        kind: "venue" as const,
        primaryLabel:
          booking.venue?.name ?? `Venue ${String(booking.venueId)}`,
        secondaryLabel: `Client: ${memberName}`,
        start,
        status,
        title: booking.purpose?.trim() || "Venue booking",
      };
    });

    return [...coachEvents, ...venueEvents].sort(
      (left, right) => left.start.getTime() - right.start.getTime(),
    );
  }, [appointments, colors, venueBookings]);
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      const key = toDateKey(event.start);
      grouped.set(key, [...(grouped.get(key) ?? []), event]);
    });
    return grouped;
  }, [events]);
  const calendarDays = useMemo(() => {
    const firstWeekday = monthStart.getDay();
    const daysInMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + 1,
      0,
    ).getDate();
    const calendarCellCount =
      Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

    return Array.from({ length: calendarCellCount }, (_, index) => {
      const dayNumber = index - firstWeekday + 1;
      return new Date(
        visibleMonth.getFullYear(),
        visibleMonth.getMonth(),
        dayNumber,
      );
    });
  }, [monthStart, visibleMonth]);
  const selectedEvents = selectedDate
    ? eventsByDate.get(toDateKey(selectedDate)) ?? []
    : [];
  const selectedDateLabel = selectedDate
    ? selectedDate.toLocaleDateString("en-PH", {
        day: "numeric",
        month: "long",
        weekday: "long",
        year: "numeric",
      })
    : "Selected day";
  const monthLabel = visibleMonth.toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });
  const isLoading =
    appointmentsQuery.isLoading ||
    (isAdmin ? adminBookingsQuery.isLoading : staffBookingsQuery.isLoading);

  return (
    <>
      <section
        aria-label={`Gym Operations calendar for ${monthLabel}`}
        data-ui="gym-operations-month-calendar"
        style={{
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            alignItems: "center",
            backgroundColor: colors.surfaceRaised,
            borderBottom: `1px solid ${colors.border}`,
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "space-between",
            minHeight: 58,
            padding: "10px 12px",
          }}
        >
          <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
            <CalendarDays color={colors.brand} size={19} />
            <div style={{ display: "grid", gap: 2 }}>
              <FitText style={{ fontSize: 15, fontWeight: 900 }}>
                {monthLabel}
              </FitText>
              <FitText style={{ color: colors.textMuted, fontSize: 11.5 }}>
                Select a day to see every coach session and venue booking.
              </FitText>
            </div>
          </div>
          <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
            <FitButton
              aria-label="Previous month"
              icon={ChevronLeft}
              iconOnly
              variant="ghost"
              onClick={() =>
                setVisibleMonth(
                  (current) =>
                    new Date(current.getFullYear(), current.getMonth() - 1, 1),
                )
              }
            />
            <FitButton
              label="TODAY"
              variant="ghost"
              onClick={() => {
                const today = new Date();
                setVisibleMonth(
                  new Date(today.getFullYear(), today.getMonth(), 1),
                );
                setSelectedDate(today);
              }}
            />
            <FitButton
              aria-label="Next month"
              icon={ChevronRight}
              iconOnly
              variant="ghost"
              onClick={() =>
                setVisibleMonth(
                  (current) =>
                    new Date(current.getFullYear(), current.getMonth() + 1, 1),
                )
              }
            />
          </div>
        </div>

        <div
          aria-hidden
          style={{
            borderBottom: `1px solid ${colors.border}`,
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          }}
        >
          {WEEKDAY_LABELS.map((weekday) => (
            <FitText
              key={weekday}
              style={{
                color: colors.textMuted,
                fontSize: 10.5,
                fontWeight: 900,
                padding: "9px 8px",
                textAlign: "center",
                textTransform: "uppercase",
              }}
            >
              {weekday}
            </FitText>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          }}
        >
          {calendarDays.map((day) => {
            const inVisibleMonth = day.getMonth() === visibleMonth.getMonth();
            const dayEvents = inVisibleMonth
              ? eventsByDate.get(toDateKey(day)) ?? []
              : [];
            const isToday = toDateKey(day) === toDateKey(new Date());

            return (
              <button
                key={toDateKey(day)}
                type="button"
                disabled={!inVisibleMonth}
                aria-label={
                  inVisibleMonth
                    ? `${day.toLocaleDateString("en-PH", {
                        day: "numeric",
                        month: "long",
                      })}, ${dayEvents.length} schedule${dayEvents.length === 1 ? "" : "s"}`
                    : undefined
                }
                onClick={() => setSelectedDate(day)}
                style={{
                  backgroundColor: inVisibleMonth
                    ? colors.surface
                    : colors.surfaceRaised,
                  border: "none",
                  borderBottom: `1px solid ${colors.border}`,
                  borderRight: `1px solid ${colors.border}`,
                  color: colors.textPrimary,
                  cursor: inVisibleMonth ? "pointer" : "default",
                  minHeight: 92,
                  opacity: inVisibleMonth ? 1 : 0.28,
                  padding: 9,
                  textAlign: "left",
                }}
              >
                {inVisibleMonth ? (
                  <div
                    style={{
                      display: "grid",
                      gap: 10,
                      height: "100%",
                      justifyItems: "start",
                    }}
                  >
                    <span
                      style={{
                        alignItems: "center",
                        backgroundColor: isToday
                          ? colors.brand
                          : "transparent",
                        borderRadius: 999,
                        color: isToday ? colors.onBrand : colors.textPrimary,
                        display: "inline-flex",
                        fontSize: 12,
                        fontWeight: 900,
                        height: 25,
                        justifyContent: "center",
                        width: 25,
                      }}
                    >
                      {day.getDate()}
                    </span>
                    {dayEvents.length > 0 ? (
                      <div
                        data-volatile="schedule-count"
                        style={{
                          alignItems: "center",
                          alignSelf: "end",
                          display: "flex",
                          gap: 4,
                          minWidth: 0,
                        }}
                      >
                        {dayEvents.slice(0, 3).map((event) => (
                          <span
                            key={event.id}
                            style={{
                              backgroundColor: event.color,
                              borderRadius: 999,
                              height: 7,
                              width: 7,
                            }}
                          />
                        ))}
                        <FitText
                          style={{
                            color: colors.textMuted,
                            fontSize: 10.5,
                            fontWeight: 800,
                            marginLeft: 3,
                          }}
                        >
                          {dayEvents.length}
                        </FitText>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div
            style={{
              borderTop: `1px solid ${colors.border}`,
              color: colors.textMuted,
              fontSize: 12,
              padding: 10,
              textAlign: "center",
            }}
          >
            Loading this month&apos;s schedules...
          </div>
        ) : null}
      </section>

      <FitModal
        isOpen={selectedDate !== null}
        title={selectedDateLabel}
        subtitle={`${selectedEvents.length} schedule${selectedEvents.length === 1 ? "" : "s"} for this day`}
        icon={CalendarDays}
        maxWidth={760}
        onClose={() => setSelectedDate(null)}
        footer={
          <FitButton
            label="CLOSE"
            variant="ghost"
            onClick={() => setSelectedDate(null)}
          />
        }
      >
        {selectedEvents.length > 0 ? (
          <div
            data-ui="gym-operations-day-schedule-list"
            style={{ display: "grid", gap: 9 }}
          >
            {selectedEvents.map((event) => (
              <article
                key={event.id}
                style={{
                  alignItems: "center",
                  backgroundColor: colors.surfaceRaised,
                  border: `1px solid ${colors.border}`,
                  borderLeft: `4px solid ${event.color}`,
                  borderRadius: 8,
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "minmax(130px, 0.65fr) minmax(0, 1.5fr) auto",
                  padding: "11px 12px",
                }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <FitText style={{ fontSize: 12, fontWeight: 900 }}>
                    {formatEventTime(event.start, event.end)}
                  </FitText>
                  <FitText style={{ color: colors.textMuted, fontSize: 10.5 }}>
                    {event.kind === "coach" ? "Coach session" : "Venue booking"}
                  </FitText>
                </div>
                <div style={{ display: "grid", gap: 5, minWidth: 0 }}>
                  <FitText style={{ fontSize: 12.5, fontWeight: 800 }}>
                    {event.title}
                  </FitText>
                  <div
                    style={{
                      alignItems: "center",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 10,
                    }}
                  >
                    <FitText
                      style={{
                        alignItems: "center",
                        color: colors.textSecondary,
                        display: "inline-flex",
                        fontSize: 11,
                        gap: 5,
                      }}
                    >
                      {event.kind === "coach" ? (
                        <Users size={13} />
                      ) : (
                        <MapPin size={13} />
                      )}
                      {event.primaryLabel}
                    </FitText>
                    <FitText
                      style={{ color: colors.textMuted, fontSize: 11 }}
                    >
                      {event.secondaryLabel}
                    </FitText>
                  </div>
                </div>
                <FitPill
                  mode="status"
                  label={getReadableStatus(event.status).toUpperCase()}
                  color={event.color}
                  fontSize={9}
                  fontWeight={800}
                />
              </article>
            ))}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 7,
              minHeight: 160,
              placeContent: "center",
              textAlign: "center",
            }}
          >
            <CalendarDays color={colors.textMuted} size={28} />
            <FitText style={{ fontSize: 14, fontWeight: 900 }}>
              No schedules on this day
            </FitText>
            <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
              Coach sessions and venue bookings will appear here.
            </FitText>
          </div>
        )}
      </FitModal>
    </>
  );
}
