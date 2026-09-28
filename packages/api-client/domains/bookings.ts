import type { ApiTransport } from "../transport/createAxiosTransport";
import type { PaginatedResult } from "@fittrack/types";
import {
  unwrapPaginatedResponse,
  unwrapResponse,
  unwrapVoidResponse,
} from "../request";
import { resolveAmenityId } from "./venue-compat";
import {
  mapCommerceCheckoutAttempt,
  type CommerceCheckoutApiRecord,
  type CommerceCheckoutAttempt,
  type CommerceCheckoutReturnInput,
} from "./commerce-checkout";
import {
  BOOKING_HISTORY_PAGE_LIMIT,
  collectBookingHistory,
} from "./booking-history-pagination";

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

export type VenueBookingRecord = {
  cancelReason?: string | null;
  cancelledAt?: string | null;
  coach?: BookingCoachSummary | null;
  coachId?: string | null;
  createdAt?: string;
  durationHours: number;
  endTime: string;
  id: string;
  productKind?: "venue_coach_addon";
  purpose?: string | null;
  startTime: string;
  status?: string;
  totalAmount?: number | null;
  coachAmount?: number | null;
  user?: BookingUserSummary | null;
  userId?: string;
  venue?: BookingVenueSummary | null;
  venueAmount?: number | null;
  venueId: string | number;
};

export type AmenityBookingApiRecord = {
  amenity?: {
    capacity?: number | null;
    hourly_rate?: number | string | null;
    id?: string;
    name?: string | null;
  } | null;
  amenity_id?: string;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
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
  ends_at: string;
  id: string;
  notes?: string | null;
  product_kind?: "venue_coach_addon";
  starts_at: string;
  status?: string;
  total_amount?: number | string | null;
  coach_amount?: number | string | null;
  venue_amount?: number | string | null;
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

export type CreateBookingPayload = CommerceCheckoutReturnInput & {
  coachId?: string;
  durationHours: number;
  idempotencyKey?: string;
  paymentStage?: "full";
  purpose?: string;
  provider?: "paymongo";
  startTime: string;
  venueId: string | number;
};

export type BookingCheckoutApiResponse = CommerceCheckoutApiRecord & {
  booking_id?: string | null;
  checkout_url?: string | null;
  payment_id?: string | null;
  status: string;
};

export type LegacyBookingCheckoutResponse = {
  bookingId: string;
  checkoutUrl: string | null;
  paymentId: string | null;
  status: string;
};

export type BookingCheckoutResponse =
  | CommerceCheckoutAttempt
  | LegacyBookingCheckoutResponse;

export type VenueBookingListParams = {
  endDate?: string;
  limit?: number;
  page?: number;
  startDate?: string;
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

export function toVenueBookingListParams(params?: VenueBookingListParams) {
  if (!params) return undefined;

  return {
    ...(params.page !== undefined ? { page: params.page } : {}),
    ...(params.limit !== undefined ? { limit: params.limit } : {}),
    ...(params.startDate ? { start_date: params.startDate } : {}),
    ...(params.endDate ? { end_date: params.endDate } : {}),
  };
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

export function mapBookingCheckoutResponse(
  record: BookingCheckoutApiResponse,
): BookingCheckoutResponse {
  if (record.hold_id && record.expires_at && record.kind) {
    return mapCommerceCheckoutAttempt(record);
  }

  return {
    bookingId: record.booking_id ?? "",
    checkoutUrl: record.checkout_url ?? null,
    paymentId: record.payment_id ?? null,
    status: record.status,
  };
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

  return {
    totalAmount,
    coachAmount: toAmountNumber(record.coach_amount),
    productKind: record.product_kind,
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
    cancelReason: record.cancellation_reason ?? null,
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
    venueAmount: toAmountNumber(record.venue_amount),
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
    listMineAll<T>(signal?: AbortSignal) {
      return collectBookingHistory(
        (page, _limit, requestSignal) =>
          unwrapPaginatedResponse<AmenityBookingApiRecord>(
            transport.get("/bookings/amenity/my", {
              params: { limit: BOOKING_HISTORY_PAGE_LIMIT, page },
              signal: requestSignal,
            }),
            "Unable to load bookings.",
          ),
        mapAmenityBookingToVenueBookingRecord,
        signal,
      ) as Promise<T[]>;
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

      return unwrapResponse<BookingCheckoutApiResponse>(
        transport.post(
          "/bookings/amenity",
      {
        amenity_id: amenityId,
        coach_id: payload.coachId,
        ends_at: endsAt.toISOString(),
        ...(payload.returnTarget
          ? { return_target: payload.returnTarget }
          : {}),
        ...(payload.returnUrl ? { return_url: payload.returnUrl } : {}),
        notes: payload.purpose,
        payment_stage: payload.paymentStage ?? "full",
        provider: payload.provider ?? "paymongo",
        starts_at: startsAt.toISOString(),
      },
          {
            headers: {
              "Idempotency-Key":
                payload.idempotencyKey ?? createIdempotencyKey(),
            },
          },
        ),
        "Unable to create booking.",
      ).then(mapBookingCheckoutResponse);
    },
    cancel(bookingId: string, cancelReason: string) {
      return unwrapVoidResponse(
        transport.patch(`/bookings/amenity/${bookingId}/cancel`, {
          cancelReason,
        }),
        "Unable to cancel booking.",
      );
    },
    async listCoachWork(
      params?: VenueBookingListParams,
    ): Promise<PaginatedResult<VenueBookingRecord>> {
      const result = await unwrapPaginatedResponse<AmenityBookingApiRecord>(
        transport.get("/bookings/coach-work", {
          params: toVenueBookingListParams(params),
        }),
        "Unable to load assigned venue coaching work.",
      );
      return {
        data: result.data.map(mapAmenityBookingToVenueBookingRecord),
        meta: result.meta,
      };
    },
    completeCoachWork(bookingId: string) {
      return unwrapVoidResponse(
        transport.patch(`/bookings/coach-work/${bookingId}/complete`),
        "Unable to mark assigned venue coaching work complete.",
      );
    },
    cancelCoachWork(bookingId: string, reason?: string) {
      return unwrapVoidResponse(
        transport.patch(`/bookings/coach-work/${bookingId}/cancel`, {
          reason,
        }),
        "Unable to cancel assigned venue coaching work.",
      );
    },
    noShowCoachWork(bookingId: string) {
      return unwrapVoidResponse(
        transport.patch(`/bookings/coach-work/${bookingId}/no-show`),
        "Unable to mark assigned venue coaching work as no-show.",
      );
    },
  };
}
