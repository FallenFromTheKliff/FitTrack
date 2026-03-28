"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragOverlay, type DragStartEvent, type DragEndEvent } from "@dnd-kit/core";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { MotionStyle } from "framer-motion";
import { adminMembersQueryOptions } from "@fittrack/query";

import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSchedule, type VenueBookingRecord } from "@/contexts/ScheduleContext";
import { webApiClient } from "@/lib/api-client";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useDebounce, useTimedMessage } from "@fittrack/hooks";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { usePowerSlide } from "@/hooks/animations/usePowerSlide";
import { useFitSensors } from "@/hooks/useFitSensors";
import { FEEDBACK_DURATION_MS } from "@/constants/feedback";
import { formatWeekRange, toYmd } from "@fittrack/utils";

import { FitButton, FitPill, FitSection, FitTable, FitText } from "@/components/fit";
import type { FitTableColumn } from "@/components/fit/FitTable";
import { BlockDetailModal, CalendarModal, StaffDetailsModal } from "@/components/modals";

import { RosterPanel, WeeklyTimeline } from "@/components/schedule";
import type { Booking, Resource } from "@/components/schedule";

import { HOURS, getWeekStart, addDays, mapMembersToStaff, buildManualBooking } from "./helpers";

export default function SchedulePage() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const {
    bookings: scheduleBookings,
    rawBookings,
    isLoading: scheduleLoading,
    confirmBooking,
    rejectBooking
  } = useSchedule();
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();
  const { message, showMessage } = useTimedMessage(FEEDBACK_DURATION_MS.standard);

  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [slideKey, setSlideKey] = useState(0);
  const [slideDir, setSlideDir] = useState<"left" | "right">("right");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { style: slideStyle } = usePowerSlide(slideKey, slideDir);

  const prevWeek = () => {
    setSlideDir("left");
    setSlideKey((k) => k + 1);
    setWeekStart((d) => addDays(d, -7));
  };
  const nextWeek = () => {
    setSlideDir("right");
    setSlideKey((k) => k + 1);
    setWeekStart((d) => addDays(d, 7));
  };

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const [staffQuery, setStaffQuery] = useState("");
  const debouncedQuery = useDebounce(staffQuery, 250);
  const [manualBookings, setManualBookings] = useState<Booking[]>([]);
  const [draggingStaff, setDraggingStaff] = useState<Resource | null>(null);

  const { data: allMembers = [] } = useQuery({
    ...adminMembersQueryOptions(webApiClient),
    staleTime: 60_000
  });

  const staffMembers = useMemo(() => mapMembersToStaff(allMembers), [allMembers]);

  const apiBookings = useMemo<Booking[]>(
    () => scheduleBookings.map((b) => ({ ...b, source: "api" as const })),
    [scheduleBookings]
  );

  const allBookings = useMemo(
    () => [...apiBookings, ...manualBookings],
    [apiBookings, manualBookings]
  );

  const filteredStaff = useMemo(
    () =>
      staffMembers.filter((s) =>
        s.name.toLowerCase().includes(debouncedQuery.toLowerCase())
      ),
    [staffMembers, debouncedQuery]
  );

  const sensors = useFitSensors();

  const handleDragStart = (event: DragStartEvent) => {
    const staff = staffMembers.find((s) => s.id === event.active.id);
    if (staff) setDraggingStaff(staff);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingStaff(null);
    if (!event.over || !isAdmin) return;
    const [dayIdxStr, hourStr] = String(event.over.id).split(":");
    const dayIdx = Number(dayIdxStr);
    const hour = Number(hourStr);
    const staff = staffMembers.find((s) => s.id === event.active.id);
    if (!staff || isNaN(dayIdx) || isNaN(hour)) return;
    const booking = buildManualBooking(staff, weekDays[dayIdx], hour, colors.brand);
    setManualBookings((prev) => [...prev, booking]);
    showMessage(`${staff.name} assigned to ${weekDays[dayIdx].toLocaleDateString("en-US", { weekday: "short" })} ${hour}:00`);
  };

  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);
  const [staffDetailsOpen, setStaffDetailsOpen] = useState(false);

  const handleStaffClick = (staffId: string) => {
    setActiveStaffId(staffId);
    setStaffDetailsOpen(true);
  };

  const [activeBlock, setActiveBlock] = useState<Booking | null>(null);
  const [blockDetailOpen, setBlockDetailOpen] = useState(false);

  const handleBlockClick = (block: Booking) => {
    setActiveBlock(block);
    setBlockDetailOpen(true);
  };

  const handleBlockSave = (updated: Booking) => {
    setManualBookings((prev) =>
      prev.map((b) => (b.id === updated.id ? updated : b))
    );
    setBlockDetailOpen(false);
    setActiveBlock(null);
  };

  const handleBlockDelete = (id: string) => {
    setManualBookings((prev) => prev.filter((b) => b.id !== id));
    setBlockDetailOpen(false);
    setActiveBlock(null);
  };

  const leftScrollRef = useRef<HTMLDivElement | null>(null);
  const rightScrollRef = useRef<HTMLDivElement | null>(null);
  const [leftMaxHeight, setLeftMaxHeight] = useState<number | null>(null);
  const [rightMaxHeight, setRightMaxHeight] = useState<number | null>(null);

  useEffect(() => {
    const recalc = () => {
      const logoutBtn = document.querySelector(
        'button[aria-label="SIGN OUT"]'
      ) as HTMLElement | null;
      if (!logoutBtn) return;
      const bottom = logoutBtn.getBoundingClientRect().bottom;
      if (leftScrollRef.current) {
        setLeftMaxHeight(
          Math.max(240, Math.floor(bottom - leftScrollRef.current.getBoundingClientRect().top))
        );
      }
      if (rightScrollRef.current) {
        setRightMaxHeight(
          Math.max(240, Math.floor(bottom - rightScrollRef.current.getBoundingClientRect().top))
        );
      }
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    if (leftScrollRef.current) ro.observe(leftScrollRef.current);
    if (rightScrollRef.current) ro.observe(rightScrollRef.current);
    window.addEventListener("resize", recalc);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recalc);
    };
  }, []);

  const activeStaff = staffMembers.find((s) => s.id === activeStaffId);

  const staffColumns: FitTableColumn<VenueBookingRecord>[] = [
    {
      key: "member",
      heading: "MEMBER",
      render: (booking, c) => {
        const firstName = booking.user?.profile?.firstName?.trim() ?? "";
        const lastName = booking.user?.profile?.lastName?.trim() ?? "";
        const label = `${firstName} ${lastName}`.trim() || booking.user?.email || "Member";
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <FitText style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary }}>{label}</FitText>
            <FitText style={{ fontSize: 12, color: c.textMuted }}>{booking.user?.email ?? "-"}</FitText>
          </div>
        );
      }
    },
    {
      key: "venue",
      heading: "VENUE",
      render: (booking, c) => <FitText style={{ fontSize: 14, color: c.textPrimary }}>{booking.venue?.name ?? `Venue ${booking.venueId}`}</FitText>
    },
    {
      key: "time",
      heading: "SCHEDULE",
      render: (booking, c) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <FitText style={{ fontSize: 14, color: c.textPrimary }}>{new Date(booking.startTime).toLocaleDateString()}</FitText>
          <FitText style={{ fontSize: 12, color: c.textMuted }}>
            {new Date(booking.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - {new Date(booking.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </FitText>
        </div>
      )
    },
    {
      key: "status",
      heading: "STATUS",
      render: (booking, c) => {
        const color = booking.status === "pending"
          ? c.warning
          : booking.status === "confirmed"
            ? c.success
            : booking.status === "completed"
              ? c.textMuted
              : c.danger;
        return <FitPill mode="status" label={booking.status.toUpperCase()} color={color} fontSize={13} />;
      }
    },
    {
      key: "purpose",
      heading: "PURPOSE",
      render: (booking, c) => <FitText style={{ fontSize: 13, color: c.textMuted }}>{booking.purpose ?? "-"}</FitText>
    }
  ];

  if (!isAdmin) {
    const pendingBookings = rawBookings.filter((booking) => booking.status === "pending");

    return (
      <FitSection as="section" heading="" hideHeading bare noPadding className={themeTransition} style={fadeIn}>
        {message ? (
          <div style={{ marginBottom: 12 }}>
            <FitText style={{ fontSize: 14, color: colors.success, fontWeight: 500 }}>{message}</FitText>
          </div>
        ) : null}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 16 }}>
          <div style={{ padding: 14, border: `1px solid ${colors.border}`, borderRadius: 12, backgroundColor: colors.surface }}>
            <FitText style={{ fontSize: 12, color: colors.textMuted }}>Pending Approvals</FitText>
            <FitText style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{pendingBookings.length}</FitText>
          </div>
          <div style={{ padding: 14, border: `1px solid ${colors.border}`, borderRadius: 12, backgroundColor: colors.surface }}>
            <FitText style={{ fontSize: 12, color: colors.textMuted }}>Confirmed Bookings</FitText>
            <FitText style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{rawBookings.filter((booking) => booking.status === "confirmed").length}</FitText>
          </div>
          <div style={{ padding: 14, border: `1px solid ${colors.border}`, borderRadius: 12, backgroundColor: colors.surface }}>
            <FitText style={{ fontSize: 12, color: colors.textMuted }}>All Visible Bookings</FitText>
            <FitText style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{rawBookings.length}</FitText>
          </div>
        </div>
        <FitSection heading="Booking Operations" className="mb-0">
          <FitTable
            columns={staffColumns}
            rows={rawBookings}
            getRowKey={(booking) => booking.id}
            isLoading={scheduleLoading}
            loadingMessage="Loading staff bookings..."
            emptyMessage="No bookings available."
            actions={[
              {
                label: "Confirm",
                variant: "primary",
                disabled: (booking: VenueBookingRecord) => booking.status !== "pending",
                onClick: async (booking: VenueBookingRecord) => {
                  const result = await confirmBooking(booking.id);
                  showMessage(result.success ? "Booking confirmed." : result.error ?? "Failed to confirm booking.");
                }
              },
              {
                label: "Reject",
                variant: "danger",
                disabled: (booking: VenueBookingRecord) => booking.status !== "pending",
                onClick: async (booking: VenueBookingRecord) => {
                  const result = await rejectBooking(booking.id, "Rejected by staff.");
                  showMessage(result.success ? "Booking rejected." : result.error ?? "Failed to reject booking.");
                }
              }
            ]}
          />
        </FitSection>
      </FitSection>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <FitSection as="section" heading="" hideHeading bare noPadding className={themeTransition} style={fadeIn}>
        {message && (
          <div style={{ marginBottom: 12 }}>
            <FitText style={{ fontSize: 14, color: colors.success, fontWeight: 500 }}>
              {message}
            </FitText>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, alignItems: "start" }}>
          <RosterPanel
            scrollRef={leftScrollRef}
            maxHeight={leftMaxHeight}
            staffQuery={staffQuery}
            onStaffQueryChange={setStaffQuery}
            filteredStaff={filteredStaff}
            bookings={allBookings}
            isAdmin={isAdmin}
            onStaffClick={handleStaffClick}
          />
          <FitSection heading="Weekly Schedule" hideHeading>
            <div ref={rightScrollRef} style={{ maxHeight: rightMaxHeight ?? undefined, overflowY: "auto" }}>
              <div style={{ padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <FitButton
                    variant="ghost"
                    iconOnly
                    icon={ChevronLeft}
                    iconSize={18}
                    onClick={prevWeek}
                    aria-label="Previous week"
                  />
                  <FitButton
                    variant="ghost"
                    onClick={() => setCalendarOpen(true)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "5px 10px",
                      borderRadius: 8,
                      backgroundColor: `${colors.brand}12`
                    }}
                    aria-label="Pick week"
                  >
                    <CalendarDays size={17} color={colors.brand} strokeWidth={2} />
                    <FitText style={{ fontSize: 15, fontWeight: 700, color: colors.brand }}>
                      {formatWeekRange(weekStart)}
                    </FitText>
                  </FitButton>
                  <FitButton
                    variant="ghost"
                    iconOnly
                    icon={ChevronRight}
                    iconSize={18}
                    onClick={nextWeek}
                    aria-label="Next week"
                  />
                </div>
                <WeeklyTimeline
                  weekDays={weekDays}
                  hours={HOURS}
                  bookings={allBookings}
                  slideStyle={slideStyle as MotionStyle}
                  isLoading={scheduleLoading}
                  colors={colors}
                  onBlockClick={handleBlockClick}
                />
              </div>
            </div>
          </FitSection>
        </div>
        <StaffDetailsModal
          isOpen={staffDetailsOpen && isAdmin}
          staffId={activeStaffId ?? ""}
          staffName={activeStaff?.name ?? "Staff"}
          bookings={allBookings.filter((b) => b.resourceId === activeStaffId)}
          colors={colors}
          onClose={() => {
            setStaffDetailsOpen(false);
            setActiveStaffId(null);
          }}
        />
        <BlockDetailModal
          isOpen={blockDetailOpen}
          block={activeBlock}
          staffMembers={staffMembers}
          onSave={handleBlockSave}
          onDelete={handleBlockDelete}
          onClose={() => {
            setBlockDetailOpen(false);
            setActiveBlock(null);
          }}
        />
        <CalendarModal
          isOpen={calendarOpen}
          selectedDate={toYmd(weekStart)}
          onSelect={(ymd) => {
            if (!ymd) return;
            const [y, m, d] = ymd.split("-").map(Number);
            if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
              setWeekStart(getWeekStart(new Date(y, m - 1, d)));
            }
          }}
          onClose={() => setCalendarOpen(false)}
        />
      </FitSection>
      <DragOverlay>
        {draggingStaff ? (
          <div
            style={{
              backgroundColor: colors.brand,
              color: colors.onBrand ?? colors.surface,
              borderRadius: 10,
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 600,
              boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
              opacity: 0.9,
              pointerEvents: "none"
            }}
          >
            {draggingStaff.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}