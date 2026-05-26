"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { CalendarPlus, UserPlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import type {
  CoachAvailabilityResponse,
  VenueAvailabilityRecord,
} from "@fittrack/api-client";
import {
  coachAvailabilityQueryOptions,
  venueAvailabilityQueryOptions,
} from "@fittrack/query";
import { expandCoachAvailabilitySlots } from "@fittrack/utils";

import { useTheme } from "@/contexts/ThemeContext";
import { webApiClient } from "@/lib/api-client";
import {
  FitButton,
  FitSelect,
  FitText,
  FitTextArea,
  FitTextInput,
} from "@/components/fit";
import { CalendarModal, ConfirmModal } from "@/components/modals";
import { OverlayAmountGrid } from "./GymOperationsOverlayCards";
import { OverlayFrame } from "./GymOperationsOverlayFrame";
import {
  COACH_SPECIALTY_OPTIONS,
  EMAIL_PATTERN,
  PHONE_PATTERN,
  actionPillStyle,
  formatCompactDate,
  formatDurationLabel,
  formatPeso,
  formatSlotLabel,
  getCurrentGymMinutes,
  getDefaultDateInput,
  getInitialPaymentAmount,
  hasVenueWindowConflict,
  matchesDay,
  modalFieldStyle,
  modalTextAreaStyle,
  overlaySurfaceStyle,
  roundCurrency,
  splitListInput,
  toIsoString,
  toMinutes,
  type OverlayConfirmation,
  type SelectOption,
  type StaffInitialPaymentStage,
} from "./GymOperationsOverlayShared";

function filterScheduleOptions(
  options: SelectOption[],
  searchValue: string,
  selectedValue: string,
) {
  const selectedOption = options.find((option) => option.value === selectedValue);
  const normalizedSearch =
    searchValue.trim().toLowerCase() === selectedOption?.label.toLowerCase()
      ? ""
      : searchValue.trim().toLowerCase();
  const filteredOptions = (
    normalizedSearch
      ? options.filter((option) =>
          option.label.toLowerCase().includes(normalizedSearch),
        )
      : options
  ).slice(0, 30);

  if (
    selectedOption &&
    !filteredOptions.some((option) => option.value === selectedOption.value)
  ) {
    return [selectedOption, ...filteredOptions];
  }

  return filteredOptions;
}

function ScheduleOptionPicker({
  disabled,
  emptyLabel,
  inputId,
  inputName,
  inputLabel,
  inputStyle,
  onChange,
  onSearchChange,
  options,
  placeholder,
  searchValue,
  selectedValue,
}: {
  disabled?: boolean;
  emptyLabel: string;
  inputId?: string;
  inputName?: string;
  inputLabel?: string;
  inputStyle: CSSProperties;
  onChange: (option: SelectOption) => void;
  onSearchChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  searchValue: string;
  selectedValue: string;
}) {
  const { colors } = useTheme();

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <FitTextInput
        id={inputId}
        name={inputName}
        aria-label={inputLabel ?? placeholder}
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{ ...inputStyle, minHeight: 42, fontSize: 13, fontWeight: 700 }}
      />
      <div
        style={{
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          backgroundColor: colors.surfaceRaised,
          maxHeight: 132,
          minHeight: 44,
          overflowY: "auto",
          padding: 6,
          display: "grid",
          gap: 6,
        }}
      >
        {options.length > 0 ? (
          options.map((option) => {
            const selected = option.value === selectedValue;

            return (
              <button
                key={option.value || option.label}
                type="button"
                disabled={disabled}
                onClick={() => onChange(option)}
                style={{
                  minHeight: 34,
                  borderRadius: 8,
                  border: `1px solid ${
                    selected ? colors.brand : colors.border
                  }`,
                  backgroundColor: selected
                    ? `${colors.brand}22`
                    : colors.surface,
                  color: selected ? colors.brand : colors.textPrimary,
                  cursor: disabled ? "not-allowed" : "pointer",
                  padding: "7px 10px",
                  textAlign: "left",
                  fontSize: 13,
                  fontWeight: selected ? 800 : 650,
                }}
              >
                {option.label}
              </button>
            );
          })
        ) : (
          <FitText
            excludeGlobalScale
            style={{
              color: colors.textMuted,
              fontSize: 12,
              padding: "8px 6px",
            }}
          >
            {emptyLabel}
          </FitText>
        )}
      </div>
    </div>
  );
}

