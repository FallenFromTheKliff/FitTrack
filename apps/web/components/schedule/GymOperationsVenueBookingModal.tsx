"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { VenueAvailabilityRecord } from "@fittrack/api-client";
import { venueAvailabilityQueryOptions } from "@fittrack/query";
import type { VenueBookingRecord } from "@/contexts/ScheduleContext";
import { useTheme } from "@/contexts/ThemeContext";
import { FitButton, FitSelect, FitText, FitTextArea } from "@/components/fit";
import { CalendarModal, ConfirmModal } from "@/components/modals";
import { webApiClient } from "@/lib/api-client";
import { OverlayAmountGrid } from "./GymOperationsOverlayCards";
import { OverlayFrame } from "./GymOperationsOverlayFrame";
import {
  VENUE_DECISION_LABELS,
  actionPillStyle,
  buildStatusTone,
  canCancelUntilDayBefore,
  formatPeso,
  formatVenueWindow,
  formatCompactDate,
  formatSlotLabel,
  getCurrentGymMinutes,
  getDefaultDateInput,
  getPersonDisplayName,
  overlaySurfaceStyle,
  toIsoString,
  toMinutes,
  type SelectOption,
  type OverlayConfirmation,
  type VenueDecision,
} from "./GymOperationsOverlayShared";

