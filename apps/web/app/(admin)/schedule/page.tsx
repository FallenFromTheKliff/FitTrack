"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MotionStyle } from "framer-motion";

import { useTheme } from "@/contexts/ThemeContext";
import { useSchedule } from "@/contexts/ScheduleContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useDebounce, useLoadingText, useTimedMessage } from "@fittrack/hooks";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { usePowerSlide } from "@/hooks/animations/usePowerSlide";
import { FEEDBACK_DURATION_MS } from "@/constants/feedback";
import { sleep } from "@/utils/sleep";
import { SCHEDULE_EMOJI_OPTIONS, SCHEDULE_STATS, STAFF_ACTIVITY, BOOKING_FIELDS, DEFAULT_FACILITY_ICON, DEFAULT_STAFF_ICON } from "@/data/schedule/schedule";
import { api } from "@/lib/axios";
import type { MemberRecord } from "@fittrack/types";
import type { FieldConfig } from "@/components/modals/DetailsModal";

import { FitText, FitTextInput } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitPill from "@/components/fit/FitPill";
import { FitSelect } from "@/components/fit/FitCard";
import FitSection from "@/components/fit/FitSection";
import DetailsModal from "@/components/modals/DetailsModal";
import CalendarModal from "@/components/modals/CalendarModal";

import { RosterPanel, AdminViewPanel, StaffViewPanel, type Resource, type Booking } from "@/components/schedule";

const MIN_ACTION_DELAY_MS = FEEDBACK_DURATION_MS.standard;

function getInitials(member: MemberRecord): string {
  const first = member.profile?.firstName?.trim().charAt(0) ?? "";
  const last = member.profile?.lastName?.trim().charAt(0) ?? "";
  if (first || last) return `${first}${last}`.toUpperCase();
  return member.email.slice(0, 2).toUpperCase();
}

function deriveResourcesFromBookings(bookings: Booking[], manualResources: Resource[]): Resource[] {
  const byId = new Map<string, Resource>();
  bookings.forEach((b) => {
    if (!byId.has(b.resourceId)) {
      byId.set(b.resourceId, { id: b.resourceId, name: b.resourceName, type: "facility", icon: DEFAULT_FACILITY_ICON });
    } else {
      const r = byId.get(b.resourceId);
      if (r) r.name = b.resourceName;
    }
  });
  manualResources.forEach((r) => byId.set(r.id, r));
  return Array.from(byId.values());
}

type AdminView = "summary" | "resources";
type StaffView = "activities" | "schedule";