function getDateInputOffset(offsetDays: number) {
  const date = new Date(`${getDefaultDateInput()}T00:00:00`);
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function venueAvailabilityTimeValue(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
}

function sortVenueAvailabilitySlots(slots: VenueAvailabilityRecord[]) {
  return [...slots].sort(
    (left, right) =>
      new Date(left.startTime).getTime() - new Date(right.startTime).getTime(),
  );
}

function findNextCoachSlot(availability: CoachAvailabilityResponse | undefined) {
  const slots = expandCoachAvailabilitySlots(
    availability?.availability ?? [],
    availability?.scheduleType ?? "part_time",
  );
  const currentMinutes = getCurrentGymMinutes();

  for (let offset = 0; offset <= 30; offset += 1) {
    const candidateDate = getDateInputOffset(offset);
    const dailySlots = slots
      .filter((slot) => slot.isAvailable && matchesDay(candidateDate, slot.dayOfWeek))
      .sort((left, right) => toMinutes(left.startTime) - toMinutes(right.startTime));

    for (const slot of dailySlots) {
      const durationMinutes = slot.durationMinutes;
      if (durationMinutes <= 0) continue;
      if (offset === 0 && toMinutes(slot.startTime) <= currentMinutes) continue;
      return {
        date: candidateDate,
        slotValue: `${slot.startTime}|${durationMinutes}`,
      };
    }
  }

  return null;
}

function getUpcomingCoachAvailableDates(
  availability: CoachAvailabilityResponse | undefined,
  windowDays = 30,
) {
  const slots = expandCoachAvailabilitySlots(
    availability?.availability ?? [],
    availability?.scheduleType ?? "part_time",
  );
  const currentMinutes = getCurrentGymMinutes();
  const dates: string[] = [];

  for (let offset = 0; offset <= windowDays; offset += 1) {
    const candidateDate = getDateInputOffset(offset);
    const hasAvailableSlot = slots.some((slot) => {
      if (!slot.isAvailable || !matchesDay(candidateDate, slot.dayOfWeek)) {
        return false;
      }

      return offset > 0 || toMinutes(slot.startTime) > currentMinutes;
    });

    if (hasAvailableSlot) {
      dates.push(candidateDate);
    }
  }

  return dates;
}


export function GymOperationsCreateVenueBookingModal({
  coachOptions,
  isOpen,
  isSubmitting = false,
  memberOptions,
  onClose,
  onCreate,
  venueOptions,
}: {
  coachOptions: SelectOption[];
  isOpen: boolean;
  isSubmitting?: boolean;
  memberOptions: SelectOption[];
  onClose: () => void;
  onCreate: (payload: {
    amenityId: string;
    coachId?: string;
    endsAt: string;
    memberId: string;
    notes?: string;
    paymentStage?: StaffInitialPaymentStage;
    startsAt: string;
  }) => void;
  venueOptions: SelectOption[];
}) {
  const { colors, settings } = useTheme();
  const [memberId, setMemberId] = useState("");
  const [venueId, setVenueId] = useState("");
  const [coachId, setCoachId] = useState("");
  const [date, setDate] = useState(getDefaultDateInput());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [note, setNote] = useState("");
  const [paymentStage, setPaymentStage] =
    useState<StaffInitialPaymentStage>("full");
  const [errorText, setErrorText] = useState("");
  const [createConfirm, setCreateConfirm] =
    useState<OverlayConfirmation | null>(null);
  const shouldAnimate = settings.animationLevel !== "none";
  const inputStyle = modalFieldStyle(colors);
  const textAreaStyle = modalTextAreaStyle(colors);
  const {
    data: venueAvailability = [],
    error: venueAvailabilityError,
    isLoading: venueAvailabilityLoading,
  } = useQuery({
    ...venueAvailabilityQueryOptions<VenueAvailabilityRecord>(
      webApiClient,
      venueId || undefined,
      date,
    ),
    enabled: isOpen && Boolean(venueId) && Boolean(date),
  });

  useEffect(() => {
    if (!isOpen) return;
    const defaultMemberId = memberOptions[0]?.value ?? "";
    setMemberId((current) => current || defaultMemberId);
    setVenueId((current) => current || venueOptions[0]?.value || "");
    setCoachId("");
    setDate(getDefaultDateInput());
    setDatePickerOpen(false);
    setStartTime("09:00");
    setEndTime("10:00");
    setNote("");
    setPaymentStage("full");
    setErrorText("");
    setCreateConfirm(null);
  }, [coachOptions, isOpen, memberOptions, venueOptions]);

  const currentMinutes = getCurrentGymMinutes();
  const liveVenueSlots = useMemo(
    () => sortVenueAvailabilitySlots(venueAvailability),
    [venueAvailability],
  );
  const venueStartOptions = useMemo(
    () =>
      liveVenueSlots
        .filter((slot) => {
          const value = venueAvailabilityTimeValue(slot.startTime);
          return value && (date !== getDefaultDateInput() || toMinutes(value) > currentMinutes);
        })
        .map((slot) => {
          const value = venueAvailabilityTimeValue(slot.startTime);
          const isAvailable = slot.status === "available";
          return {
            disabled: !isAvailable,
            label: `${formatSlotLabel(value)}${isAvailable ? "" : " (booked)"}`,
            value,
          };
        }),
    [currentMinutes, date, liveVenueSlots],
  );
  useEffect(() => {
    const selectedOption = venueStartOptions.find((option) => option.value === startTime);
    if (!selectedOption || selectedOption.disabled) {
      setStartTime(venueStartOptions.find((option) => !option.disabled)?.value ?? "");
    }
  }, [startTime, venueStartOptions]);
  const venueEndOptions = useMemo(
    () => {
      if (!startTime) return [];
      const startIndex = liveVenueSlots.findIndex(
        (slot) => venueAvailabilityTimeValue(slot.startTime) === startTime,
      );
      if (startIndex === -1 || liveVenueSlots[startIndex]?.status !== "available") {
        return [];
      }

      const options: Array<{ label: string; value: string }> = [];
      let expectedStart = new Date(liveVenueSlots[startIndex].startTime).getTime();
      for (let index = startIndex; index < liveVenueSlots.length; index += 1) {
        const slot = liveVenueSlots[index];
        if (new Date(slot.startTime).getTime() !== expectedStart) break;
        if (slot.status !== "available") break;

        const value = venueAvailabilityTimeValue(slot.endTime);
        if (value && value > startTime) {
          options.push({
            label: formatSlotLabel(value),
            value,
          });
        }
        expectedStart = new Date(slot.endTime).getTime();
      }
      return options;
    },
    [liveVenueSlots, startTime],
  );
  useEffect(() => {
    if (!venueEndOptions.some((option) => option.value === endTime)) {
      setEndTime(venueEndOptions[0]?.value ?? "");
    }
  }, [endTime, venueEndOptions]);

  const hasConflict = hasVenueWindowConflict(
    venueAvailability,
    startTime,
    endTime,
  );
  const venueAvailabilityMessage = useMemo(() => {
    if (!venueId) return "Select a venue to load live availability.";
    if (venueAvailabilityLoading) return "Loading live venue availability...";
    if (venueAvailabilityError) {
      return venueAvailabilityError instanceof Error
        ? venueAvailabilityError.message
        : "Unable to load venue availability.";
    }
    if (venueStartOptions.length === 0) {
      return "No future venue slots are available for the selected date.";
    }
    if (!venueStartOptions.some((option) => !option.disabled)) {
      return "All venue slots are booked for the selected date.";
    }
    if (startTime && venueEndOptions.length === 0) {
      return "No continuous venue time is available after the selected start.";
    }
    return "";
  }, [
    startTime,
    venueAvailabilityError,
    venueAvailabilityLoading,
    venueEndOptions.length,
    venueId,
    venueStartOptions,
  ]);
  const selectedVenueOption = venueOptions.find(
    (option) => option.value === venueId,
  );
  const selectedCoachOption = coachOptions.find(
    (option) => option.value === coachId,
  );
  const durationMinutes = Math.max(
    0,
    toMinutes(endTime) - toMinutes(startTime),
  );
  const venueHourlyRate = selectedVenueOption?.hourlyRate ?? 0;
  const coachHourlyRate = selectedCoachOption?.hourlyRate ?? 0;
  const estimatedVenueTotal = (venueHourlyRate * durationMinutes) / 60;
  const estimatedCoachTotal = coachId
    ? (coachHourlyRate * durationMinutes) / 60
    : 0;
  const estimatedBookingTotal = estimatedVenueTotal + estimatedCoachTotal;
  const amountDueNow = getInitialPaymentAmount(
    estimatedBookingTotal,
    paymentStage,
  );
  const remainingBalance = roundCurrency(
    Math.max(estimatedBookingTotal - amountDueNow, 0),
  );
  const isVenueWindowInFuture =
    Boolean(startTime) &&
    (date !== getDefaultDateInput() || toMinutes(startTime) > currentMinutes);
  const canSubmit =
    Boolean(memberId) &&
    Boolean(venueId) &&
    Boolean(date) &&
    Boolean(startTime) &&
    Boolean(endTime) &&
    endTime > startTime &&
    isVenueWindowInFuture &&
    !venueAvailabilityLoading &&
    !venueAvailabilityError &&
    !hasConflict;

  const submitVenueBooking = () => {
    onCreate({
      amenityId: venueId,
      ...(coachId ? { coachId } : {}),
      endsAt: toIsoString(date, endTime),
      memberId,
      ...(note.trim() ? { notes: note.trim() } : {}),
      paymentStage,
      startsAt: toIsoString(date, startTime),
    });
  };

  const handleCreate = () => {
    setErrorText("");
    if (!memberId) {
      setErrorText("Select the member for this venue booking.");
      return;
    }
    if (!venueId) {
      setErrorText("Select a venue before creating the booking.");
      return;
    }
    if (!date || !startTime || !endTime || endTime <= startTime) {
      setErrorText("Select a valid date and time window.");
      return;
    }
    if (!isVenueWindowInFuture) {
      setErrorText("Same-day bookings must use a future start time.");
      return;
    }
    if (hasConflict) {
      setErrorText(
        "The selected venue already has a pending or confirmed booking in this time window.",
      );
      return;
    }

    setCreateConfirm({
      confirmLabel: "CREATE BOOKING",
      message: `Create this manual venue booking and record ${formatPeso(amountDueNow)} as ${paymentStage === "downpayment" ? "cash downpayment" : "full cash payment"}?`,
      onConfirm: submitVenueBooking,
      title: "Confirm venue booking",
    });
  };

  return (
    <>
    <OverlayFrame
      isOpen={isOpen}
      onClose={onClose}
      closeDisabled={isSubmitting}
      title="Create venue booking"
      subtitle="Use this for front-desk or operator-created reservations. The booking is persisted immediately into the shared venue booking table."
      footer={
        <FitButton
          variant="primary"
          label={isSubmitting ? "CREATING..." : "CREATE BOOKING"}
          icon={CalendarPlus}
          iconSize={15}
          onClick={handleCreate}
          disabled={!canSubmit || isSubmitting}
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
          transform: shouldAnimate && isOpen ? "scale(1)" : "scale(0.985)",
          transition: shouldAnimate ? "transform 180ms ease" : "none",
        }}
      >
        <div style={{ ...overlaySurfaceStyle(colors), gap: 14 }}>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Member
              </FitText>
              <FitSelect
                id="manual-venue-booking-member"
                name="manualVenueBookingMember"
                aria-label="Manual venue booking member"
                value={memberId}
                onChange={(event) => setMemberId(event.target.value)}
                options={memberOptions}
                placeholder="Select member"
                compact
                fullWidth
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Venue
              </FitText>
              <FitSelect
                id="manual-venue-booking-venue"
                name="manualVenueBookingVenue"
                aria-label="Manual venue booking venue"
                value={venueId}
                onChange={(event) => {
                  setVenueId(event.target.value);
                  setStartTime("");
                  setEndTime("");
                }}
                options={venueOptions}
                compact
                fullWidth
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 14,
            }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Date
              </FitText>
              <FitButton
                variant="ghost"
                label={date ? formatCompactDate(date) : "Select date"}
                aria-label={`Manual venue booking date: ${
                  date ? formatCompactDate(date) : "Select date"
                }`}
                onClick={() => setDatePickerOpen(true)}
                style={{
                  ...inputStyle,
                  justifyContent: "flex-start",
                  minHeight: 46,
                  width: "100%",
                }}
                textStyle={{ fontSize: 13, fontWeight: 700 }}
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Start time
              </FitText>
              <FitSelect
                id="manual-venue-booking-start-time"
                name="manualVenueBookingStartTime"
                aria-label="Manual venue booking start time"
                value={startTime}
                onChange={(event) => {
                  setStartTime(event.target.value);
                  setEndTime("");
                }}
                options={venueStartOptions}
                disabled={venueAvailabilityLoading || venueStartOptions.length === 0}
                compact
                fullWidth
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                End time
              </FitText>
              <FitSelect
                id="manual-venue-booking-end-time"
                name="manualVenueBookingEndTime"
                aria-label="Manual venue booking end time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                options={venueEndOptions}
                disabled={!startTime || venueEndOptions.length === 0}
                compact
                fullWidth
              />
            </div>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}
            >
              Optional coach add-on
            </FitText>
            <FitSelect
              id="manual-venue-booking-coach-addon"
              name="manualVenueBookingCoachAddon"
              aria-label="Manual venue booking optional coach add-on"
              value={coachId}
              onChange={(event) => setCoachId(event.target.value)}
              options={[
                { label: "No coach add-on", value: "" },
                ...coachOptions,
              ]}
              compact
              fullWidth
            />
          </div>

          <OverlayAmountGrid
            colors={colors}
            columns="repeat(3, minmax(0, 1fr))"
            items={[
              {
                helper: "Per hour from Facilities",
                label: "Venue rate",
                value: formatPeso(venueHourlyRate),
                valueColor: colors.brand,
              },
              {
                helper: "Selected time window",
                label: "Duration",
                value: `${durationMinutes} min`,
              },
              {
                helper: "Due now from selected payment option",
                label: "Revenue recorded",
                value: formatPeso(
                  coachId
                    ? amountDueNow
                    : getInitialPaymentAmount(
                        estimatedVenueTotal,
                        paymentStage,
                      ),
                ),
                valueColor: colors.brand,
              },
            ]}
          />
          {coachId ? (
            <OverlayAmountGrid
              colors={colors}
              columns="minmax(0, 1fr)"
              items={[
                {
                  helper: (
                    <>
                      Includes {formatPeso(estimatedCoachTotal)} coach add-on /{" "}
                      {remainingBalance > 0
                        ? `${formatPeso(remainingBalance)} remaining`
                        : "fully paid"}
                    </>
                  ),
                  label: "Booking total",
                  value: formatPeso(estimatedBookingTotal),
                  valueColor: colors.brand,
                },
              ]}
            />
          ) : null}

          <div style={{ display: "grid", gap: 6 }}>
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}
            >
              Payment option
            </FitText>
            <FitSelect
              id="manual-venue-booking-payment-option"
              name="manualVenueBookingPaymentOption"
              aria-label="Manual venue booking payment option"
              value={paymentStage}
              onChange={(event) =>
                setPaymentStage(event.target.value as StaffInitialPaymentStage)
              }
              options={[
                { label: "Cash Full Payment", value: "full" },
                { label: "Cash Downpayment", value: "downpayment" },
              ]}
              compact
              fullWidth
            />
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, color: colors.textMuted }}
            >
              {paymentStage === "downpayment"
                ? `${formatPeso(amountDueNow)} is recorded now; ${formatPeso(remainingBalance)} remains pending full payment.`
                : `${formatPeso(amountDueNow)} confirms this booking as fully paid.`}
            </FitText>
          </div>

          {hasConflict || errorText || venueAvailabilityMessage ? (
            <div
              style={{
                borderRadius: 14,
                border: `1px solid ${(hasConflict || errorText ? colors.danger : colors.warning)}44`,
                backgroundColor: `${hasConflict || errorText ? colors.danger : colors.warning}12`,
                padding: 12,
              }}
            >
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  color: hasConflict || errorText ? colors.danger : colors.warning,
                  lineHeight: 1.45,
                }}
              >
                {errorText ||
                  venueAvailabilityMessage ||
                  "The selected venue is already occupied in this time window."}
              </FitText>
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 6 }}>
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}
            >
              Operator note
            </FitText>
            <FitTextArea
              id="manual-venue-booking-note"
              name="manualVenueBookingNote"
              aria-label="Manual venue booking operator note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="Optional front-desk or facilities note..."
              style={textAreaStyle}
            />
          </div>
        </div>

        <CalendarModal
          isOpen={datePickerOpen}
          minDate={getDefaultDateInput()}
          selectedDate={date}
          onClose={() => setDatePickerOpen(false)}
          onSelect={(nextDate) => {
            if (nextDate) {
              setDate(nextDate);
              setStartTime("");
              setEndTime("");
            }
          }}
        />
      </div>
    </OverlayFrame>
    <ConfirmModal
      isOpen={!!createConfirm}
      title={createConfirm?.title ?? "Confirm venue booking"}
      message={createConfirm?.message ?? ""}
      confirmLabel={createConfirm?.confirmLabel ?? "CREATE BOOKING"}
      loadingLabel={createConfirm?.confirmLabel ?? "CREATE BOOKING"}
      isDanger={createConfirm?.isDanger}
      isLoading={isSubmitting}
      onConfirm={() => {
        const nextAction = createConfirm?.onConfirm;
        setCreateConfirm(null);
        nextAction?.();
      }}
      onCancel={() => setCreateConfirm(null)}
    />
    </>
  );
}

