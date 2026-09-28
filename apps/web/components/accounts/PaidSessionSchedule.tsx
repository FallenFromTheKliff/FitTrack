"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { appointmentAvailabilityQueryOptions, rescheduleAppointmentMutationOptions, updateRecurringCoachingSessionMutationOptions } from "@fittrack/query";
import { CalendarDays, Check, Clock3, FileText } from "lucide-react";

import { FitButton, FitPill, FitText } from "@/components/fit";
import { FitModal } from "@/components/modals";
import CalendarModal from "@/components/modals/CalendarModal";
import { formatDurationLabel } from "@/components/schedule/GymOperationsOverlayShared";
import { useTheme } from "@/contexts/ThemeContext";
import { createClientIdempotencyKey } from "@/lib/commerce-checkout";
import { webApiClient } from "@/lib/api-client";

import {
  isPaidCoachingScheduleAppointment,
  isRecurringCoachingSession,
} from "./coach-client/monthlyCoachingFlow";

type PaidSessionScheduleProps = {
  appointments: PaidSessionScheduleRecord[];
  canReschedule?: boolean;
  fallbackCoachId?: string;
  memberId: string;
  onOpenSessionReport?: (appointmentId: string) => void;
  requesterUserId?: string;
};

export type PaidSessionScheduleRecord = {
  activePaymentStatus?: "awaiting_verification" | "completed" | "failed" | "pending" | "processing" | null;
  coach?: { id: string } | null;
  coachId?: string;
  duration: number;
  id: string;
  recurringPlanId?: string | null;
  scheduledAt: string;
  status?: string;
  userId: string;
};

type SlotOption = { label: string; value: string };
type ScheduleMessage = { text: string; tone: "error" | "success" } | null;

function gymDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "2-digit", timeZone: "Asia/Manila", year: "numeric" }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : "";
}

function sessionLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not scheduled" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function timeLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
}

function slotPeriod(value: string) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "2-digit", hour12: false, timeZone: "Asia/Manila" }).format(new Date(value)));
  return hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
}

function mutationError(error: unknown) {
  return error instanceof Error && error.message.trim() ? error.message : "The session schedule could not be updated.";
}

export function isPaidSession(appointment: PaidSessionScheduleRecord) {
  return isPaidCoachingScheduleAppointment(appointment);
}

function TimeSlotModal({ isOpen, loading, onClose, onSelect, selectedSlot, slots }: {
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
  onSelect: (value: string) => void;
  selectedSlot: string;
  slots: SlotOption[];
}) {
  const { colors } = useTheme();
  const groups = useMemo(() => ["Morning", "Afternoon", "Evening"].map((period) => ({ period, slots: slots.filter((slot) => slotPeriod(slot.value) === period) })).filter((group) => group.slots.length), [slots]);
  return (
    <FitModal isOpen={isOpen} maxWidth={520} onClose={onClose} title="Choose available time" subtitle="Only conflict-free coach availability is shown." iconNode={<Clock3 size={16} />}>
      <div style={{ display: "grid", gap: 14 }}>
        {loading ? <FitText style={{ color: colors.textMuted, fontSize: 11 }}>Loading coach availability...</FitText> : groups.length === 0 ? (
          <FitText style={{ color: colors.warning, fontSize: 11, lineHeight: 1.45 }}>No available times fit this session duration. Choose another date.</FitText>
        ) : groups.map((group) => (
          <section key={group.period} style={{ display: "grid", gap: 7 }}>
            <FitText style={{ color: colors.textMuted, fontSize: 9.5, fontWeight: 850, letterSpacing: "0.04em", textTransform: "uppercase" }}>{group.period}</FitText>
            <div style={{ display: "grid", gap: 7, gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))" }}>
              {group.slots.map((slot) => {
                const active = selectedSlot === slot.value;
                return <FitButton active={active} icon={active ? Check : Clock3} key={slot.value} label={slot.label} onClick={() => { onSelect(slot.value); onClose(); }} style={{ minHeight: 42, borderRadius: 8 }} textStyle={{ fontSize: 11, fontWeight: 800 }} variant="chip" />;
              })}
            </div>
          </section>
        ))}
      </div>
    </FitModal>
  );
}

