import type { ApiTransport } from "../transport/createAxiosTransport";
import { unwrapResponse, unwrapVoidResponse } from "../request";
import { resolveAmenityId } from "./venue-compat";

export type BookingVenueSummary = {
  capacity?: number | null;
  hourlyRate?: number | null;
  id: string | number;
  name: string;
};

export type BookingUserSummary = {
  email?: string | null;
  id: string;
  phone_no?: string | null;
  profile?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

export type BookingCoachSummary = {
  bio?: string | null;
  certifications?: string[];
  contactEmail?: string | null;
  displayName?: string | null;
  hourlyRate?: number | null;
  id: string;
  isAvailableForBooking?: boolean;
  specialties?: string[];
  user?: BookingUserSummary | null;
};

export type BookingPaymentStage = "downpayment" | "full";
export type BookingPaymentPlan = "downpayment" | "free" | "full";

export type VenueBookingRecord = {
  amountDueNow?: number | null;
  balancePaidAt?: string | null;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  coach?: BookingCoachSummary | null;
  coachId?: string | null;
  createdAt?: string;
  downpaymentPaidAt?: string | null;
  durationHours: number;
  endTime: string;
  id: string;
  nextPaymentDate?: string | null;
  paymentPlan?: BookingPaymentPlan;
  purpose?: string | null;
  remainingBalance?: number | null;
  startTime: string;
  status?: string;
  totalAmount?: number | null;
  user?: BookingUserSummary | null;
  userId?: string;
  venue?: BookingVenueSummary | null;
  venueId: string | number;
};

type AmenityBookingApiRecord = {
  amenity?: {
    capacity?: number | null;
    hourly_rate?: number | string | null;
    id?: string;
    name?: string | null;
  } | null;
  amenity_id?: string;
  cancelled_at?: string | null;
  coach?: {
    bio?: string | null;
    certification?: string | null;
    contact_email?: string | null;
    display_name?: string | null;
    hourly_rate?: number | string | null;
    id?: string;
    is_available_for_booking?: boolean | null;
    specialization?: string | null;
    user?: {
      email?: string | null;
      id?: string;
      profile?: {
        firstName?: string | null;
        first_name?: string | null;
        lastName?: string | null;
        last_name?: string | null;
      } | null;
    } | null;
  } | null;
  coach_id?: string | null;
  created_at?: string;
  downpayment_amount?: number | string | null;
  downpayment_paid_at?: string | null;
  balance_amount?: number | string | null;
  balance_paid_at?: string | null;
  ends_at: string;
  id: string;
  notes?: string | null;
  starts_at: string;
  status?: string;
  total_amount?: number | string | null;
  user?: {
    email?: string | null;
    id?: string;
    profile?: {
      firstName?: string | null;
      first_name?: string | null;
      lastName?: string | null;
      last_name?: string | null;
    } | null;
  } | null;
  user_id?: string;
};

export type CreateBookingPayload = {
  coachId?: string;
  durationHours: number;
  paymentStage?: BookingPaymentStage;
  purpose?: string;
  provider?: "cash" | "paymongo";
  startTime: string;
  venueId: string | number;
};

type BookingCheckoutResponse = {
  booking_id: string;
  checkout_url?: string | null;
  payment_id?: string | null;
  status: string;
};

export type BookingBalancePaymentProvider = "cash" | "paymongo";
export type BookingBalanceCheckoutResponse = {
  bookingId: string;
  checkoutUrl: string | null;
  paymentId?: string | null;
  status: string;
};

function legacyVenueIdFromAmenityName(name?: string | null) {
  const normalized = (name ?? "").trim().toLowerCase();
  if (normalized.includes("basketball")) return -103;
  if (normalized.includes("volleyball")) return -104;
  if (normalized.includes("boxing")) return -201;
  if (normalized.includes("yoga")) return -301;
  if (normalized.includes("reception")) return -101;
  if (normalized.includes("gym")) return -102;
  return -900;
}

function toLegacyVenueStatus(status?: string) {
  switch ((status ?? "").toLowerCase()) {
    case "confirmed":
      return "confirmed" as const;
    case "balance_pending":
      return "balance_pending" as const;
    case "completed":
      return "completed" as const;
    case "cancelled":
      return "cancelled" as const;
    case "no_show":
      return "no_show" as const;
    case "pending":
    default:
      return "pending" as const;
  }
}

function toHourlyRate(value?: number | string | null) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toAmountNumber(value?: number | string | null) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function createIdempotencyKey() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

function splitMultiValue(value?: string | null) {
  return (value ?? "")
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function normalizeCoachDisplayName(value?: string | null) {
  const displayName = value?.trim();
  if (displayName && !displayName.includes("@")) {
    return displayName;
  }

  return null;
}

function isLegacySeedIdentityEmail(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return Boolean(
    normalized &&
    (normalized.startsWith("seed.member") ||
      normalized.startsWith("seed.staff") ||
      normalized.startsWith("seed.admin")),
  );
}

function mapProfileSummary(
  profile?: {
    firstName?: string | null;
    first_name?: string | null;
    lastName?: string | null;
    last_name?: string | null;
  } | null,
) {
  return {
    firstName: profile?.firstName ?? profile?.first_name ?? null,
    lastName: profile?.lastName ?? profile?.last_name ?? null,
  };
}

export function mapAmenityBookingToVenueBookingRecord(
  record: AmenityBookingApiRecord,
): VenueBookingRecord {
  const startTime = new Date(record.starts_at);
  const endTime = new Date(record.ends_at);
  const durationHours = Math.max(
    0,
    Math.round(((endTime.getTime() - startTime.getTime()) / 3_600_000) * 100) /
      100,
  );
  const venueName = record.amenity?.name?.trim() || "Amenity";
  const venueId =
    record.amenity?.id ??
    record.amenity_id ??
    legacyVenueIdFromAmenityName(venueName);
  const totalAmount = toAmountNumber(record.total_amount);
  const downpaymentAmount = toAmountNumber(record.downpayment_amount);
  const balanceAmount = toAmountNumber(record.balance_amount);
  const balancePaidAt = record.balance_paid_at ?? null;
  const downpaymentPaidAt = record.downpayment_paid_at ?? null;
  const remainingBalance = balancePaidAt ? 0 : balanceAmount;
  const amountDueNow =
    record.status === "pending"
      ? downpaymentAmount
      : remainingBalance && remainingBalance > 0
        ? remainingBalance
        : 0;
  const paymentPlan: BookingPaymentPlan =
    totalAmount == null || totalAmount <= 0
      ? "free"
      : balanceAmount && balanceAmount > 0
        ? "downpayment"
        : "full";

  return {
    totalAmount,
    amountDueNow,
    balancePaidAt,
    downpaymentPaidAt,
    remainingBalance,
    nextPaymentDate:
      remainingBalance && remainingBalance > 0 ? record.starts_at : null,
    paymentPlan,
    id: record.id,
    venueId,
    coachId: record.coach?.id ?? record.coach_id ?? null,
    startTime: record.starts_at,
    endTime: record.ends_at,
    durationHours,
    purpose: record.notes ?? null,
    status: toLegacyVenueStatus(record.status),
    createdAt: record.created_at,
    cancelledAt: record.cancelled_at ?? null,
    userId: record.user?.id ?? record.user_id,
    user: {
      id: record.user?.id ?? record.user_id ?? "",
      email: record.user?.email ?? null,
      profile: mapProfileSummary(record.user?.profile),
    },
    coach:
      record.coach?.id != null
        ? {
            id: record.coach.id,
            bio: record.coach.bio ?? null,
            certifications: splitMultiValue(record.coach.certification),
            contactEmail: isLegacySeedIdentityEmail(record.coach.contact_email)
              ? null
              : (record.coach.contact_email ?? null),
            displayName: normalizeCoachDisplayName(record.coach.display_name),
            hourlyRate: toHourlyRate(record.coach.hourly_rate),
            isAvailableForBooking:
              record.coach.is_available_for_booking ?? false,
            specialties: splitMultiValue(record.coach.specialization),
            user: null,
          }
        : null,
    venue: {
      id: venueId,
      name: venueName,
      capacity: record.amenity?.capacity ?? null,
      hourlyRate: toHourlyRate(record.amenity?.hourly_rate),
    },
  };
}

export function createBookingsApi(transport: ApiTransport) {
  return {
    listMine<T>() {
      return unwrapResponse<AmenityBookingApiRecord[]>(
        transport.get("/bookings/amenity/my"),
        "Unable to load bookings.",
      ).then(
        (data) =>
          data.map((record) =>
            mapAmenityBookingToVenueBookingRecord(record),
          ) as T[],
      );
    },
    create(payload: CreateBookingPayload) {
      const amenityId = resolveAmenityId(payload.venueId);
      if (!amenityId) {
        throw new Error(
          "This facility is not connected to a live reservation backend yet.",
        );
      }

      const startsAt = new Date(payload.startTime);
      const endsAt = new Date(
        startsAt.getTime() + payload.durationHours * 3_600_000,
      );

      return unwrapResponse<BookingCheckoutResponse>(
        transport.post(
          "/bookings/amenity",
          {
            amenity_id: amenityId,
            coach_id: payload.coachId,
            ends_at: endsAt.toISOString(),
            notes: payload.purpose,
            payment_stage: payload.paymentStage ?? "downpayment",
            provider: payload.provider ?? "paymongo",
            starts_at: startsAt.toISOString(),
          },
          {
            headers: {
              "Idempotency-Key": createIdempotencyKey(),
            },
          },
        ),
        "Unable to create booking.",
      );
    },
    cancel(bookingId: string, cancelReason: string) {
      return unwrapVoidResponse(
        transport.patch(`/bookings/amenity/${bookingId}/cancel`, {
          cancelReason,
        }),
        "Unable to cancel booking.",
      );
    },
    processBalance(
      bookingId: string,
      payload: {
        provider: BookingBalancePaymentProvider;
        referenceNo?: string;
        screenshotUrl?: string;
      },
    ) {
      return unwrapResponse<BookingCheckoutResponse>(
        transport.post(`/bookings/amenity/${bookingId}/balance`, {
          provider: payload.provider,
          ...(payload.referenceNo ? { reference_no: payload.referenceNo } : {}),
          ...(payload.screenshotUrl
            ? { screenshot_url: payload.screenshotUrl }
            : {}),
        }),
        "Unable to collect booking balance.",
      ).then(
        (record): BookingBalanceCheckoutResponse => ({
          bookingId: record.booking_id,
          checkoutUrl: record.checkout_url ?? null,
          paymentId: record.payment_id ?? null,
          status: record.status,
        }),
      );
    },
  };
}