export default function SchedulePage() {
  const { colors } = useTheme();
  const { bookings: scheduleBookings, isLoading: scheduleLoading, confirmBooking, rejectBooking } = useSchedule();
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();
  const { message, showMessage } = useTimedMessage(2500);

  const [date, setDate] = useState(new Date("2026-03-11"));
  const [dateSlideKey, setDateSlideKey] = useState(0);
  const [dateSlideDir, setDateSlideDir] = useState<"left" | "right">("right");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { style: dateSlideStyle } = usePowerSlide(dateSlideKey, dateSlideDir);
  const selectedYmd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  const prevDay = () => { setDateSlideDir("left"); setDateSlideKey((k) => k + 1); setDate((d) => new Date(d.getTime() - 86400000)); };
  const nextDay = () => { setDateSlideDir("right"); setDateSlideKey((k) => k + 1); setDate((d) => new Date(d.getTime() + 86400000)); };

  const [activePersona, setActivePersona] = useState("admin");
  const [adminView, setAdminView] = useState<AdminView>("summary");
  const [staffView, setStaffView] = useState<StaffView>("schedule");
  const [staffQuery, setStaffQuery] = useState("");
  const debouncedStaffQuery = useDebounce(staffQuery, 250);
  const isAdminView = activePersona === "admin";

  const handleSelectPersona = (id: string) => {
    setActivePersona(id);
    if (id === "admin") setAdminView("summary");
    else setStaffView("activities");
  };

  const [rawViewportWidth, setRawViewportWidth] = useState(0);
  const debouncedViewportWidth = useDebounce(rawViewportWidth, 120);
  const isCompact = debouncedViewportWidth > 0 && debouncedViewportWidth <= (window.screen?.availWidth || window.screen?.width || window.innerWidth) * 0.6;

  useEffect(() => {
    const evaluate = () => setRawViewportWidth(window.outerWidth || window.innerWidth);
    evaluate();
    window.addEventListener("resize", evaluate);
    return () => window.removeEventListener("resize", evaluate);
  }, []);

  const leftScrollRef = useRef<HTMLDivElement | null>(null);
  const rightScrollRef = useRef<HTMLDivElement | null>(null);
  const [leftMaxHeight, setLeftMaxHeight] = useState<number | null>(null);
  const [rightMaxHeight, setRightMaxHeight] = useState<number | null>(null);

  useEffect(() => {
    const recalc = () => {
      const logoutBtn = document.querySelector('button[aria-label="LOG OUT"]') as HTMLButtonElement | null;
      if (!logoutBtn) return;
      const bottom = logoutBtn.getBoundingClientRect().bottom;
      if (leftScrollRef.current) setLeftMaxHeight(Math.max(240, Math.floor(bottom - leftScrollRef.current.getBoundingClientRect().top)));
      if (rightScrollRef.current) setRightMaxHeight(Math.max(240, Math.floor(bottom - rightScrollRef.current.getBoundingClientRect().top)));
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    if (leftScrollRef.current) ro.observe(leftScrollRef.current);
    if (rightScrollRef.current) ro.observe(rightScrollRef.current);
    window.addEventListener("resize", recalc);
    return () => { ro.disconnect(); window.removeEventListener("resize", recalc); };
  }, [activePersona, adminView, staffView]);

  const { data: allMembers = [] } = useQuery<MemberRecord[]>({
    queryKey: ["members"],
    queryFn: async () => { const { data } = await api.get<MemberRecord[]>("/admin/users"); return data; },
    staleTime: 60_000
  });

  const [manualResources, setManualResources] = useState<Resource[]>([]);
  const [manualBookings, setManualBookings] = useState<Booking[]>([]);

  const staffFromApi = useMemo<Resource[]>(() =>
          allMembers
              .filter((m) => m.role?.name === "STAFF" && !m.deletedAt)
              .map((m) => ({
                id: `staff-${m.id}`,
                name: m.profile?.firstName && m.profile?.lastName
                    ? `${m.profile.firstName} ${m.profile.lastName}`.trim()
                    : m.email,
                type: "trainer" as const,
                icon: DEFAULT_STAFF_ICON,
                initials: getInitials(m)
              })),
      [allMembers]
  );

  const apiBookings = useMemo<Booking[]>(() =>
          scheduleBookings.map((b) => ({ ...b, source: "api" as const })),
      [scheduleBookings]
  );

  const bookings = useMemo(() => [...apiBookings, ...manualBookings], [apiBookings, manualBookings]);

  const mergedManualResources = useMemo<Resource[]>(() => {
    const staffIds = new Set(staffFromApi.map((s) => s.id));
    return [...staffFromApi, ...manualResources.filter((r) => !staffIds.has(r.id))];
  }, [staffFromApi, manualResources]);

  const resources = useMemo(() => deriveResourcesFromBookings(bookings, mergedManualResources), [bookings, mergedManualResources]);
  const staffMembers = resources.filter((r) => r.type === "trainer");
  const filteredStaff = useMemo(() =>
          staffMembers.filter((s) => s.name.toLowerCase().includes(debouncedStaffQuery.trim().toLowerCase())),
      [staffMembers, debouncedStaffQuery]
  );
  const activeStaff = staffMembers.find((s) => s.id === activePersona);

  const [bookingActionId, setBookingActionId] = useState<string | null>(null);

  const handleConfirmBooking = async (id: string) => {
    setBookingActionId(id);
    const result = await confirmBooking(id);
    setBookingActionId(null);
    if (!result.success) showMessage(result.error ?? "Unable to confirm booking.");
    else showMessage("Booking confirmed.");
  };

  const handleRejectBooking = async (id: string) => {
    setBookingActionId(id);
    const result = await rejectBooking(id);
    setBookingActionId(null);
    if (!result.success) showMessage(result.error ?? "Unable to reject booking.");
    else showMessage("Booking rejected.");
  };

  const [resourceOpen, setResourceOpen] = useState(false);
  const [resourceLoading, setResourceLoading] = useState(false);
  const resourceLoadingLabel = useLoadingText("ADDING RESOURCE", resourceLoading);
  const [resourceDraft, setResourceDraft] = useState({ name: "", type: "", icon: SCHEDULE_EMOJI_OPTIONS[0] });

  const handleAddResource = async () => {
    const trimmedName = resourceDraft.name.trim();
    if (!trimmedName || !resourceDraft.type) { showMessage("Resource name and type are required."); return; }
    setResourceLoading(true);
    await sleep(MIN_ACTION_DELAY_MS);
    setManualResources((prev) => [
      ...prev,
      { id: `${resourceDraft.type}-${trimmedName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`, name: trimmedName, type: resourceDraft.type as "trainer" | "facility", icon: resourceDraft.icon }
    ]);
    setResourceLoading(false);
    setResourceOpen(false);
    setResourceDraft({ name: "", type: "", icon: SCHEDULE_EMOJI_OPTIONS[0] });
    showMessage(`${trimmedName} added as a resource.`);
  };

  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const bookingLoadingLabel = useLoadingText("CREATING BOOKING", bookingLoading);

  const handleCreateBooking = async (data: Record<string, string>) => {
    const [startH = 0, startM = 0] = (data.startTime ?? "").split(":").map(Number);
    const [endH = 0, endM = 0] = (data.endTime ?? "").split(":").map(Number);
    if ((endH * 60 + endM) <= (startH * 60 + startM)) { showMessage("End time must be after start time."); return; }
    setBookingLoading(true);
    await sleep(MIN_ACTION_DELAY_MS);
    const selectedResource = resources.find((r) => r.id === data.resource);
    setManualBookings((prev) => [
      ...prev,
      {
        id: `booking-${Date.now()}`, title: data.title, resourceId: data.resource,
        resourceName: selectedResource?.name ?? data.resource,
        startHour: startH, startMinute: startM,
        durationMin: (endH * 60 + endM) - (startH * 60 + startM),
        color: data.color || colors.brand, status: "confirmed", source: "manual"
      }
    ]);
    setBookingLoading(false);
    setBookingOpen(false);
    showMessage("Booking added to timeline.");
  };

  const bookingFields: FieldConfig[] = [
    { ...BOOKING_FIELDS[0], options: resources.map((r) => ({ label: r.name, value: r.id })) },
    BOOKING_FIELDS[1], BOOKING_FIELDS[2], BOOKING_FIELDS[3], BOOKING_FIELDS[4]
  ];

  const sharedTimelineProps = {
    compact: isCompact,
    isLoading: scheduleLoading,
    date,
    dateSlideStyle: dateSlideStyle as MotionStyle,
    bookingActionId,
    onPrevDay: prevDay,
    onNextDay: nextDay,
    onOpenCalendar: () => setCalendarOpen(true),
    onConfirmBooking: handleConfirmBooking,
    onRejectBooking: handleRejectBooking,
  };

  return (
      <section className={themeTransition} style={fadeIn}>
        {message && (
            <div style={{ marginBottom: 12 }}>
              <FitText style={{ fontSize: 13, color: colors.success, fontWeight: 500 }}>{message}</FitText>
            </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, alignItems: "start" }}>
          <RosterPanel
              scrollRef={leftScrollRef}
              maxHeight={leftMaxHeight}
              staffQuery={staffQuery}
              onStaffQueryChange={setStaffQuery}
              filteredStaff={filteredStaff}
              bookings={bookings}
              activePersona={activePersona}
              onSelectPersona={handleSelectPersona}
          />
          <FitSection heading={isAdminView ? "Admin Schedule" : `${activeStaff?.name ?? "Staff"} Schedule`} hideHeading>
            <div ref={rightScrollRef} style={{ maxHeight: rightMaxHeight ?? undefined, overflowY: "auto" }}>
              <div style={{ padding: 14 }}>
                <div style={{ marginBottom: 10 }}>
                  <FitPill mode="status" label={isAdminView ? "ADMIN" : "STAFF"} color={colors.brand} fontSize={12} />
                </div>
                {isAdminView ? (
                    <AdminViewPanel
                        adminView={adminView}
                        onAdminViewChange={setAdminView}
                        stats={SCHEDULE_STATS}
                        resources={resources}
                        bookings={bookings}
                        isLoading={scheduleLoading}
                        compact={isCompact}
                        onManageResources={() => setResourceOpen(true)}
                    />
                ) : (
                    <StaffViewPanel
                        staffView={staffView}
                        onStaffViewChange={setStaffView}
                        activities={STAFF_ACTIVITY}
                        resources={resources}
                        bookings={bookings}
                        {...sharedTimelineProps}
                        onCreateBooking={() => setBookingOpen(true)}
                    />
                )}
              </div>
            </div>
          </FitSection>
        </div>
        <DetailsModal
            isOpen={resourceOpen}
            title="Manage Resources"
            subtitle="Add new trainers or facilities"
            fields={[]}
            submitLabel={resourceLoading ? resourceLoadingLabel : "ADD RESOURCE"}
            isLoading={resourceLoading}
            onSubmit={handleAddResource}
            onCancel={() => setResourceOpen(false)}
        >
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <FitText as="label" style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary, marginBottom: 8, display: "block" }}>
                Resource Name <FitText as="span" style={{ color: colors.danger }}>*</FitText>
              </FitText>
              <FitTextInput
                  value={resourceDraft.name}
                  onChange={(e) => setResourceDraft((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g., James Wilson"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${colors.fieldBorder}`, backgroundColor: colors.fieldBg, fontSize: 14 }}
              />
            </div>
            <div>
              <FitText as="label" style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary, marginBottom: 8, display: "block" }}>
                Type <FitText as="span" style={{ color: colors.danger }}>*</FitText>
              </FitText>
              <FitSelect
                  fullWidth value={resourceDraft.type}
                  onChange={(e) => setResourceDraft((p) => ({ ...p, type: e.target.value }))}
                  placeholder="Select Type"
                  options={[{ label: "Trainer", value: "trainer" }, { label: "Facility", value: "facility" }]}
                  style={{ borderColor: colors.fieldBorder, backgroundColor: colors.fieldBg }}
              />
            </div>
            <div>
              <FitText as="label" style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary, marginBottom: 8, display: "block" }}>Icon</FitText>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {SCHEDULE_EMOJI_OPTIONS.map((emoji) => (
                    <FitButton
                        key={emoji} variant="ghost"
                        onClick={() => setResourceDraft((p) => ({ ...p, icon: emoji }))}
                        style={{ width: 38, height: 38, padding: 0, borderRadius: 8, fontSize: 20, border: `1px solid ${resourceDraft.icon === emoji ? colors.brand : colors.border}`, backgroundColor: resourceDraft.icon === emoji ? `${colors.brand}20` : colors.surfaceRaised }}
                    >
                      <FitText as="span">{emoji}</FitText>
                    </FitButton>
                ))}
              </div>
            </div>
          </div>
        </DetailsModal>
        <DetailsModal
            isOpen={bookingOpen}
            title="Create Booking"
            fields={bookingFields}
            submitLabel={bookingLoading ? bookingLoadingLabel : "CREATE BOOKING"}
            isLoading={bookingLoading}
            onSubmit={handleCreateBooking}
            onCancel={() => setBookingOpen(false)}
        />
        <CalendarModal
            isOpen={calendarOpen}
            selectedDate={selectedYmd}
            onSelect={(ymd) => {
              if (!ymd) { setDate(new Date()); return; }
              const [y, m, d] = ymd.split("-").map(Number);
              if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) setDate(new Date(y, m - 1, d));
            }}
            onClose={() => setCalendarOpen(false)}
            title="Pick a date"
        />
      </section>
  );
}