export default function PaidSessionSchedule({ appointments, canReschedule = false, fallbackCoachId, memberId, onOpenSessionReport, requesterUserId }: PaidSessionScheduleProps) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const paidSessions = useMemo(() => appointments.filter((appointment) => appointment.userId === memberId && isPaidSession(appointment)).sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime()), [appointments, memberId]);
  const upcomingSessions = useMemo(() => paidSessions.filter((session) => session.status === "confirmed" && new Date(session.scheduledAt).getTime() >= Date.now()), [paidSessions]);
  const historySessions = useMemo(() => paidSessions.filter((session) => !upcomingSessions.some((upcoming) => upcoming.id === session.id)).reverse(), [paidSessions, upcomingSessions]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const selectedSession = useMemo(() => upcomingSessions.find((session) => session.id === selectedSessionId) ?? null, [selectedSessionId, upcomingSessions]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [message, setMessage] = useState<ScheduleMessage>(null);
  const selectedCoachId = selectedSession?.coachId ?? selectedSession?.coach?.id ?? fallbackCoachId;
  const selectedDuration = selectedSession?.duration ?? 0;
  const { data: availability = [], isLoading: availabilityLoading } = useQuery(appointmentAvailabilityQueryOptions(webApiClient, selectedCoachId, selectedDate, selectedDuration));
  const appointmentMutation = useMutation(rescheduleAppointmentMutationOptions(webApiClient, queryClient));
  const recurringMutation = useMutation(updateRecurringCoachingSessionMutationOptions(webApiClient, queryClient));

  useEffect(() => {
    setSelectedSessionId((current) => current && upcomingSessions.some((session) => session.id === current) ? current : upcomingSessions[0]?.id ?? "");
  }, [upcomingSessions]);

  useEffect(() => {
    setSelectedDate(selectedSession ? gymDate(selectedSession.scheduledAt) : "");
    setSelectedSlot("");
    setMessage(null);
  }, [selectedSession]);

  const slots = useMemo(() => {
    if (!selectedDate || selectedDuration <= 0) return [];
    const seen = new Set<string>();
    return availability
      .filter((slot) => slot.available && slot.durationMinutes === selectedDuration && gymDate(slot.startAt) === selectedDate && new Date(slot.startAt).getTime() > Date.now())
      .filter((slot) => {
        if (seen.has(slot.startAt)) return false;
        seen.add(slot.startAt);
        return true;
      })
      .sort((left, right) => left.startAt.localeCompare(right.startAt))
      .map((slot) => ({ label: timeLabel(slot.startAt), value: slot.startAt }));
  }, [availability, selectedDate, selectedDuration]);
  const isSubmitting = appointmentMutation.isPending || recurringMutation.isPending;
  const dateTones = useMemo(() => {
    const tones: Record<string, "available" | "full" | "unavailable"> = {};
    paidSessions.forEach((session) => {
      tones[gymDate(session.scheduledAt)] =
        session.status === "completed" ? "unavailable" : "full";
    });
    if (selectedDate && !availabilityLoading) {
      tones[selectedDate] = slots.length > 0 ? "available" : "unavailable";
    }
    return tones;
  }, [availabilityLoading, paidSessions, selectedDate, slots.length]);

  const handleReschedule = async () => {
    if (!canReschedule || !selectedSession || selectedSession.status !== "confirmed") {
      setMessage({ text: "An active paid coaching relationship is required to change this session.", tone: "error" });
      return;
    }
    if (!selectedCoachId || !selectedSlot) {
      setMessage({ text: "Choose an available date and time.", tone: "error" });
      return;
    }
    try {
      if (selectedSession.recurringPlanId) {
        await recurringMutation.mutateAsync({ input: { action: "reschedule", coachId: selectedCoachId, newScheduledAt: selectedSlot, reason: "Session-only schedule change from coach client workspace." }, planId: selectedSession.recurringPlanId, sessionId: selectedSession.id });
      } else {
        await appointmentMutation.mutateAsync({ appointmentId: selectedSession.id, payload: { duration: selectedDuration, idempotencyKey: createClientIdempotencyKey(), scheduledAt: selectedSlot }, userId: requesterUserId });
      }
      setConfirmationOpen(false);
      setMessage({ text: "Session moved. The recurring schedule and paid entitlement were not changed.", tone: "success" });
    } catch (error) {
      setConfirmationOpen(false);
      setMessage({ text: mutationError(error), tone: "error" });
    }
  };

  const renderSession = (session: PaidSessionScheduleRecord, interactive: boolean) => {
    const selected = session.id === selectedSessionId;
    const completed = session.status === "completed";
    const recurring = isRecurringCoachingSession(session);
    return (
      <div key={session.id} style={{ alignItems: "center", backgroundColor: selected ? `${colors.brand}10` : recurring ? `${colors.brand}08` : colors.surfaceRaised, border: `1px solid ${selected ? colors.brand : recurring ? `${colors.brand}66` : colors.border}`, borderRadius: 8, boxShadow: recurring ? `0 0 0 1px ${colors.brand}10, 0 3px 14px ${colors.brand}0d` : "none", display: "grid", gap: 9, gridTemplateColumns: "minmax(0, 1fr) auto", minWidth: 0, padding: "9px 10px" }}>
        <button disabled={!interactive} onClick={() => { setSelectedSessionId(session.id); setMessage(null); }} style={{ background: "none", border: 0, color: "inherit", cursor: interactive ? "pointer" : "default", minWidth: 0, padding: 0, textAlign: "left" }} type="button">
          <FitText style={{ color: colors.textPrimary, fontSize: 11, fontWeight: 800 }}>{sessionLabel(session.scheduledAt)}</FitText>
          <FitText style={{ color: colors.textMuted, fontSize: 9.75 }}>{formatDurationLabel(session.duration)} - {session.recurringPlanId ? "Monthly plan" : "One session"}</FitText>
        </button>
        <div style={{ alignItems: "center", display: "flex", gap: 7 }}>
          {recurring ? <FitPill mode="status" label="MONTHLY COACHING" color={colors.brand} fontSize={8.5} style={{ borderRadius: 6 }} /> : null}
          <FitPill mode="status" label={completed ? "Completed" : "Confirmed"} color={completed ? colors.success : colors.brand} fontSize={9} style={{ borderRadius: 6 }} />
          {!interactive && onOpenSessionReport ? <FitButton aria-label="Open session report" icon={FileText} iconOnly label="Open session report" onClick={() => onOpenSessionReport(session.id)} style={{ minHeight: 30, minWidth: 30, padding: 5 }} variant="ghost" /> : null}
        </div>
      </div>
    );
  };

  if (!paidSessions.length) return <FitText style={{ color: colors.textMuted, fontSize: 11 }}>No paid coaching sessions are available for this client.</FitText>;

  return (
    <div style={{ display: "grid", gap: 14, minWidth: 0, width: "100%" }}>
      <section style={{ display: "grid", gap: 7 }}>
        <FitText style={{ color: colors.brand, fontSize: 10, fontWeight: 850, letterSpacing: "0.04em", textTransform: "uppercase" }}>Upcoming sessions</FitText>
        {upcomingSessions.length ? upcomingSessions.map((session) => renderSession(session, canReschedule)) : <FitText style={{ color: colors.textMuted, fontSize: 11 }}>No upcoming paid sessions.</FitText>}
      </section>

      {canReschedule && selectedSession ? (
        <section style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 9, display: "grid", gap: 10, padding: 12 }}>
          <div style={{ display: "grid", gap: 3 }}>
            <FitText style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 850 }}>Move selected session</FitText>
            <FitText style={{ color: colors.textMuted, fontSize: 10, lineHeight: 1.4 }}>This changes this appointment only. The recurring workout schedule remains unchanged.</FitText>
          </div>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <FitButton icon={CalendarDays} label={selectedDate ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(`${selectedDate}T12:00:00`)) : "Choose date"} onClick={() => setCalendarOpen(true)} style={{ minHeight: 42, justifyContent: "flex-start" }} variant="ghost" />
            <FitButton disabled={!selectedDate || availabilityLoading || !slots.length} icon={Clock3} label={selectedSlot ? timeLabel(selectedSlot) : availabilityLoading ? "Loading times..." : "Choose available time"} onClick={() => setTimeModalOpen(true)} style={{ minHeight: 42, justifyContent: "flex-start" }} variant="ghost" />
          </div>
          <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 8 }}>
            <FitPill mode="status" label="Available" color={colors.success} fontSize={8.5} />
            <FitPill mode="status" label="Limited" color={colors.warning} fontSize={8.5} />
            <FitPill mode="status" label="Occupied" color={colors.danger} fontSize={8.5} />
            <FitText style={{ color: colors.textMuted, fontSize: 9.5 }}>{formatDurationLabel(selectedDuration)} is preserved.</FitText>
          </div>
          {!availabilityLoading && selectedDate && !slots.length ? <FitText style={{ color: colors.warning, fontSize: 10.5 }}>No coach availability fits this date and duration.</FitText> : null}
          <FitButton disabled={!selectedSlot || isSubmitting} label="REVIEW SCHEDULE CHANGE" onClick={() => setConfirmationOpen(true)} style={{ justifySelf: "start", minHeight: 36 }} textStyle={{ fontSize: 10, fontWeight: 850 }} variant="primary" />
        </section>
      ) : null}

      {!canReschedule && upcomingSessions.length ? <FitText style={{ backgroundColor: `${colors.warning}10`, border: `1px solid ${colors.warning}35`, borderRadius: 8, color: colors.warning, fontSize: 10.5, lineHeight: 1.45, padding: "9px 10px" }}>These sessions remain visible, but schedule changes require an active paid coaching relationship.</FitText> : null}
      {historySessions.length ? <section style={{ display: "grid", gap: 7 }}><FitText style={{ color: colors.textMuted, fontSize: 10, fontWeight: 850, letterSpacing: "0.04em", textTransform: "uppercase" }}>Session history</FitText>{historySessions.map((session) => renderSession(session, false))}</section> : null}
      {message ? <FitText role={message.tone === "error" ? "alert" : "status"} style={{ backgroundColor: message.tone === "error" ? `${colors.danger}10` : `${colors.success}10`, border: `1px solid ${message.tone === "error" ? colors.danger : colors.success}35`, borderRadius: 8, color: message.tone === "error" ? colors.danger : colors.success, fontSize: 11, lineHeight: 1.4, padding: "9px 10px" }}>{message.text}</FitText> : null}

      <CalendarModal closeOnSelect dateTones={dateTones} isOpen={calendarOpen} minDate={gymDate(new Date().toISOString())} onClose={() => setCalendarOpen(false)} onSelect={(value) => { setSelectedDate(value); setSelectedSlot(""); setMessage(null); }} selectedDate={selectedDate} />
      <TimeSlotModal isOpen={timeModalOpen} loading={availabilityLoading} onClose={() => setTimeModalOpen(false)} onSelect={setSelectedSlot} selectedSlot={selectedSlot} slots={slots} />
      <FitModal footer={<div style={{ display: "flex", gap: 8, justifyContent: "flex-end", width: "100%" }}><FitButton label="CANCEL" onClick={() => setConfirmationOpen(false)} variant="ghost" /><FitButton disabled={isSubmitting} label={isSubmitting ? "MOVING..." : "CONFIRM MOVE"} onClick={() => void handleReschedule()} variant="primary" /></div>} isOpen={confirmationOpen} maxWidth={500} onClose={() => setConfirmationOpen(false)} title="Confirm schedule change" subtitle="Only this coaching appointment will move." iconNode={<CalendarDays size={16} />}>
        <div style={{ display: "grid", gap: 8 }}><FitText style={{ color: colors.textSecondary, fontSize: 11 }}>From: {selectedSession ? sessionLabel(selectedSession.scheduledAt) : "N/A"}</FitText><FitText style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 800 }}>To: {selectedSlot ? sessionLabel(selectedSlot) : "N/A"}</FitText></div>
      </FitModal>
    </div>
  );
}