export function GymOperationsCreateCoachBookingModal({
  coachOptions,
  isOpen,
  isSubmitting = false,
  memberOptions,
  onClose,
  onCreate,
}: {
  coachOptions: SelectOption[];
  isOpen: boolean;
  isSubmitting?: boolean;
  memberOptions: SelectOption[];
  onClose: () => void;
  onCreate: (payload: {
    coachId: string;
    durationMinutes: number;
    memberId: string;
    memberNotes?: string;
    paymentStage?: StaffInitialPaymentStage;
    scheduledAt: string;
  }) => void;
}) {
  const { colors, settings } = useTheme();
  const [memberId, setMemberId] = useState("");
  const [coachId, setCoachId] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [coachSearch, setCoachSearch] = useState("");
  const [date, setDate] = useState(getDefaultDateInput());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [slotValue, setSlotValue] = useState("");
  const [note, setNote] = useState("");
  const [paymentStage, setPaymentStage] =
    useState<StaffInitialPaymentStage>("full");
  const [errorText, setErrorText] = useState("");
  const [createConfirm, setCreateConfirm] =
    useState<OverlayConfirmation | null>(null);
  const shouldAnimate = settings.animationLevel !== "none";
  const inputStyle = modalFieldStyle(colors);
  const textAreaStyle = modalTextAreaStyle(colors);
  const { data: coachAvailability, isLoading: coachAvailabilityLoading } =
    useQuery({
      ...coachAvailabilityQueryOptions<CoachAvailabilityResponse>(
        webApiClient,
        coachId || undefined,
      ),
      enabled: isOpen && Boolean(coachId),
    });

  useEffect(() => {
    if (!isOpen) return;
    const defaultMemberId = memberOptions[0]?.value ?? "";
    const defaultCoachId = coachOptions[0]?.value ?? "";
    setMemberId((current) => current || defaultMemberId);
    setCoachId((current) => current || defaultCoachId);
    setMemberSearch(
      memberOptions.find((option) => option.value === defaultMemberId)?.label ??
        "",
    );
    setCoachSearch(
      coachOptions.find((option) => option.value === defaultCoachId)?.label ??
        "",
    );
    setDate(getDefaultDateInput());
    setDatePickerOpen(false);
    setSlotValue("");
    setNote("");
    setPaymentStage("full");
    setErrorText("");
    setCreateConfirm(null);
  }, [coachOptions, isOpen, memberOptions]);

  const currentMinutes = useMemo(() => {
    return getCurrentGymMinutes();
  }, []);

  const slotOptions = useMemo(() => {
    if (!coachAvailability?.availability) {
      return [];
    }

    return expandCoachAvailabilitySlots(
      coachAvailability.availability,
      coachAvailability.scheduleType,
    )
      .filter(
        (slot) =>
          slot.isAvailable &&
          matchesDay(date, slot.dayOfWeek) &&
          (date !== getDefaultDateInput() ||
            toMinutes(slot.startTime) > currentMinutes),
      )
      .map((slot) => {
        const durationMinutes = slot.durationMinutes;
        return {
          durationMinutes,
          label: `${formatSlotLabel(slot.startTime)} - ${formatDurationLabel(durationMinutes)}`,
          startTime: slot.startTime,
          value: `${slot.startTime}|${durationMinutes}`,
        };
      });
  }, [
    coachAvailability?.availability,
    coachAvailability?.scheduleType,
    currentMinutes,
    date,
  ]);

  useEffect(() => {
    if (!slotOptions.some((slot) => slot.value === slotValue)) {
      setSlotValue(slotOptions[0]?.value ?? "");
    }
  }, [slotOptions, slotValue]);

  const selectedSlot =
    slotOptions.find((slot) => slot.value === slotValue) ?? null;
  const selectedCoachOption = coachOptions.find(
    (option) => option.value === coachId,
  );
  const filteredCoachMemberOptions = useMemo(
    () => filterScheduleOptions(memberOptions, memberSearch, memberId),
    [memberId, memberOptions, memberSearch],
  );
  const filteredCoachOptions = useMemo(
    () => filterScheduleOptions(coachOptions, coachSearch, coachId),
    [coachId, coachOptions, coachSearch],
  );
  const nextAvailableSlot = useMemo(
    () => findNextCoachSlot(coachAvailability),
    [coachAvailability],
  );
  const highlightedCoachDates = useMemo(
    () => getUpcomingCoachAvailableDates(coachAvailability),
    [coachAvailability],
  );
  const coachHourlyRate = selectedCoachOption?.hourlyRate ?? 0;
  const estimatedCoachTotal =
    (coachHourlyRate * (selectedSlot?.durationMinutes ?? 0)) / 60;
  const amountDueNow = getInitialPaymentAmount(
    estimatedCoachTotal,
    paymentStage,
  );
  const remainingBalance = roundCurrency(
    Math.max(estimatedCoachTotal - amountDueNow, 0),
  );
  const canSubmit =
    Boolean(memberId) &&
    Boolean(coachId) &&
    Boolean(date) &&
    Boolean(selectedSlot);

  const submitCoachBooking = () => {
    onCreate({
      coachId,
      durationMinutes: selectedSlot?.durationMinutes ?? 0,
      memberId,
      ...(note.trim() ? { memberNotes: note.trim() } : {}),
      paymentStage,
      scheduledAt: toIsoString(date, selectedSlot?.startTime ?? "00:00"),
    });
  };

  const handleCreate = () => {
    setErrorText("");
    if (!memberId) {
      setErrorText("Select the member for this coach booking.");
      return;
    }
    if (!coachId) {
      setErrorText("Select a coach profile before creating the booking.");
      return;
    }
    if (!date) {
      setErrorText("Select a booking date.");
      return;
    }
    if (!selectedSlot) {
      setErrorText(
        "Select one of the coach's available timeslots for this date.",
      );
      return;
    }

    setCreateConfirm({
      confirmLabel: "CREATE COACH BOOKING",
      message: `Create this manual coach booking and record ${formatPeso(amountDueNow)} as ${paymentStage === "downpayment" ? "cash downpayment" : "full cash payment"}?`,
      onConfirm: submitCoachBooking,
      title: "Confirm coach booking",
    });
  };

  return (
    <>
    <OverlayFrame
      isOpen={isOpen}
      onClose={onClose}
      closeDisabled={isSubmitting}
      title="Create coach booking"
      subtitle="Create a front-desk coaching session and record the initial cash payment from the shared schedule."
      footer={
        <FitButton
          variant="primary"
          label={isSubmitting ? "CREATING..." : "CREATE COACH BOOKING"}
          icon={CalendarPlus}
          iconSize={15}
          onClick={handleCreate}
          disabled={!canSubmit || isSubmitting}
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
          transform: shouldAnimate && isOpen ? "scale(1)" : "scale(0.985)",
          transition: shouldAnimate ? "transform 180ms ease" : "none",
        }}
      >
        <div style={{ ...overlaySurfaceStyle(colors), gap: 14 }}>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Member
              </FitText>
              <ScheduleOptionPicker
                disabled={isSubmitting}
                emptyLabel="No members found"
                inputId="manual-coach-booking-member-search"
                inputName="manualCoachBookingMemberSearch"
                inputLabel="Manual coach booking member search"
                inputStyle={inputStyle}
                onChange={(option) => {
                  setMemberId(option.value);
                  setMemberSearch(option.label);
                }}
                onSearchChange={setMemberSearch}
                options={filteredCoachMemberOptions}
                placeholder="Search members"
                searchValue={memberSearch}
                selectedValue={memberId}
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Coach
              </FitText>
              <ScheduleOptionPicker
                disabled={isSubmitting}
                emptyLabel="No coaches found"
                inputId="manual-coach-booking-coach-search"
                inputName="manualCoachBookingCoachSearch"
                inputLabel="Manual coach booking coach search"
                inputStyle={inputStyle}
                onChange={(option) => {
                  setCoachId(option.value);
                  setSlotValue("");
                  setCoachSearch(option.label);
                }}
                onSearchChange={setCoachSearch}
                options={filteredCoachOptions}
                placeholder="Search coaches"
                searchValue={coachSearch}
                selectedValue={coachId}
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 14,
            }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Date
              </FitText>
              <FitButton
                variant="ghost"
                label={date ? formatCompactDate(date) : "Select date"}
                aria-label={`Manual coach booking date: ${
                  date ? formatCompactDate(date) : "Select date"
                }`}
                onClick={() => setDatePickerOpen(true)}
                style={{
                  ...inputStyle,
                  justifyContent: "flex-start",
                  minHeight: 46,
                  width: "100%",
                  borderColor:
                    slotOptions.length > 0 ? colors.success : colors.border,
                }}
                textStyle={{ fontSize: 13, fontWeight: 700 }}
              />
              <FitButton
                variant="primary"
                label="NEXT AVAILABLE SLOT"
                onClick={() => {
                  setErrorText("");
                  if (!coachId) {
                    setErrorText("Select a coach before choosing the next available slot.");
                    return;
                  }
                  if (!nextAvailableSlot) {
                    setErrorText("No available coach slot was found in the next 30 days.");
                    return;
                  }
                  setDate(nextAvailableSlot.date);
                  setSlotValue(nextAvailableSlot.slotValue);
                }}
                disabled={
                  isSubmitting ||
                  coachAvailabilityLoading ||
                  !coachId ||
                  !nextAvailableSlot
                }
                style={{
                  ...actionPillStyle(colors, true),
                  minHeight: 40,
                  padding: "0 12px",
                  width: "100%",
                }}
                textStyle={{ fontSize: 12, fontWeight: 800 }}
              />
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 11,
                  color:
                    slotOptions.length > 0 ? colors.success : colors.textMuted,
                }}
              >
                {coachAvailabilityLoading
                  ? "Checking coach availability..."
                  : slotOptions.length > 0
                    ? `${slotOptions.length} available coach slot${slotOptions.length === 1 ? "" : "s"} on this date.`
                    : coachId
                      ? "No coach slots are available on this date."
                      : "Select a coach to check availability."}
              </FitText>
            </div>
            <div style={{ display: "grid", gap: 6, gridColumn: "span 2" }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Available timeslot
              </FitText>
              <FitSelect
                id="manual-coach-booking-timeslot"
                name="manualCoachBookingTimeslot"
                aria-label="Manual coach booking available timeslot"
                value={slotValue}
                onChange={(event) => setSlotValue(event.target.value)}
                options={slotOptions.map((slot) => ({
                  label: slot.label,
                  value: slot.value,
                }))}
                placeholder={
                  coachAvailabilityLoading ? "Loading slots" : "No slots found"
                }
                compact
                fullWidth
              />
            </div>
          </div>

          <div
            style={{
              borderTop: `1px solid ${colors.border}`,
              backgroundColor: "transparent",
              minHeight: 54,
              paddingTop: 10,
              display: "grid",
              gap: 6,
            }}
          >
            <FitText
              excludeGlobalScale
              style={{
                fontSize: 12,
                color: colors.textPrimary,
                lineHeight: 1.45,
              }}
            >
              {coachAvailabilityLoading
                ? "Loading live coach availability."
                : slotOptions.length > 0
                  ? `${slotOptions.length} live slot${slotOptions.length === 1 ? "" : "s"} available on the selected date.`
                  : "No live coach slots are available on the selected date."}
            </FitText>
            {selectedSlot ? (
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                  lineHeight: 1.45,
                }}
              >
                Selected: {selectedSlot.label}
              </FitText>
            ) : null}
          </div>

          <OverlayAmountGrid
            colors={colors}
            columns="repeat(3, minmax(0, 1fr))"
            items={[
              {
                helper: "Per hour from coach profile",
                label: "Coach rate",
                value: formatPeso(coachHourlyRate),
                valueColor: colors.brand,
              },
              {
                helper: "Selected coach slot",
                label: "Duration",
                value: `${selectedSlot?.durationMinutes ?? 0} min`,
              },
              {
                helper: "Due now from selected payment option",
                label: "Revenue recorded",
                value: formatPeso(amountDueNow),
                valueColor: colors.brand,
              },
            ]}
          />

          <div style={{ display: "grid", gap: 6 }}>
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}
            >
              Payment option
            </FitText>
            <FitSelect
              id="manual-coach-booking-payment-option"
              name="manualCoachBookingPaymentOption"
              aria-label="Manual coach booking payment option"
              value={paymentStage}
              onChange={(event) =>
                setPaymentStage(event.target.value as StaffInitialPaymentStage)
              }
              options={[
                { label: "Cash Full Payment", value: "full" },
                { label: "Cash Downpayment", value: "downpayment" },
              ]}
              compact
              fullWidth
            />
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, color: colors.textMuted }}
            >
              {paymentStage === "downpayment"
                ? `${formatPeso(amountDueNow)} is recorded now; ${formatPeso(remainingBalance)} remains pending full payment.`
                : `${formatPeso(amountDueNow)} confirms this booking as fully paid.`}
            </FitText>
          </div>

          {errorText ? (
            <div
              style={{
                borderRadius: 14,
                border: `1px solid ${colors.danger}44`,
                backgroundColor: `${colors.danger}12`,
                padding: 12,
              }}
            >
              <FitText
                excludeGlobalScale
                style={{ fontSize: 12, color: colors.danger, lineHeight: 1.45 }}
              >
                {errorText}
              </FitText>
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 6 }}>
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}
            >
              Session note
            </FitText>
            <FitTextArea
              id="manual-coach-booking-note"
              name="manualCoachBookingNote"
              aria-label="Manual coach booking session note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="Optional handoff note for the coach or front desk..."
              style={textAreaStyle}
            />
          </div>
        </div>

        <CalendarModal
          highlightedDates={highlightedCoachDates}
          isOpen={datePickerOpen}
          minDate={getDefaultDateInput()}
          selectedDate={date}
          onClose={() => setDatePickerOpen(false)}
          onSelect={(nextDate) => {
            if (nextDate) setDate(nextDate);
          }}
        />
      </div>
    </OverlayFrame>
    <ConfirmModal
      isOpen={!!createConfirm}
      title={createConfirm?.title ?? "Confirm coach booking"}
      message={createConfirm?.message ?? ""}
      confirmLabel={createConfirm?.confirmLabel ?? "CREATE COACH BOOKING"}
      loadingLabel={createConfirm?.confirmLabel ?? "CREATE COACH BOOKING"}
      isDanger={createConfirm?.isDanger}
      isLoading={isSubmitting}
      onConfirm={() => {
        const nextAction = createConfirm?.onConfirm;
        setCreateConfirm(null);
        nextAction?.();
      }}
      onCancel={() => setCreateConfirm(null)}
    />
    </>
  );
}

