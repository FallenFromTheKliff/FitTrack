"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { CalendarPlus, UserPlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import type {
  AppointmentAvailabilitySlot,
  CoachAvailabilityResponse,
  VenueAvailabilityRecord,
} from "@fittrack/api-client";
import type { CreateUserCoachProfileInput } from "@fittrack/types";
import {
  appointmentAvailabilityQueryOptions,
  coachAvailabilityQueryOptions,
  venueAvailabilityQueryOptions,
} from "@fittrack/query";
import { expandCoachAvailabilitySlots } from "@fittrack/utils";
import {
  authStrongPasswordPattern,
  composeAuthPhilippineMobileNumber,
  isAllowedAuthEmailDomain,
  isSupportedAuthPhilippineMobileNumber,
} from "@fittrack/validators";

import { useTheme } from "@/contexts/ThemeContext";
import { webApiClient } from "@/lib/api-client";
import { createClientIdempotencyKey } from "@/lib/commerce-checkout";
import CoachSpecialtyPicker from "@/components/coaching/CoachSpecialtyPicker";
import {
  FitButton,
  FitSelect,
  FitText,
  FitTextArea,
  FitTextInput,
} from "@/components/fit";
import { CalendarModal, ConfirmModal } from "@/components/modals";
import { OverlayAmountGrid } from "./GymOperationsOverlayCards";
import {
  buildStaffCoachBookingSubmission,
  getMonthlyCoachPaidPeriod,
  isActiveMonthlyCoachOffer,
  STAFF_COACH_SESSION_DURATIONS,
  type StaffCoachBookingSubmission,
} from "./coachCashBooking";
import { OverlayFrame } from "./GymOperationsOverlayFrame";
import {
  EMAIL_PATTERN,
  actionPillStyle,
  formatCompactDate,
  formatDurationLabel,
  formatPeso,
  formatSlotLabel,
  getCurrentGymMinutes,
  getDefaultDateInput,
  hasVenueWindowConflict,
  matchesDay,
  modalFieldStyle,
  modalTextAreaStyle,
  overlaySurfaceStyle,
  splitListInput,
  toIsoString,
  toMinutes,
  type OverlayConfirmation,
  type SelectOption,
} from "./GymOperationsOverlayShared";

function filterScheduleOptions(
  options: SelectOption[],
  searchValue: string,
  selectedValue: string,
) {
  const selectedOption = options.find(
    (option) => option.value === selectedValue,
  );
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

function createTemporaryCoachPassword() {
  const randomPart =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2);

  return `FitTrack!${randomPart.slice(0, 24)}`;
}

function splitCoachAccountName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ") || firstName;

  return { firstName, lastName };
}

const MAX_CREATE_COACH_HOURLY_RATE = 999_999.99;
const CREATE_COACH_SCHEDULE_TYPES = ["full_time", "part_time"] as const;
const CREATE_COACH_VISIBILITY_VALUES = ["active", "inactive"] as const;

type CreateCoachModalForm = {
  bio: string;
  certifications: string;
  contactEmail: string;
  contactPhone: string;
  displayName: string;
  hourlyRate: string;
  isAvailableForBooking: string;
  password: string;
  scheduleType: string;
  specialties: string;
};

type CreateCoachModalPayload = {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  coachProfile: CreateUserCoachProfileInput;
  phone_no?: string;
};

type CreateCoachModalValidation = {
  errors: Partial<Record<keyof CreateCoachModalForm, string>>;
  payload: CreateCoachModalPayload | null;
};

