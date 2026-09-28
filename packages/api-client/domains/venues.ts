import type { ApiTransport } from "../transport/createAxiosTransport";
import { unwrapResponse, unwrapVoidResponse } from "../request";
import {
  mapAmenityAvailabilityToVenueAvailabilityRecord,
  mapAmenityToVenueRecord,
  mapVenueMutationPayloadToAmenityPayload,
  resolveAmenityId,
  type AmenityApiRecord
} from "./venue-compat";
import type { EquipmentStatus, VenueImageFit } from "@fittrack/types";

export type VenueMutationPayload = {
  capacity: number;
  description?: string;
  displayOrder: number;
  floorId: string;
  gridColumn: number;
  gridHeight: number;
  gridRow: number;
  gridWidth: number;
  hourlyRate?: number;
  iconKey: string;
  imageUrl?: string | null;
  imageUrls?: string[];
  imageFit?: VenueImageFit;
  imageFocalX?: number;
  imageFocalY?: number;
  imageCropZoom?: number;
  isMapped?: boolean;
  isReservable: boolean;
  minimumHours: number;
  name: string;
  status?: EquipmentStatus | null;
};

export type VenueAvailabilityRecord = {
  endTime: string;
  startTime: string;
  status: string;
};

export type SubmitVenueFeedbackPayload = {
  comment?: string;
  rating: number;
};

export type VenueFeedbackRecord = {
  amenity: {
    id: string;
    name: string;
    type: string;
  };
  comment?: string | null;
  created_at: string;
  id: string;
  rating: number;
  submitted_by: {
    id: string;
    name: string;
    role: string;
  };
  updated_at: string;
};

export type VenueFeedbackHistoryPage = {
  has_more: boolean;
  items: VenueFeedbackRecord[];
  average_rating: number | null;
  limit: number;
  page: number;
  total: number;
};

type AmenityAvailabilitySlotApiRecord = {
  available: boolean;
  ends_at: string;
  starts_at: string;
  status?: "available" | "full" | "unavailable" | string | null;
};

function requireAmenityId(value: string | number) {
  const amenityId = resolveAmenityId(value);
  if (!amenityId) {
    throw new Error("This facility is not connected to a live amenity record yet.");
  }
  return amenityId;
}

export function createVenuesApi(transport: ApiTransport) {
  return {
    listActive() {
      return unwrapResponse<AmenityApiRecord[]>(
        transport.get("/bookings/amenities"),
        "Unable to load venues."
      ).then((data) => data.map((record) => mapAmenityToVenueRecord(record)));
    },
    listOperational() {
      return unwrapResponse<AmenityApiRecord[]>(
        transport.get('/bookings/amenities/operations'),
        'Unable to load operational venues.',
      ).then((data) => data.map((record) => mapAmenityToVenueRecord(record)));
    },

    listReservableOperational() {
      return unwrapResponse<AmenityApiRecord[]>(
        transport.get("/bookings/amenities/operations/reservable"),
        "Unable to load reservable operational venues.",
      ).then((data) => data.map((record) => mapAmenityToVenueRecord(record)));
    },
    listArchived() {
      return unwrapResponse<AmenityApiRecord[]>(
        transport.get("/bookings/amenities/archived"),
        "Unable to load archived venues."
      ).then((data) => data.map((record) => mapAmenityToVenueRecord(record)));
    },
    async getAvailability<T>(venueId: string | number, date: string) {
      const amenityId = requireAmenityId(venueId);
      const data = await unwrapResponse<AmenityAvailabilitySlotApiRecord[]>(
        transport.get(`/bookings/amenities/availability?amenity_id=${amenityId}&date=${date}`),
        "Unable to load venue availability."
      );
      return data.map((record) => mapAmenityAvailabilityToVenueAvailabilityRecord(record)) as T[];
    },
    create(payload: VenueMutationPayload) {
      return unwrapVoidResponse(
        transport.post("/bookings/amenities", mapVenueMutationPayloadToAmenityPayload(payload)),
        "Unable to create venue."
      );
    },
    update(id: string | number, payload: VenueMutationPayload) {
      const amenityId = requireAmenityId(id);
      return unwrapVoidResponse(
        transport.patch(
          `/bookings/amenities/${amenityId}`,
          mapVenueMutationPayloadToAmenityPayload(payload)
        ),
        "Unable to update venue."
      );
    },
    delete(id: string | number) {
      const amenityId = requireAmenityId(id);
      return unwrapVoidResponse(
        transport.delete(`/bookings/amenities/${amenityId}`),
        "Unable to delete venue."
      );
    },
    async restore(id: string | number) {
      const amenityId = requireAmenityId(id);
      const restored = await unwrapResponse<AmenityApiRecord>(
        transport.patch(`/bookings/amenities/${amenityId}/restore`),
        "Unable to restore venue."
      );
      return mapAmenityToVenueRecord(restored);
    },
    submitFeedback(id: string | number, payload: SubmitVenueFeedbackPayload) {
      const amenityId = requireAmenityId(id);
      return unwrapVoidResponse(
        transport.post(`/bookings/amenities/${amenityId}/feedback`, payload),
        "Unable to submit venue feedback."
      );
    },
    listFeedback() {
      return unwrapResponse<VenueFeedbackRecord[]>(
        transport.get("/bookings/amenities/feedback"),
        "Unable to load venue feedback."
      );
    },
    listFeedbackHistoryForVenue(
      id: string | number,
      params?: { page?: number; limit?: number },
    ) {
      const amenityId = requireAmenityId(id);
      return unwrapResponse<VenueFeedbackHistoryPage>(
        transport.get(`/bookings/amenities/${amenityId}/feedback/history`, {
          params: {
            page: params?.page ?? 1,
            limit: params?.limit ?? 10,
          },
        }),
        "Unable to load venue feedback history."
      );
    },
    listFeedbackForVenue(id: string | number) {
      const amenityId = requireAmenityId(id);
      return unwrapResponse<VenueFeedbackRecord[]>(
        transport.get(`/bookings/amenities/${amenityId}/feedback`),
        "Unable to load venue feedback."
      );
    }
  };
}