export function GymOperationsCreateCoachModal({
  isOpen,
  isSubmitting = false,
  onClose,
  onCreate,
}: {
  isOpen: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
  onCreate: (payload: {
    bio?: string;
    certifications?: string[];
    contactEmail?: string;
    contactPhone?: string;
    displayName: string;
    hourlyRate?: number;
    isAvailableForBooking?: boolean;
    scheduleType?: "full_time" | "part_time";
    specialties?: string[];
  }) => void;
}) {
  const { colors, settings } = useTheme();
  const [displayName, setDisplayName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [certifications, setCertifications] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [scheduleType, setScheduleType] =
    useState<"full_time" | "part_time">("part_time");
  const [isAvailableForBooking, setIsAvailableForBooking] = useState("active");
  const [bio, setBio] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createConfirm, setCreateConfirm] =
    useState<OverlayConfirmation | null>(null);
  const shouldAnimate = settings.animationLevel !== "none";
  const inputStyle = modalFieldStyle(colors);
  const textAreaStyle = modalTextAreaStyle(colors);

  useEffect(() => {
    if (!isOpen) return;
    setDisplayName("");
    setContactEmail("");
    setContactPhone("");
    setSpecialties("");
    setCertifications("");
    setHourlyRate("");
    setScheduleType("part_time");
    setIsAvailableForBooking("active");
    setBio("");
    setErrors({});
    setCreateConfirm(null);
  }, [isOpen]);

  const specialtiesList = useMemo(
    () => splitListInput(specialties),
    [specialties],
  );
  const selectedSpecialties = useMemo(
    () => new Set(specialtiesList),
    [specialtiesList],
  );
  const certificationsList = useMemo(
    () => splitListInput(certifications),
    [certifications],
  );
  const hourlyRateValue = Number(hourlyRate);
  const canSubmit =
    displayName.trim().length > 0 &&
    specialtiesList.length > 0 &&
    hourlyRate.trim().length > 0 &&
    Number.isFinite(hourlyRateValue) &&
    hourlyRateValue > 0 &&
    !isSubmitting;

  const validateCoach = () => {
    const nextErrors: Record<string, string> = {};
    const name = displayName.trim();
    const email = contactEmail.trim();
    const phone = contactPhone.trim();
    const joinedSpecialties = specialtiesList.join(", ");
    const joinedCertifications = certificationsList.join(", ");

    if (!name) nextErrors.displayName = "Coach name is required.";
    if (name.length > 160)
      nextErrors.displayName = "Coach name must not exceed 160 characters.";
    if (email && !EMAIL_PATTERN.test(email))
      nextErrors.contactEmail = "Enter a valid coach contact email.";
    if (email.length > 255)
      nextErrors.contactEmail = "Contact email must not exceed 255 characters.";
    if (phone && !PHONE_PATTERN.test(phone))
      nextErrors.contactPhone = "Enter a valid contact phone number.";
    if (phone.length > 40)
      nextErrors.contactPhone = "Contact phone must not exceed 40 characters.";
    if (specialtiesList.length === 0)
      nextErrors.specialties = "Enter at least one specialty.";
    if (joinedSpecialties.length > 255)
      nextErrors.specialties = "Specialties must not exceed 255 characters.";
    if (joinedCertifications.length > 255)
      nextErrors.certifications =
        "Certifications must not exceed 255 characters.";
    if (!hourlyRate.trim()) {
      nextErrors.hourlyRate = "Hourly rate is required.";
    } else if (!Number.isFinite(hourlyRateValue) || hourlyRateValue <= 0) {
      nextErrors.hourlyRate = "Hourly rate must be greater than zero.";
    }
    if (bio.length > 2000)
      nextErrors.bio = "Bio must not exceed 2000 characters.";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submitCoach = () => {
    onCreate({
      ...(bio.trim() ? { bio: bio.trim() } : {}),
      ...(certificationsList.length > 0
        ? { certifications: certificationsList }
        : {}),
      ...(contactEmail.trim() ? { contactEmail: contactEmail.trim() } : {}),
      ...(contactPhone.trim() ? { contactPhone: contactPhone.trim() } : {}),
      displayName: displayName.trim(),
      hourlyRate: hourlyRateValue,
      isAvailableForBooking: isAvailableForBooking === "active",
      scheduleType,
      specialties: specialtiesList,
    });
  };

  const toggleSpecialty = (value: string) => {
    const nextValues = selectedSpecialties.has(value)
      ? specialtiesList.filter((item) => item !== value)
      : [...specialtiesList, value];
    setSpecialties(nextValues.join(", "));
    if (errors.specialties) {
      setErrors((current) => ({ ...current, specialties: "" }));
    }
  };

  const handleCreate = () => {
    if (!validateCoach()) return;

    setCreateConfirm({
      confirmLabel: "CREATE COACH",
      message: "Create this standalone coach now?",
      onConfirm: submitCoach,
      title: "Confirm coach profile",
    });
  };

  return (
    <>
    <OverlayFrame
      isOpen={isOpen}
      onClose={onClose}
      closeDisabled={isSubmitting}
      title="Create coach"
      subtitle="Create a standalone coach record for Gym Operations. This does not create a mobile/member profile or login account."
      footer={
        <FitButton
          variant="primary"
          label={isSubmitting ? "CREATING..." : "CREATE COACH"}
          icon={UserPlus}
          iconSize={15}
          onClick={handleCreate}
          disabled={!canSubmit || isSubmitting}
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
          transform: shouldAnimate && isOpen ? "scale(1)" : "scale(0.985)",
          transition: shouldAnimate ? "transform 180ms ease" : "none",
        }}
      >
        <div style={{ ...overlaySurfaceStyle(colors), gap: 14 }}>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Coach name
              </FitText>
              <FitTextInput
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Coach name"
                style={inputStyle}
              />
              {errors.displayName ? (
                <FitText
                  excludeGlobalScale
                  style={{ fontSize: 11, color: colors.danger }}
                >
                  {errors.displayName}
                </FitText>
              ) : null}
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Hourly rate
              </FitText>
              <FitTextInput
                type="number"
                value={hourlyRate}
                onChange={(event) => setHourlyRate(event.target.value)}
                placeholder="0"
                style={inputStyle}
              />
              {errors.hourlyRate ? (
                <FitText
                  excludeGlobalScale
                  style={{ fontSize: 11, color: colors.danger }}
                >
                  {errors.hourlyRate}
                </FitText>
              ) : null}
            </div>
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Contact email
              </FitText>
              <FitTextInput
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                placeholder="coach@fittrack.com"
                style={inputStyle}
              />
              {errors.contactEmail ? (
                <FitText
                  excludeGlobalScale
                  style={{ fontSize: 11, color: colors.danger }}
                >
                  {errors.contactEmail}
                </FitText>
              ) : null}
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Contact phone
              </FitText>
              <FitTextInput
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
                placeholder="+639171234567"
                style={inputStyle}
              />
              {errors.contactPhone ? (
                <FitText
                  excludeGlobalScale
                  style={{ fontSize: 11, color: colors.danger }}
                >
                  {errors.contactPhone}
                </FitText>
              ) : null}
            </div>
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Specialties
              </FitText>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {COACH_SPECIALTY_OPTIONS.map((option) => {
                  const selected = selectedSpecialties.has(option.value);

                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      disabled={isSubmitting}
                      onClick={() => toggleSpecialty(option.value)}
                      style={{
                        backgroundColor: selected
                          ? colors.brand
                          : colors.surfaceRaised,
                        border: `1px solid ${
                          selected ? `${colors.brand}66` : colors.border
                        }`,
                        borderRadius: 999,
                        boxShadow: selected
                          ? `0 0 0 1px ${colors.brand}22 inset`
                          : "none",
                        color: selected
                          ? colors.onBrand
                          : colors.textPrimary,
                        cursor: isSubmitting ? "not-allowed" : "pointer",
                        fontSize: 12,
                        fontWeight: 800,
                        minHeight: 34,
                        padding: "7px 12px",
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <FitText
                excludeGlobalScale
                style={{ color: colors.textMuted, fontSize: 11 }}
              >
                {specialtiesList.length
                  ? specialtiesList.join(" / ")
                  : "Select at least one coach specialty."}
              </FitText>
              {errors.specialties ? (
                <FitText
                  excludeGlobalScale
                  style={{ fontSize: 11, color: colors.danger }}
                >
                  {errors.specialties}
                </FitText>
              ) : null}
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Certifications
              </FitText>
              <FitTextArea
                value={certifications}
                onChange={(event) => setCertifications(event.target.value)}
                rows={3}
                placeholder="NASM-CPT, CrossFit L1"
                style={textAreaStyle}
              />
              {errors.certifications ? (
                <FitText
                  excludeGlobalScale
                  style={{ fontSize: 11, color: colors.danger }}
                >
                  {errors.certifications}
                </FitText>
              ) : null}
            </div>
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Working schedule
              </FitText>
              <FitSelect
                value={scheduleType}
                onChange={(event) =>
                  setScheduleType(
                    event.target.value === "full_time"
                      ? "full_time"
                      : "part_time",
                  )
                }
                options={[
                  { label: "Full-time", value: "full_time" },
                  { label: "Part-time", value: "part_time" },
                ]}
                compact
                fullWidth
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Booking visibility
              </FitText>
              <FitSelect
                value={isAvailableForBooking}
                onChange={(event) =>
                  setIsAvailableForBooking(event.target.value)
                }
                options={[
                  { label: "Visible to member booking", value: "active" },
                  { label: "Hidden until ready", value: "inactive" },
                ]}
                compact
                fullWidth
              />
            </div>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}
            >
              Bio
            </FitText>
            <FitTextArea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              rows={4}
              placeholder="Short member-facing coach summary..."
              style={textAreaStyle}
            />
            {errors.bio ? (
              <FitText
                excludeGlobalScale
                style={{ fontSize: 11, color: colors.danger }}
              >
                {errors.bio}
              </FitText>
            ) : null}
          </div>
        </div>

      </div>
    </OverlayFrame>
    <ConfirmModal
      isOpen={!!createConfirm}
      title={createConfirm?.title ?? "Confirm coach profile"}
      message={createConfirm?.message ?? ""}
      confirmLabel={createConfirm?.confirmLabel ?? "CREATE COACH"}
      loadingLabel={createConfirm?.confirmLabel ?? "CREATE COACH"}
      isDanger={createConfirm?.isDanger}
      isLoading={isSubmitting}
      onConfirm={() => {
        const nextAction = createConfirm?.onConfirm;
        setCreateConfirm(null);
        nextAction?.();
      }}
      onCancel={() => setCreateConfirm(null)}
    />
    </>
  );
}