export function GymOperationsVenueBookingModal({
  booking,
  isOpen,
  isCoachView = false,
  isSubmitting = false,
  onCancel,
  onClose,
  onComplete,
  onNoShow,
  onCancelMaintenance,
  onRescheduleMaintenance,
  onVenueDetails,
  venueOptions = [],
}: {
  booking: VenueBookingRecord | null;
  isOpen: boolean;
  isCoachView?: boolean;
  isSubmitting?: boolean;
  onCancel?: (note: string) => void;
  onClose: () => void;
  onComplete?: (note: string) => void;
  onNoShow?: (note: string) => void;
  onCancelMaintenance?: (
    note?: string,
  ) => Promise<{ error?: string; success: boolean }>;
  onRescheduleMaintenance?: (payload: {
    amenityId: string;
    endsAt: string;
    note?: string;
    startsAt: string;
  }) => Promise<{ error?: string; success: boolean }>;
  onVenueDetails?: () => void;
  venueOptions?: SelectOption[];
}) {
  const { colors, settings } = useTheme();
  const [decision, setDecision] = useState<VenueDecision>("mark_complete");
  const [note, setNote] = useState("");
  const [decisionConfirm, setDecisionConfirm] =
    useState<OverlayConfirmation | null>(null);
  const [maintenanceAction, setMaintenanceAction] = useState<
    "cancel" | "reschedule" | null
  >(null);
  const [replacementVenueId, setReplacementVenueId] = useState("");
  const [replacementDate, setReplacementDate] = useState(getDefaultDateInput());
  const [replacementDateOpen, setReplacementDateOpen] = useState(false);
  const [replacementStart, setReplacementStart] = useState("");
  const [replacementEnd, setReplacementEnd] = useState("");
  const [maintenanceErrors, setMaintenanceErrors] = useState<
    Partial<Record<"date" | "end" | "request" | "start" | "venue", string>>
  >({});
  const windowSummary = booking
    ? formatVenueWindow(booking)
    : { dateLabel: "-", timeLabel: "-" };
  const isTerminal = Boolean(
    booking && ["cancelled", "completed", "no_show"].includes(booking.status),
  );
  const isConfirmed = booking?.status === "confirmed";
  const canCancelBooking = canCancelUntilDayBefore(booking?.startTime);
  const visibleDecisionOptions = useMemo<VenueDecision[]>(() => {
    if (!booking || isTerminal) return [];
    const baseOptions: VenueDecision[] = isConfirmed
      ? ["mark_complete", "no_show"]
      : [];
    return canCancelBooking ? [...baseOptions, "cancel"] : baseOptions;
  }, [booking, canCancelBooking, isConfirmed, isTerminal]);
  const tone = buildStatusTone(booking?.status ?? "confirmed", colors);
  const currentVenueOption = venueOptions.find(
    (option) => option.value === String(booking?.venueId ?? ""),
  );
  const isMaintenanceAffected = /maintenance/i.test(
    currentVenueOption?.unavailableReason ?? "",
  );
  const availableReplacementOptions = useMemo(
    () =>
      venueOptions.filter(
        (option) =>
          !option.disabled && option.value !== String(booking?.venueId ?? ""),
      ),
    [booking?.venueId, venueOptions],
  );
  const {
    data: replacementAvailability = [],
    isLoading: replacementAvailabilityLoading,
  } = useQuery({
    ...venueAvailabilityQueryOptions<VenueAvailabilityRecord>(
      webApiClient,
      replacementVenueId || undefined,
      replacementDate,
    ),
    enabled:
      isOpen &&
      maintenanceAction === "reschedule" &&
      Boolean(replacementVenueId && replacementDate),
  });
  const replacementStartOptions = useMemo(
    () =>
      replacementAvailability
        .filter((slot) => {
          const value = toGymTime(slot.startTime);
          return (
            replacementDate !== getDefaultDateInput() ||
            toMinutes(value) > getCurrentGymMinutes()
          );
        })
        .map((slot) => ({
          disabled: slot.status !== "available",
          label: `${formatSlotLabel(toGymTime(slot.startTime))}${slot.status === "available" ? "" : " (booked)"}`,
          value: toGymTime(slot.startTime),
        })),
    [replacementAvailability, replacementDate],
  );
  const replacementEndOptions = useMemo(() => {
    if (!replacementStart) return [];
    const startIndex = replacementAvailability.findIndex(
      (slot) => toGymTime(slot.startTime) === replacementStart,
    );
    if (
      startIndex < 0 ||
      replacementAvailability[startIndex]?.status !== "available"
    )
      return [];
    const options: Array<{ label: string; value: string }> = [];
    let expected = new Date(
      replacementAvailability[startIndex].startTime,
    ).getTime();
    for (
      let index = startIndex;
      index < replacementAvailability.length;
      index += 1
    ) {
      const slot = replacementAvailability[index];
      if (
        slot.status !== "available" ||
        new Date(slot.startTime).getTime() !== expected
      )
        break;
      const value = toGymTime(slot.endTime);
      options.push({ label: formatSlotLabel(value), value });
      expected = new Date(slot.endTime).getTime();
    }
    return options;
  }, [replacementAvailability, replacementStart]);

  useEffect(() => {
    if (!isOpen) return;
    setDecision(visibleDecisionOptions[0] ?? "mark_complete");
    setNote("");
    setDecisionConfirm(null);
    setMaintenanceAction(null);
    setReplacementVenueId(availableReplacementOptions[0]?.value ?? "");
    setReplacementDate(getDefaultDateInput());
    setReplacementDateOpen(false);
    setReplacementStart("");
    setReplacementEnd("");
    setMaintenanceErrors({});
  }, [
    availableReplacementOptions,
    isOpen,
    booking?.id,
    visibleDecisionOptions,
  ]);

  useEffect(() => {
    if (
      !replacementStartOptions.some(
        (option) => option.value === replacementStart && !option.disabled,
      )
    ) {
      setReplacementStart(
        replacementStartOptions.find((option) => !option.disabled)?.value ?? "",
      );
    }
  }, [replacementStart, replacementStartOptions]);

  useEffect(() => {
    if (
      !replacementEndOptions.some((option) => option.value === replacementEnd)
    ) {
      setReplacementEnd(replacementEndOptions[0]?.value ?? "");
    }
  }, [replacementEnd, replacementEndOptions]);

  const requestMaintenanceResolution = async () => {
    setDecisionConfirm(null);
    if (!booking || !maintenanceAction) return;
    if (maintenanceAction === "cancel") {
      const result = await onCancelMaintenance?.(note.trim() || undefined);
      if (result && !result.success) {
        setMaintenanceErrors({
          request: result.error ?? "Unable to cancel this booking.",
        });
      }
      return;
    }
    const result = await onRescheduleMaintenance?.({
      amenityId: replacementVenueId,
      endsAt: toIsoString(replacementDate, replacementEnd),
      ...(note.trim() ? { note: note.trim() } : {}),
      startsAt: toIsoString(replacementDate, replacementStart),
    });
    if (result && !result.success) {
      const message = result.error ?? "Unable to reschedule this booking.";
      setMaintenanceErrors({
        [/(venue|maintenance|reservable|capacity)/i.test(message)
          ? "venue"
          : "request"]: message,
      });
    }
  };

  const handleMaintenanceResolution = () => {
    const errors: typeof maintenanceErrors = {};
    if (maintenanceAction === "reschedule") {
      if (!replacementVenueId)
        errors.venue = "Choose an available replacement venue.";
      if (!replacementDate) errors.date = "Choose the new booking date.";
      if (!replacementStart) errors.start = "Choose a live start time.";
      if (!replacementEnd) errors.end = "Choose a continuous end time.";
      if (
        replacementStart &&
        replacementEnd &&
        replacementEnd <= replacementStart
      ) {
        errors.end = "End time must be after the start time.";
      }
    }
    setMaintenanceErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const replacement = availableReplacementOptions.find(
      (option) => option.value === replacementVenueId,
    );
    setDecisionConfirm({
      confirmLabel:
        maintenanceAction === "cancel"
          ? "CANCEL FOR MAINTENANCE"
          : "RESCHEDULE BOOKING",
      isDanger: maintenanceAction === "cancel",
      message:
        maintenanceAction === "cancel"
          ? "Cancel this booking because the venue is under maintenance? The payment record and booking history will be preserved. No refund or credit is created automatically."
          : `Move this booking to ${replacement?.label ?? "the replacement venue"} on ${formatCompactDate(replacementDate)} at ${formatSlotLabel(replacementStart)}-${formatSlotLabel(replacementEnd)}? The existing paid amount and booking identity will be preserved even if venue rates differ.`,
      onConfirm: () => void requestMaintenanceResolution(),
      title:
        maintenanceAction === "cancel"
          ? "Confirm maintenance cancellation"
          : "Confirm maintenance reschedule",
    });
  };

  const applyDecision = () => {
    const trimmed = note.trim();
    if (decision === "mark_complete") return onComplete?.(trimmed);
    if (decision === "no_show") return onNoShow?.(trimmed);
    if (decision === "cancel" && canCancelBooking) return onCancel?.(trimmed);
  };

  const handleSave = () => {
    const confirmationMessage =
      decision === "mark_complete"
        ? "Mark this confirmed venue booking complete?"
        : decision === "no_show"
          ? "Mark this confirmed venue booking as no-show?"
          : decision === "cancel"
            ? "Cancel this venue booking now?"
            : "Save this venue booking outcome?";
    setDecisionConfirm({
      confirmLabel: "SAVE",
      isDanger: decision === "cancel" || decision === "no_show",
      message: confirmationMessage,
      onConfirm: applyDecision,
      title: "Confirm venue decision",
    });
  };

  return (
    <>
      <OverlayFrame
        isOpen={isOpen}
        onClose={onClose}
        closeDisabled={isSubmitting}
        title={
          isCoachView ? "Venue coaching assignment" : "Review venue booking"
        }
        subtitle={
          isCoachView
            ? "Manage delivery for this fully paid venue coach add-on."
            : "Confirm the venue window and operational outcome for this product booking."
        }
        footer={
          <FitButton
            variant="primary"
            label={
              isSubmitting
                ? "SAVING..."
                : maintenanceAction
                  ? "REVIEW RESOLUTION"
                  : "SAVE"
            }
            aria-label={
              maintenanceAction
                ? "Review maintenance resolution"
                : "Save venue decision"
            }
            onClick={
              maintenanceAction ? handleMaintenanceResolution : handleSave
            }
            disabled={
              isSubmitting ||
              isTerminal ||
              (!maintenanceAction && visibleDecisionOptions.length === 0)
            }
            style={actionPillStyle(colors, true)}
            textStyle={{ fontSize: 13, fontWeight: 700 }}
          />
        }
      >
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            display: "grid",
            gap: 14,
            transform:
              settings.animationLevel !== "none" && isOpen
                ? "scale(1)"
                : "scale(0.985)",
            transition:
              settings.animationLevel !== "none"
                ? "transform 180ms ease"
                : "none",
          }}
        >
          <div
            style={{
              minHeight: 36,
              padding: "9px 16px",
              borderRadius: 18,
              justifySelf: "start",
              backgroundColor: tone.bg,
              color: tone.color,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            <FitText
              excludeGlobalScale
              style={{ fontSize: 13, fontWeight: 700, color: tone.color }}
            >
              {tone.label}
            </FitText>
          </div>

          <div style={{ ...overlaySurfaceStyle(colors), gap: 8 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 18,
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: colors.textPrimary,
                  }}
                >
                  {booking?.venue?.name ?? "Venue booking"}
                </FitText>
                <FitText
                  excludeGlobalScale
                  style={{ fontSize: 12, color: colors.textMuted }}
                >
                  Member:{" "}
                  {getPersonDisplayName(
                    booking?.user?.profile,
                    booking?.user?.email,
                    "Member",
                  )}
                </FitText>
              </div>
              <div style={{ display: "grid", gap: 4 }}>
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: colors.textPrimary,
                  }}
                >
                  {windowSummary.dateLabel} / {windowSummary.timeLabel}
                </FitText>
                <FitText
                  excludeGlobalScale
                  style={{ fontSize: 12, color: colors.textMuted }}
                >
                  Purpose: {booking?.purpose?.trim() || "General venue use"}
                </FitText>
              </div>
            </div>
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, color: colors.textMuted }}
            >
              {isConfirmed
                ? isCoachView
                  ? "Complete, cancel, or mark no-show for this assigned paid coaching block."
                  : "Use this review surface to document the final facilities outcome."
                : "Only fully paid confirmed bookings expose delivery actions."}
            </FitText>
          </div>

          <OverlayAmountGrid
            colors={colors}
            columns="repeat(3, minmax(0, 1fr))"
            items={[
              {
                label: "Venue rate",
                value:
                  booking?.venue?.hourlyRate != null
                    ? `${formatPeso(booking.venue.hourlyRate)}/hr`
                    : "Not set",
              },
              {
                label: "Total price",
                value:
                  booking?.totalAmount != null
                    ? formatPeso(booking.totalAmount)
                    : "Not set",
              },
              { label: "Booking status", value: tone.label },
            ]}
          />

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}
          >
            <div style={overlaySurfaceStyle(colors)}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: colors.textPrimary,
                }}
              >
                Live booking context
              </FitText>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textPrimary,
                }}
              >
                {windowSummary.dateLabel} / {windowSummary.timeLabel}
              </FitText>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                  lineHeight: 1.35,
                }}
              >
                {booking?.purpose?.trim()
                  ? `Member note: ${booking.purpose.trim()}`
                  : "No member note was submitted for this venue booking."}
              </FitText>
              <FitButton
                variant="ghost"
                label="VENUE DETAILS"
                aria-label="Open venue details"
                onClick={() => onVenueDetails?.()}
                disabled={isSubmitting || !onVenueDetails}
                style={{ ...actionPillStyle(colors), justifySelf: "start" }}
                textStyle={{ fontSize: 13, fontWeight: 700 }}
              />
            </div>
            <div style={overlaySurfaceStyle(colors)}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: colors.textPrimary,
                }}
              >
                Delivery actions
              </FitText>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                  lineHeight: 1.35,
                }}
              >
                {isConfirmed
                  ? "Mark this confirmed venue booking complete or no-show. Cancellation remains available only before the booking day."
                  : "This historical booking has no commercial approval action."}
              </FitText>
              {!canCancelBooking && !isTerminal ? (
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 12,
                    color: colors.warning,
                    lineHeight: 1.35,
                  }}
                >
                  Cancellation is closed for this booking because the venue date
                  is too close.
                </FitText>
              ) : null}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {isTerminal ? (
                  <FitButton
                    variant="ghost"
                    label={
                      booking?.status === "completed" ? "COMPLETED" : "CLOSED"
                    }
                    aria-label="Venue booking closed"
                    onClick={onClose}
                    disabled
                    style={actionPillStyle(colors)}
                    textStyle={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: colors.danger,
                    }}
                  />
                ) : null}
                {visibleDecisionOptions.length > 0 ? (
                  <FitSelect
                    options={visibleDecisionOptions.map((value) => ({
                      label: VENUE_DECISION_LABELS[value],
                      value,
                    }))}
                    value={decision}
                    onChange={(event) =>
                      setDecision(event.target.value as VenueDecision)
                    }
                    disabled={isSubmitting}
                    fullWidth
                    aria-label="Venue decision"
                    style={{ minWidth: 220 }}
                  />
                ) : null}
              </div>
              {isMaintenanceAffected && !isTerminal ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <FitText
                    excludeGlobalScale
                    style={{
                      color: colors.warning,
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    This booking is affected by venue maintenance. Resolve it
                    without changing its payment.
                  </FitText>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <FitButton
                      variant={
                        maintenanceAction === "reschedule" ? "primary" : "ghost"
                      }
                      label="RESCHEDULE"
                      onClick={() => {
                        setMaintenanceAction("reschedule");
                        setMaintenanceErrors({});
                      }}
                      disabled={isSubmitting}
                      style={actionPillStyle(colors)}
                    />
                    <FitButton
                      variant={
                        maintenanceAction === "cancel" ? "danger" : "ghost"
                      }
                      label="CANCEL DUE TO MAINTENANCE"
                      onClick={() => {
                        setMaintenanceAction("cancel");
                        setMaintenanceErrors({});
                      }}
                      disabled={isSubmitting}
                      style={actionPillStyle(colors)}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {maintenanceAction === "reschedule" ? (
            <div style={{ ...overlaySurfaceStyle(colors), gap: 12 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: colors.textPrimary,
                }}
              >
                Replacement venue and live window
              </FitText>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div style={{ display: "grid", gap: 6 }}>
                  <FitText
                    style={{
                      color: colors.textMuted,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Venue
                  </FitText>
                  <FitSelect
                    aria-label="Maintenance replacement venue"
                    value={replacementVenueId}
                    onChange={(event) => {
                      setReplacementVenueId(event.target.value);
                      setReplacementStart("");
                      setReplacementEnd("");
                      setMaintenanceErrors((current) => ({
                        ...current,
                        venue: undefined,
                      }));
                    }}
                    options={availableReplacementOptions}
                    placeholder="Select replacement venue"
                    fullWidth
                    compact
                  />
                  {maintenanceErrors.venue ? (
                    <FitText style={{ color: colors.danger, fontSize: 11 }}>
                      {maintenanceErrors.venue}
                    </FitText>
                  ) : null}
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <FitText
                    style={{
                      color: colors.textMuted,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Date
                  </FitText>
                  <FitButton
                    variant="ghost"
                    aria-label={`Maintenance replacement date: ${replacementDate || "not selected"}`}
                    label={
                      replacementDate
                        ? formatCompactDate(replacementDate)
                        : "Select date"
                    }
                    onClick={() => setReplacementDateOpen(true)}
                    style={{
                      justifyContent: "flex-start",
                      minHeight: 42,
                      width: "100%",
                    }}
                  />
                  {maintenanceErrors.date ? (
                    <FitText style={{ color: colors.danger, fontSize: 11 }}>
                      {maintenanceErrors.date}
                    </FitText>
                  ) : null}
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <FitText
                    style={{
                      color: colors.textMuted,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Start time
                  </FitText>
                  <FitSelect
                    aria-label="Maintenance replacement start time"
                    value={replacementStart}
                    onChange={(event) => {
                      setReplacementStart(event.target.value);
                      setReplacementEnd("");
                      setMaintenanceErrors((current) => ({
                        ...current,
                        start: undefined,
                        end: undefined,
                      }));
                    }}
                    options={replacementStartOptions}
                    disabled={
                      replacementAvailabilityLoading ||
                      replacementStartOptions.length === 0
                    }
                    placeholder={
                      replacementAvailabilityLoading
                        ? "Loading..."
                        : "Select live start"
                    }
                    fullWidth
                    compact
                  />
                  {maintenanceErrors.start ? (
                    <FitText style={{ color: colors.danger, fontSize: 11 }}>
                      {maintenanceErrors.start}
                    </FitText>
                  ) : null}
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <FitText
                    style={{
                      color: colors.textMuted,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    End time
                  </FitText>
                  <FitSelect
                    aria-label="Maintenance replacement end time"
                    value={replacementEnd}
                    onChange={(event) => {
                      setReplacementEnd(event.target.value);
                      setMaintenanceErrors((current) => ({
                        ...current,
                        end: undefined,
                      }));
                    }}
                    options={replacementEndOptions}
                    disabled={
                      !replacementStart || replacementEndOptions.length === 0
                    }
                    placeholder="Select continuous end"
                    fullWidth
                    compact
                  />
                  {maintenanceErrors.end ? (
                    <FitText style={{ color: colors.danger, fontSize: 11 }}>
                      {maintenanceErrors.end}
                    </FitText>
                  ) : null}
                </div>
              </div>
              {availableReplacementOptions.length === 0 ? (
                <FitText style={{ color: colors.danger, fontSize: 12 }}>
                  No currently bookable replacement venue is available.
                </FitText>
              ) : null}
              <FitText style={{ color: colors.warning, fontSize: 12 }}>
                The existing paid value is preserved. Different venue rates are
                recorded in history and are not collected again.
              </FitText>
            </div>
          ) : null}

          {maintenanceAction === "cancel" ? (
            <div style={{ ...overlaySurfaceStyle(colors), gap: 8 }}>
              <FitText
                style={{ color: colors.danger, fontSize: 13, fontWeight: 800 }}
              >
                Operational maintenance cancellation
              </FitText>
              <FitText style={{ color: colors.textSecondary, fontSize: 12 }}>
                This is recorded separately from a member cancellation or
                no-show. Payment and history remain intact; no refund or credit
                is created automatically.
              </FitText>
            </div>
          ) : null}

          {maintenanceErrors.request ? (
            <FitText style={{ color: colors.danger, fontSize: 12 }}>
              {maintenanceErrors.request}
            </FitText>
          ) : null}

          <div style={{ ...overlaySurfaceStyle(colors), gap: 14 }}>
            <FitText
              excludeGlobalScale
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: colors.textPrimary,
              }}
            >
              Audit + note
            </FitText>
            <FitTextArea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="Optional handoff note for facilities staff or front desk..."
              aria-label="Venue decision handoff note"
              style={{ fontSize: 12, lineHeight: 1.4 }}
            />
          </div>
          <CalendarModal
            isOpen={replacementDateOpen}
            minDate={getDefaultDateInput()}
            selectedDate={replacementDate}
            onClose={() => setReplacementDateOpen(false)}
            onSelect={(value) => {
              setReplacementDate(value);
              setReplacementStart("");
              setReplacementEnd("");
              setMaintenanceErrors((current) => ({
                ...current,
                date: undefined,
                start: undefined,
                end: undefined,
              }));
            }}
          />
        </div>
      </OverlayFrame>
      <ConfirmModal
        isOpen={!!decisionConfirm}
        title={decisionConfirm?.title ?? "Confirm venue decision"}
        message={decisionConfirm?.message ?? ""}
        confirmLabel={decisionConfirm?.confirmLabel ?? "SAVE"}
        loadingLabel={decisionConfirm?.confirmLabel ?? "SAVE"}
        isDanger={decisionConfirm?.isDanger}
        isLoading={isSubmitting}
        onConfirm={() => {
          const nextAction = decisionConfirm?.onConfirm;
          setDecisionConfirm(null);
          nextAction?.();
        }}
        onCancel={() => setDecisionConfirm(null)}
      />
    </>
  );
}

function toGymTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}
