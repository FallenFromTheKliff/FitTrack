import type { ApiTransport } from "../transport/createAxiosTransport";
import { unwrapPaginatedResponse, unwrapResponse } from "../request";

export type GymKnowledgePaginationParams = {
  limit?: number;
  page?: number;
};

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

export type GymPromotionRecord = {
  created_at: string;
  description: string;
  ends_at: string;
  id: string;
  is_active: boolean;
  pricing_note: string | null;
  promo_code: string | null;
  starts_at: string;
  title: string;
  updated_at: string;
};

export type CreateGymPromotionInput = {
  description: string;
  endsAt: string;
  pricingNote?: string;
  promoCode?: string;
  startsAt: string;
  title: string;
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

function toPromotionCreateRequest(payload: CreateGymPromotionInput) {
  return {
    description: payload.description,
    ends_at: payload.endsAt,
    ...(payload.pricingNote ? { pricing_note: payload.pricingNote } : {}),
    ...(payload.promoCode ? { promo_code: payload.promoCode } : {}),
    starts_at: payload.startsAt,
    title: payload.title,
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
    listPromotions(params?: GymKnowledgePaginationParams) {
      return unwrapPaginatedResponse<GymPromotionRecord>(
        transport.get("/gym-chat/knowledge/promotions", { params }),
        "Unable to load gym promotions.",
      );
    },
    createPromotion(payload: CreateGymPromotionInput) {
      return unwrapResponse<GymPromotionRecord>(
        transport.post(
          "/gym-chat/knowledge/promotions",
          toPromotionCreateRequest(payload),
        ),
        "Unable to create gym promotion.",
      );
    },
    deactivatePromotion(promotionId: string) {
      return unwrapResponse<GymPromotionRecord>(
        transport.patch(
          `/gym-chat/knowledge/promotions/${promotionId}/deactivate`,
          {},
        ),
        "Unable to deactivate gym promotion.",
      );
    },
  };
}