export function validateCreateCoachForm(
  form: CreateCoachModalForm,
): CreateCoachModalValidation {
  const errors: CreateCoachModalValidation["errors"] = {};
  const name = form.displayName.trim();
  const nameParts = name.split(/\s+/).filter(Boolean);
  const email = form.contactEmail.trim();
  const normalizedEmail = email.toLowerCase();
  const password = form.password;
  const phoneRemainder = form.contactPhone;
  const specialtiesList = splitListInput(form.specialties);
  const certificationsList = splitListInput(form.certifications);
  const joinedSpecialties = specialtiesList.join(", ");
  const joinedCertifications = certificationsList.join(", ");
  const bio = form.bio.trim();
  const hourlyRateText = form.hourlyRate.trim();
  const { firstName, lastName } = splitCoachAccountName(name);

  if (!name) errors.displayName = "Coach name is required.";
  else if (nameParts.length < 2)
    errors.displayName = "Enter a coach first and last name.";
  else if (name.length > 160)
    errors.displayName = "Coach name must not exceed 160 characters.";
  else if (firstName.length < 2 || lastName.length < 2)
    errors.displayName = "Enter a coach first and last name.";
  else if (firstName.length > 100 || lastName.length > 100)
    errors.displayName =
      "Coach names must not exceed 100 characters per name.";

  if (!email) errors.contactEmail = "Account email is required.";
  else if (email.length > 255)
    errors.contactEmail = "Account email must not exceed 255 characters.";
  else if (!EMAIL_PATTERN.test(normalizedEmail))
    errors.contactEmail = "Enter a valid coach account email.";
  else if (!isAllowedAuthEmailDomain(normalizedEmail))
    errors.contactEmail = "Use a supported account email domain.";

  if (!password.trim()) errors.password = "Temporary password is required.";
  else if (password.length < 10)
    errors.password = "Temporary password must be at least 10 characters.";
  else if (password.length > 64)
    errors.password = "Temporary password must not exceed 64 characters.";
  else if (/\s/.test(password))
    errors.password = "Temporary password must not contain spaces.";
  else if (!authStrongPasswordPattern.test(password))
    errors.password =
      "Temporary password needs upper, lower, number, and symbol.";

  let phone = "";
  if (phoneRemainder.trim()) {
    if (!/^9\d{9}$/.test(phoneRemainder)) {
      errors.contactPhone =
        "Enter a valid Philippine mobile remainder after +63 (9XXXXXXXXX).";
    } else {
      phone = composeAuthPhilippineMobileNumber("+63", phoneRemainder);
      if (!isSupportedAuthPhilippineMobileNumber(phone)) {
        errors.contactPhone = "Enter a valid Philippine mobile number.";
      }
    }
  }

  if (specialtiesList.length === 0)
    errors.specialties = "Enter at least one specialty.";
  else if (joinedSpecialties.length > 255)
    errors.specialties = "Specialties must not exceed 255 characters.";

  if (joinedCertifications.length > 255)
    errors.certifications =
      "Certifications must not exceed 255 characters.";

  let hourlyRateValue: number | undefined;
  if (!hourlyRateText) {
    errors.hourlyRate = "Hourly rate is required.";
  } else if (!/^\d+(?:\.\d{1,2})?$/.test(hourlyRateText)) {
    errors.hourlyRate = "Enter a valid hourly rate.";
  } else {
    hourlyRateValue = Number(hourlyRateText);
    if (!Number.isFinite(hourlyRateValue) || hourlyRateValue <= 0) {
      errors.hourlyRate = "Hourly rate must be greater than zero.";
    } else if (hourlyRateValue > MAX_CREATE_COACH_HOURLY_RATE) {
      errors.hourlyRate =
        "Hourly rate must not exceed 999999.99 Philippine pesos.";
    }
  }

  const scheduleType = CREATE_COACH_SCHEDULE_TYPES.includes(
    form.scheduleType as (typeof CREATE_COACH_SCHEDULE_TYPES)[number],
  )
    ? (form.scheduleType as (typeof CREATE_COACH_SCHEDULE_TYPES)[number])
    : undefined;
  if (!scheduleType) errors.scheduleType = "Select a valid working schedule.";

  const visibility = CREATE_COACH_VISIBILITY_VALUES.includes(
    form.isAvailableForBooking as (typeof CREATE_COACH_VISIBILITY_VALUES)[number],
  )
    ? (form.isAvailableForBooking as (typeof CREATE_COACH_VISIBILITY_VALUES)[number])
    : undefined;
  if (!visibility)
    errors.isAvailableForBooking = "Select a valid booking visibility.";

  if (bio.length > 2000)
    errors.bio = "Bio must not exceed 2000 characters.";

  if (
    Object.keys(errors).length > 0 ||
    hourlyRateValue === undefined ||
    !scheduleType ||
    !visibility
  ) {
    return { errors, payload: null };
  }

  return {
    errors,
    payload: {
      email: normalizedEmail,
      firstName,
      lastName,
      password,
      coachProfile: {
        ...(bio ? { bio } : {}),
        ...(certificationsList.length > 0
          ? { certifications: certificationsList }
          : {}),
        contactEmail: normalizedEmail,
        ...(phone ? { contactPhone: phone } : {}),
        displayName: name,
        hourlyRate: hourlyRateValue,
        isAvailableForBooking: visibility === "active",
        scheduleType,
        specialties: specialtiesList,
      },
      ...(phone ? { phone_no: phone } : {}),
    },
  };
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

function formatCanonicalCoachTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return date.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
}

