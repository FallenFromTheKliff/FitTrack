import type { ApiTransport } from "../transport/createAxiosTransport";
import { unwrapResponse } from "../request";

export type GymProfileApiResponse = {
  closing_time: string;
  email: string;
  location: string;
  name: string;
  opening_time: string;
  phone: string;
};

export type GymProfileRecord = {
  closingTime: string;
  email: string;
  location: string;
  name: string;
  openingTime: string;
  phone: string;
};

export type UpdateGymProfileInput = {
  closingTime: string;
  email: string;
  location: string;
  name: string;
  openingTime: string;
  phone: string;
};

function normalizeGymProfileResponse(
  profile: GymProfileApiResponse,
): GymProfileRecord {
  return {
    closingTime: profile.closing_time,
    email: profile.email,
    location: profile.location,
    name: profile.name,
    openingTime: profile.opening_time,
    phone: profile.phone,
  };
}

function toGymProfileUpdateRequest(payload: UpdateGymProfileInput) {
  return {
    closing_time: payload.closingTime,
    email: payload.email,
    location: payload.location,
    name: payload.name,
    opening_time: payload.openingTime,
    phone: payload.phone,
  };
}

export function createGymKnowledgeApi(transport: ApiTransport) {
  return {
    getProfile() {
      return unwrapResponse<GymProfileApiResponse>(
        transport.get("/gym-chat/knowledge/profile"),
        "Unable to load gym profile.",
      ).then(normalizeGymProfileResponse);
    },
    updateProfile(payload: UpdateGymProfileInput) {
      return unwrapResponse<GymProfileApiResponse>(
        transport.put(
          "/gym-chat/knowledge/profile",
          toGymProfileUpdateRequest(payload),
        ),
        "Unable to update gym profile.",
      ).then(normalizeGymProfileResponse);
    },
  };
}