export function GymOperationsCreateVenueBookingModal({
  coachOptions,
  isOpen,
  isSubmitting = false,
  memberOptions,
  onClose,
  onCreate,
  onRetryVenues,
  venueOptions,
  venuesLoadFailed = false,
  venuesLoading = false,
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
    paymentStage?: "full";
    startsAt: string;
  }) => Promise<{ error?: string; success: boolean }>;
  onRetryVenues?: () => void;
  venueOptions: SelectOption[];
  venuesLoadFailed?: boolean;
  venuesLoading?: boolean;
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
  const paymentStage = "full" as const;
  const [errorText, setErrorText] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"date" | "end" | "member" | "start" | "venue", string>>
  >({});
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
    setVenueId((current) =>
      venueOptions.some(
        (option) => option.value === current && !option.disabled,
      )
        ? current
        : venueOptions.find((option) => !option.disabled)?.value || "",
    );
    setCoachId("");
    setDate(getDefaultDateInput());
    setDatePickerOpen(false);
    setStartTime("09:00");
    setEndTime("10:00");
    setNote("");
    setErrorText("");
    setFieldErrors({});
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
          return (
            value &&
            (date !== getDefaultDateInput() ||
              toMinutes(value) > currentMinutes)
          );
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
    const selectedOption = venueStartOptions.find(
      (option) => option.value === startTime,
    );
    if (!selectedOption || selectedOption.disabled) {
      setStartTime(
        venueStartOptions.find((option) => !option.disabled)?.value ?? "",
      );
    }
  }, [startTime, venueStartOptions]);
  const venueEndOptions = useMemo(() => {
    if (!startTime) return [];
    const startIndex = liveVenueSlots.findIndex(
      (slot) => venueAvailabilityTimeValue(slot.startTime) === startTime,
    );
    if (
      startIndex === -1 ||
      liveVenueSlots[startIndex]?.status !== "available"
    ) {
      return [];
    }

    const options: Array<{ label: string; value: string }> = [];
    let expectedStart = new Date(
      liveVenueSlots[startIndex].startTime,
    ).getTime();
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
  }, [liveVenueSlots, startTime]);
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
  const selectedVenueUnavailableReason =
    selectedVenueOption?.unavailableReason ?? null;
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
  const isVenueWindowInFuture =
    Boolean(startTime) &&
    (date !== getDefaultDateInput() || toMinutes(startTime) > currentMinutes);
  const submitVenueBooking = async () => {
    setCreateConfirm(null);
    const result = await onCreate({
      amenityId: venueId,
      ...(coachId ? { coachId } : {}),
      endsAt: toIsoString(date, endTime),
      memberId,
      ...(note.trim() ? { notes: note.trim() } : {}),
      paymentStage,
      startsAt: toIsoString(date, startTime),
    });
    if (!result.success) {
      const message = result.error ?? "Unable to create venue booking.";
      if (/venue|amenity|maintenance|reservable/i.test(message)) {
        setFieldErrors((current) => ({ ...current, venue: message }));
        setErrorText("");
      } else {
        setErrorText(message);
      }
    }
  };

  const handleCreate = () => {
    setErrorText("");
    const nextFieldErrors: typeof fieldErrors = {};
    if (!memberId) {
      nextFieldErrors.member = "Select the member for this venue booking.";
    }
    if (!selectedVenueOption) {
      nextFieldErrors.venue = "Select a venue before creating the booking.";
    } else if (selectedVenueOption.disabled || selectedVenueUnavailableReason) {
      nextFieldErrors.venue =
        selectedVenueUnavailableReason ?? "This venue is not bookable.";
    }
    if (!date) nextFieldErrors.date = "Select a booking date.";
    if (!startTime) nextFieldErrors.start = "Select a live start time.";
    if (!endTime) nextFieldErrors.end = "Select a live end time.";
    if (startTime && endTime && endTime <= startTime) {
      nextFieldErrors.end = "End time must be after the start time.";
    }
    if (!isVenueWindowInFuture) {
      nextFieldErrors.start =
        "Same-day bookings must use a future start time.";
    }
    if (hasConflict) {
      nextFieldErrors.end =
        "The selected venue already has a pending or confirmed booking in this time window.";
    }
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) {
      return;
    }

    setCreateConfirm({
      confirmLabel: "CREATE BOOKING",
      message: `Create this manual venue booking and record ${formatPeso(estimatedBookingTotal)} as full cash payment?`,
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
            disabled={isSubmitting}
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
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
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
                  Member
                </FitText>
                <FitSelect
                  id="manual-venue-booking-member"
                  name="manualVenueBookingMember"
                  aria-label="Manual venue booking member"
                  value={memberId}
                  onChange={(event) => {
                    setMemberId(event.target.value);
                    setFieldErrors((current) => ({ ...current, member: undefined }));
                  }}
                  options={memberOptions}
                  placeholder="Select member"
                  compact
                  fullWidth
                />
                {fieldErrors.member ? (
                  <FitText style={{ color: colors.danger, fontSize: 11 }}>
                    {fieldErrors.member}
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
                    const option = venueOptions.find(
                      (candidate) => candidate.value === event.target.value,
                    );
                    setFieldErrors((current) => ({
                      ...current,
                      venue: option?.unavailableReason ?? undefined,
                    }));
                  }}
                  options={venueOptions}
                  disabled={
                    venuesLoading || venuesLoadFailed || venueOptions.length === 0
                  }
                  compact
                  fullWidth
                />
                {venuesLoading ? (
                  <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
                    Loading venues...
                  </FitText>
                ) : venuesLoadFailed ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <FitText style={{ color: colors.danger, fontSize: 12 }}>
                      Unable to load venues.
                    </FitText>
                    {onRetryVenues ? (
                      <FitButton
                        variant="ghost"
                        label="RETRY"
                        onClick={onRetryVenues}
                        style={{ minHeight: 28, padding: "4px 8px" }}
                        textStyle={{ fontSize: 10, fontWeight: 800 }}
                      />
                    ) : null}
                  </div>
                ) : venueOptions.length === 0 ? (
                  <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
                    No reservable venues are available.
                  </FitText>
                ) : null}
                {fieldErrors.venue ? (
                  <FitText style={{ color: colors.danger, fontSize: 11 }}>
                    {fieldErrors.venue}
                  </FitText>
                ) : null}
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
                {fieldErrors.date ? (
                  <FitText style={{ color: colors.danger, fontSize: 11 }}>
                    {fieldErrors.date}
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
                    setFieldErrors((current) => ({
                      ...current,
                      start: undefined,
                      end: undefined,
                    }));
                  }}
                  options={venueStartOptions}
                  disabled={
                    venueAvailabilityLoading || venueStartOptions.length === 0
                  }
                  compact
                  fullWidth
                />
                {fieldErrors.start ? (
                  <FitText style={{ color: colors.danger, fontSize: 11 }}>
                    {fieldErrors.start}
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
                  End time
                </FitText>
                <FitSelect
                  id="manual-venue-booking-end-time"
                  name="manualVenueBookingEndTime"
                  aria-label="Manual venue booking end time"
                  value={endTime}
                  onChange={(event) => {
                    setEndTime(event.target.value);
                    setFieldErrors((current) => ({ ...current, end: undefined }));
                  }}
                  options={venueEndOptions}
                  disabled={!startTime || venueEndOptions.length === 0}
                  compact
                  fullWidth
                />
                {fieldErrors.end ? (
                  <FitText style={{ color: colors.danger, fontSize: 11 }}>
                    {fieldErrors.end}
                  </FitText>
                ) : null}
              </div>
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
                  helper: "Full cash amount recorded",
                  label: "Revenue recorded",
                  value: formatPeso(estimatedBookingTotal),
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
                    helper: `Includes ${formatPeso(estimatedCoachTotal)} coach add-on`,
                    label: "Booking total",
                    value: formatPeso(estimatedBookingTotal),
                    valueColor: colors.brand,
                  },
                ]}
              />
            ) : null}

            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, color: colors.textMuted }}
            >
              Cashier bookings record the full amount immediately. This creates
              a confirmed product booking with no deferred collection step.
            </FitText>

            {hasConflict || errorText || venueAvailabilityMessage ? (
              <div
                style={{
                  borderRadius: 14,
                  border: `1px solid ${hasConflict || errorText ? colors.danger : colors.warning}44`,
                  backgroundColor: `${hasConflict || errorText ? colors.danger : colors.warning}12`,
                  padding: 12,
                }}
              >
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 12,
                    color:
                      hasConflict || errorText ? colors.danger : colors.warning,
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
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
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
              setDate(nextDate);
              setStartTime("");
              setEndTime("");
              setFieldErrors((current) => ({
                ...current,
                date: undefined,
                end: undefined,
                start: undefined,
              }));
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
  onCreate: (payload: StaffCoachBookingSubmission) => Promise<void>;
}) {
  const { colors, settings } = useTheme();
  const [bookingMode, setBookingMode] = useState<"monthly" | "single">("single");
  const [memberId, setMemberId] = useState("");
  const [coachId, setCoachId] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [coachSearch, setCoachSearch] = useState("");
  const [date, setDate] = useState(getDefaultDateInput());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [slotValue, setSlotValue] = useState("");
  const [note, setNote] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const idempotencyKeyRef = useRef(createClientIdempotencyKey());
  const [fieldErrors, setFieldErrors] = useState<
    Partial<
      Record<"coach" | "date" | "member" | "monthlyOffer" | "slot", string>
    >
  >({});
  const [createConfirm, setCreateConfirm] =
    useState<OverlayConfirmation | null>(null);
  const [submitError, setSubmitError] = useState("");
  const shouldAnimate = settings.animationLevel !== "none";
  const inputStyle = modalFieldStyle(colors);
  const textAreaStyle = modalTextAreaStyle(colors);
  const { data: coachAvailability } = useQuery({
      ...coachAvailabilityQueryOptions<CoachAvailabilityResponse>(
        webApiClient,
        coachId || undefined,
      ),
      enabled: isOpen && bookingMode === "single" && Boolean(coachId),
    });
  const {
    data: canonicalAvailability = [],
    error: canonicalAvailabilityError,
    isLoading: canonicalAvailabilityLoading,
  } = useQuery({
    ...appointmentAvailabilityQueryOptions(
      webApiClient,
      coachId || undefined,
      date || undefined,
      durationMinutes,
    ),
    enabled:
      isOpen &&
      bookingMode === "single" &&
      Boolean(coachId && date && durationMinutes),
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
    setDurationMinutes(60);
    setBookingMode("single");
    setDatePickerOpen(false);
    setSlotValue("");
    setNote("");
    setReferenceNo("");
    idempotencyKeyRef.current = createClientIdempotencyKey();
    setFieldErrors({});
    setSubmitError("");
    setCreateConfirm(null);
  }, [coachOptions, isOpen, memberOptions]);

  const slotOptions = useMemo(() => {
    const seen = new Set<string>();
    return canonicalAvailability
      .filter(
        (slot: AppointmentAvailabilitySlot) =>
          slot.available &&
          slot.durationMinutes === durationMinutes &&
          new Date(slot.startAt).getTime() > Date.now(),
      )
      .filter((slot: AppointmentAvailabilitySlot) => {
        if (seen.has(slot.startAt)) return false;
        seen.add(slot.startAt);
        return true;
      })
      .sort((left, right) => left.startAt.localeCompare(right.startAt))
      .map((slot: AppointmentAvailabilitySlot) => ({
        durationMinutes: slot.durationMinutes,
        label: `${formatCanonicalCoachTime(slot.startAt)} - ${formatCanonicalCoachTime(slot.endAt)}`,
        scheduledAt: slot.startAt,
        value: slot.startAt,
      }));
  }, [canonicalAvailability, durationMinutes]);

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
  const eligibleCoachOptions = useMemo(
    () =>
      bookingMode === "monthly"
        ? coachOptions.filter((option) => isActiveMonthlyCoachOffer(option))
        : coachOptions,
    [bookingMode, coachOptions],
  );
  const filteredCoachOptions = useMemo(
    () => filterScheduleOptions(eligibleCoachOptions, coachSearch, coachId),
    [coachId, coachSearch, eligibleCoachOptions],
  );
  const highlightedCoachDates = useMemo(
    () => getUpcomingCoachAvailableDates(coachAvailability),
    [coachAvailability],
  );
  const coachHourlyRate = selectedCoachOption?.hourlyRate ?? 0;
  const estimatedCoachTotal =
    (coachHourlyRate * (selectedSlot?.durationMinutes ?? 0)) / 60;
  const monthlyOfferReady = isActiveMonthlyCoachOffer(
    selectedCoachOption ?? {},
  );
  const monthlyPaidPeriod = getMonthlyCoachPaidPeriod(date);

  const submitCoachBooking = async () => {
    setSubmitError("");
    try {
      await onCreate(buildStaffCoachBookingSubmission({
        bookingMode,
        coachId,
        durationMinutes,
        idempotencyKey: idempotencyKeyRef.current,
        memberId,
        memberNotes: note,
        referenceNo,
        scheduledAt: selectedSlot?.scheduledAt,
        startDate: date,
      }));
    } catch (error) {
      setSubmitError(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Unable to create this coach booking. Review the fields and try again.",
      );
    }
  };

  const handleCreate = () => {
    const nextFieldErrors: typeof fieldErrors = {};
    if (!memberId) {
      nextFieldErrors.member = "Select the member for this coach booking.";
    }
    if (!coachId) {
      nextFieldErrors.coach =
        "Select a coach profile before creating the booking.";
    }
    if (!date) {
      nextFieldErrors.date = "Select a booking date.";
    }
    if (bookingMode === "monthly" && !monthlyOfferReady) {
      nextFieldErrors.monthlyOffer =
        "Select a coach with an active monthly coaching offer.";
    }
    if (bookingMode === "single" && !selectedSlot) {
      nextFieldErrors.slot =
        "Select one of the coach's available timeslots for this date.";
    }
    setFieldErrors(nextFieldErrors);
    setSubmitError("");
    if (Object.keys(nextFieldErrors).length > 0) {
      return;
    }

    setCreateConfirm({
      confirmLabel:
        bookingMode === "monthly" ? "ENROLL MONTHLY" : "CREATE 1 SESSION",
      message:
        bookingMode === "monthly"
          ? `Enroll this member for ${formatPeso(Number(selectedCoachOption?.monthlyRate ?? 0))} covering ${monthlyPaidPeriod ? `${formatCompactDate(monthlyPaidPeriod.startDate)} to ${formatCompactDate(monthlyPaidPeriod.endDate)}` : "one month"}, and record one full cash payment? The package becomes active immediately.`
          : `Create this one-session booking and record ${formatPeso(estimatedCoachTotal)} as full cash payment?`,
      onConfirm: submitCoachBooking,
      title:
        bookingMode === "monthly"
          ? "Confirm monthly coaching"
          : "Confirm coach session",
    });
  };

  return (
    <>
      <OverlayFrame
        isOpen={isOpen}
        onClose={onClose}
        closeDisabled={isSubmitting}
        title="Create coach booking"
        subtitle="Create one paid coach session or a fully paid monthly coaching enrollment."
        footer={
          <FitButton
            variant="primary"
            label={
              isSubmitting
                ? "CREATING..."
                : bookingMode === "monthly"
                  ? "ENROLL 1 MONTH"
                  : "CREATE 1 SESSION"
            }
            icon={CalendarPlus}
            iconSize={15}
            onClick={handleCreate}
            disabled={isSubmitting}
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
            <div style={{ display: "grid", gap: 7 }}>
              <FitText
                excludeGlobalScale
                style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}
              >
                Booking type
              </FitText>
              <div
                role="radiogroup"
                aria-label="Coach booking type"
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
              >
                {[
                  { label: "1 Session", value: "single" as const },
                  { label: "1 Month", value: "monthly" as const },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={bookingMode === option.value}
                    onClick={() => {
                      setBookingMode(option.value);
                      if (option.value === "monthly") {
                        const currentCoach = coachOptions.find(
                          (coach) => coach.value === coachId,
                        );
                        if (!currentCoach || !isActiveMonthlyCoachOffer(currentCoach)) {
                          const firstEligibleCoach = coachOptions.find((coach) =>
                            isActiveMonthlyCoachOffer(coach),
                          );
                          setCoachId(firstEligibleCoach?.value ?? "");
                          setCoachSearch(firstEligibleCoach?.label ?? "");
                        }
                      } else if (!coachId) {
                        setCoachId(coachOptions[0]?.value ?? "");
                        setCoachSearch(coachOptions[0]?.label ?? "");
                      }
                      setSlotValue("");
                      setFieldErrors({});
                      setSubmitError("");
                    }}
                    disabled={isSubmitting}
                    style={{
                      ...inputStyle,
                      backgroundColor:
                        bookingMode === option.value
                          ? `${colors.brand}20`
                          : colors.surfaceRaised,
                      borderColor:
                        bookingMode === option.value
                          ? colors.brand
                          : colors.border,
                      color:
                        bookingMode === option.value
                          ? colors.brand
                          : colors.textPrimary,
                      cursor: "pointer",
                      fontWeight: 800,
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
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
                    setFieldErrors((current) => ({
                      ...current,
                      member: undefined,
                    }));
                    setSubmitError("");
                  }}
                  onSearchChange={setMemberSearch}
                  options={filteredCoachMemberOptions}
                  placeholder="Search members"
                  searchValue={memberSearch}
                  selectedValue={memberId}
                />
                {fieldErrors.member ? (
                  <FitText excludeGlobalScale style={{ color: colors.danger, fontSize: 11 }}>
                    {fieldErrors.member}
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
                    setFieldErrors((current) => ({
                      ...current,
                      coach: undefined,
                      monthlyOffer: undefined,
                      slot: undefined,
                    }));
                    setSubmitError("");
                  }}
                  onSearchChange={setCoachSearch}
                  options={filteredCoachOptions}
                  placeholder="Search coaches"
                  searchValue={coachSearch}
                  selectedValue={coachId}
                />
                {fieldErrors.coach ? (
                  <FitText excludeGlobalScale style={{ color: colors.danger, fontSize: 11 }}>
                    {fieldErrors.coach}
                  </FitText>
                ) : null}
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
                  {bookingMode === "monthly" ? "Start date" : "Date"}
                </FitText>
                <FitButton
                  variant="ghost"
                  label={date ? formatCompactDate(date) : "Select date"}
                  aria-label={`Manual coach booking ${bookingMode === "monthly" ? "start " : ""}date: ${
                    date ? formatCompactDate(date) : "Select date"
                  }`}
                  onClick={() => setDatePickerOpen(true)}
                  style={{
                    ...inputStyle,
                    justifyContent: "flex-start",
                    minHeight: 46,
                    width: "100%",
                    borderColor:
                      bookingMode === "monthly" || slotOptions.length > 0
                        ? colors.success
                        : colors.border,
                  }}
                  textStyle={{ fontSize: 13, fontWeight: 700 }}
                />
                {fieldErrors.date ? (
                  <FitText excludeGlobalScale style={{ color: colors.danger, fontSize: 11 }}>
                    {fieldErrors.date}
                  </FitText>
                ) : null}
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 11,
                    color:
                      slotOptions.length > 0
                        ? colors.success
                        : colors.textMuted,
                  }}
                >
                  {bookingMode === "monthly"
                    ? "Choose when the fully paid monthly package starts. Session dates are allocated separately."
                    : canonicalAvailabilityLoading
                    ? "Checking exact live availability..."
                    : slotOptions.length > 0
                      ? `${slotOptions.length} exact ${durationMinutes}-minute slot${slotOptions.length === 1 ? "" : "s"} on this date.`
                      : coachId
                        ? `No exact ${durationMinutes}-minute slots are available on this date.`
                        : "Select a coach to check availability."}
                </FitText>
              </div>
              {bookingMode === "single" ? <div style={{ display: "grid", gap: 6, gridColumn: "span 2" }}>
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: colors.textMuted,
                  }}
                >
                  Session duration
                </FitText>
                <div
                  role="radiogroup"
                  aria-label="Coach session duration"
                  style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 7 }}
                >
                  {STAFF_COACH_SESSION_DURATIONS.map((duration) => (
                    <FitButton
                      active={durationMinutes === duration}
                      aria-checked={durationMinutes === duration}
                      key={duration}
                      label={formatDurationLabel(duration)}
                      onClick={() => {
                        setDurationMinutes(duration);
                        setSlotValue("");
                        setFieldErrors((current) => ({ ...current, slot: undefined }));
                        setSubmitError("");
                      }}
                      role="radio"
                      style={{ minHeight: 40 }}
                      textStyle={{ fontSize: 11, fontWeight: 800 }}
                      variant="chip"
                    />
                  ))}
                </div>
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
                  onChange={(event) => {
                    setSlotValue(event.target.value);
                    setFieldErrors((current) => ({ ...current, slot: undefined }));
                    setSubmitError("");
                  }}
                  options={slotOptions.map((slot) => ({
                    label: slot.label,
                    value: slot.value,
                  }))}
                  placeholder={
                    canonicalAvailabilityLoading
                      ? "Loading slots"
                      : "No slots found"
                  }
                  compact
                  fullWidth
                />
                {canonicalAvailabilityError ? (
                  <FitText excludeGlobalScale style={{ color: colors.danger, fontSize: 11 }}>
                    Unable to load exact live coach availability. Try again.
                  </FitText>
                ) : fieldErrors.slot ? (
                  <FitText excludeGlobalScale style={{ color: colors.danger, fontSize: 11 }}>
                    {fieldErrors.slot}
                  </FitText>
                ) : null}
              </div> : (
                <div style={{ display: "grid", gap: 8, gridColumn: "span 2" }}>
                  <FitText excludeGlobalScale style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}>
                    Monthly offer
                  </FitText>
                  <FitText excludeGlobalScale style={{ fontSize: 12, color: monthlyOfferReady ? colors.textPrimary : colors.danger, lineHeight: 1.5 }}>
                    {monthlyOfferReady
                      ? `${selectedCoachOption?.monthlySessionCount} sessions / ${selectedCoachOption?.monthlySessionDurationMinutes} minutes each / ${formatPeso(Number(selectedCoachOption?.monthlyRate ?? 0))} full cash`
                      : "This coach does not have an active monthly offer."}
                  </FitText>
                  {selectedCoachOption?.monthlyOfferDescription ? (
                    <FitText excludeGlobalScale style={{ fontSize: 11, color: colors.textMuted }}>
                      {selectedCoachOption.monthlyOfferDescription}
                    </FitText>
                  ) : null}
                  {fieldErrors.monthlyOffer ? (
                    <FitText excludeGlobalScale style={{ color: colors.danger, fontSize: 11 }}>
                      {fieldErrors.monthlyOffer}
                    </FitText>
                  ) : null}
                </div>
              )}
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
                {bookingMode === "monthly"
                  ? monthlyOfferReady
                    ? "The atomic cash enrollment activates the monthly entitlement immediately. Appointment dates remain independent."
                    : "Select a coach with a configured monthly offer."
                  : canonicalAvailabilityLoading
                  ? "Loading exact live coach availability."
                  : slotOptions.length > 0
                    ? `${slotOptions.length} live slot${slotOptions.length === 1 ? "" : "s"} available on the selected date.`
                    : "No live coach slots are available on the selected date."}
              </FitText>
              {bookingMode === "single" && selectedSlot ? (
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
              items={bookingMode === "monthly" ? [
                {
                  helper: "Published coach offer",
                  label: "Monthly price",
                  value: formatPeso(Number(selectedCoachOption?.monthlyRate ?? 0)),
                  valueColor: colors.brand,
                },
                {
                  helper: monthlyPaidPeriod
                    ? `${formatCompactDate(monthlyPaidPeriod.startDate)} to ${formatCompactDate(monthlyPaidPeriod.endDate)}`
                    : "One paid month",
                  label: "Session allowance",
                  value: `${selectedCoachOption?.monthlySessionCount ?? 0} sessions`,
                },
                {
                  helper: "Each allocated session",
                  label: "Session duration",
                  value: `${selectedCoachOption?.monthlySessionDurationMinutes ?? 0} min`,
                },
              ] : [
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
                  helper: "Full cash amount recorded",
                  label: "Revenue recorded",
                  value: formatPeso(estimatedCoachTotal),
                  valueColor: colors.brand,
                },
              ]}
            />

            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, color: colors.textMuted }}
            >
              {bookingMode === "monthly"
                ? "Front-desk cash is recorded once for the full package. The paid entitlement activates immediately with no approval or later collection."
                : "Front-desk cash is recorded once for the full session. The appointment is confirmed immediately with no approval or later collection."}
            </FitText>

            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                {bookingMode === "monthly" ? "Cash reference (optional)" : "Session note"}
              </FitText>
              {bookingMode === "monthly" ? (
                <FitTextInput
                  id="manual-coach-booking-cash-reference"
                  name="manualCoachBookingCashReference"
                  aria-label="Monthly coaching cash reference"
                  value={referenceNo}
                  onChange={(event) => {
                    setReferenceNo(event.target.value);
                    setSubmitError("");
                  }}
                  placeholder="Receipt or audit reference"
                  style={inputStyle}
                />
              ) : <FitTextArea
                id="manual-coach-booking-note"
                name="manualCoachBookingNote"
                aria-label="Manual coach booking session note"
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                  setSubmitError("");
                }}
                rows={3}
                placeholder="Optional handoff note for the coach or front desk..."
                style={textAreaStyle}
              />}
            </div>
            {submitError ? (
              <FitText
                aria-live="polite"
                excludeGlobalScale
                style={{ color: colors.danger, fontSize: 12 }}
              >
                {submitError}
              </FitText>
            ) : null}
          </div>

          <CalendarModal
            highlightedDates={highlightedCoachDates}
            isOpen={datePickerOpen}
            minDate={getDefaultDateInput()}
            selectedDate={date}
            onClose={() => setDatePickerOpen(false)}
            onSelect={(nextDate) => {
              setDate(nextDate);
              setSlotValue("");
              setFieldErrors((current) => ({
                ...current,
                date: undefined,
                slot: undefined,
              }));
              setSubmitError("");
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
  onCreate: (payload: CreateCoachModalPayload) => void;
}) {
  const { colors, settings } = useTheme();
  const [displayName, setDisplayName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [password, setPassword] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [certifications, setCertifications] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [scheduleType, setScheduleType] = useState<"full_time" | "part_time">(
    "part_time",
  );
  const [isAvailableForBooking, setIsAvailableForBooking] = useState("active");
  const [bio, setBio] = useState("");
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
    setPassword(createTemporaryCoachPassword());
    setSpecialties("");
    setCertifications("");
    setHourlyRate("");
    setScheduleType("part_time");
    setIsAvailableForBooking("active");
    setBio("");
    setCreateConfirm(null);
  }, [isOpen]);

  const specialtiesList = useMemo(
    () => splitListInput(specialties),
    [specialties],
  );
  const form = useMemo<CreateCoachModalForm>(
    () => ({
      bio,
      certifications,
      contactEmail,
      contactPhone,
      displayName,
      hourlyRate,
      isAvailableForBooking,
      password,
      scheduleType,
      specialties,
    }),
    [
      bio,
      certifications,
      contactEmail,
      contactPhone,
      displayName,
      hourlyRate,
      isAvailableForBooking,
      password,
      scheduleType,
      specialties,
    ],
  );
  const validation = useMemo(() => validateCreateCoachForm(form), [form]);
  const { errors } = validation;
  const canSubmit = Boolean(validation.payload) && !isSubmitting;

  const submitCoach = (payload: CreateCoachModalPayload) => {
    if (isSubmitting) return;
    onCreate(payload);
  };

  const handleCreate = () => {
    const payload = validation.payload;
    if (isSubmitting || !payload) return;

    setCreateConfirm({
      confirmLabel: "CREATE COACH",
      message:
        "Create this coach account and profile now? It will start as Not Verified.",
      onConfirm: () => submitCoach(payload),
      title: "Confirm coach account",
    });
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setCreateConfirm(null);
    onClose();
  };

  return (
    <>
      <OverlayFrame
        isOpen={isOpen}
        onClose={handleClose}
        closeDisabled={isSubmitting}
        title="Create coach"
        subtitle="Create a coach-role account and profile for Gym Operations."
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
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
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
                  type="text"
                  inputMode="decimal"
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
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
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
                <div
                  style={{
                    ...inputStyle,
                    alignItems: "center",
                    display: "flex",
                    gap: 8,
                  }}
                >
                  <FitText
                    as="span"
                    excludeGlobalScale
                    aria-hidden="true"
                    style={{ color: colors.textMuted, fontSize: 13, fontWeight: 800 }}
                  >
                    +63
                  </FitText>
                  <FitTextInput
                    id="coach-create-phone"
                    type="tel"
                    inputMode="numeric"
                    value={contactPhone}
                    onChange={(event) => setContactPhone(event.target.value)}
                    placeholder="9171234567"
                    aria-label="Coach account phone digits"
                    style={{
                      backgroundColor: "transparent",
                      border: 0,
                      minHeight: 0,
                      padding: 0,
                    }}
                  />
                </div>
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

            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Temporary password
              </FitText>
              <FitTextInput
                type="text"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Generated temporary password"
                style={inputStyle}
              />
              {errors.password ? (
                <FitText
                  excludeGlobalScale
                  style={{ fontSize: 11, color: colors.danger }}
                >
                  {errors.password}
                </FitText>
              ) : null}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
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
                  Specialties
                </FitText>
                <CoachSpecialtyPicker
                  ariaLabel="Coach specialties"
                  disabled={isSubmitting}
                  id="create-coach-specialties"
                  onChange={(values) => setSpecialties(values.join(", "))}
                  value={specialtiesList}
                />
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
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
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
                {errors.scheduleType ? (
                  <FitText
                    excludeGlobalScale
                    style={{ fontSize: 11, color: colors.danger }}
                  >
                    {errors.scheduleType}
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
                {errors.isAvailableForBooking ? (
                  <FitText
                    excludeGlobalScale
                    style={{ fontSize: 11, color: colors.danger }}
                  >
                    {errors.isAvailableForBooking}
                  </FitText>
                ) : null}
              </div>
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
        title={createConfirm?.title ?? "Confirm coach account"}
        message={createConfirm?.message ?? ""}
        confirmLabel={createConfirm?.confirmLabel ?? "CREATE COACH"}
        loadingLabel={createConfirm?.confirmLabel ?? "CREATE COACH"}
        isDanger={createConfirm?.isDanger}
        isLoading={isSubmitting}
        onConfirm={() => {
          if (isSubmitting) return;
          const nextAction = createConfirm?.onConfirm;
          setCreateConfirm(null);
          nextAction?.();
        }}
        onCancel={() => setCreateConfirm(null)}
      />
    </>
  );
}
