import type { MemberProfile, Role } from "@fittrack/types";
import type { ApiTransport } from "../transport/createAxiosTransport";
import { unwrapResponse, unwrapVoidResponse } from "../request";

export type UserProfileResponse = {
  deletedAt?: string | null;
  email: string;
  emailVerified?: boolean;
  id: string;
  phoneVerified?: boolean;
  phone_no?: string | null;
  profile?: MemberProfile | null;
  role?: {
    id?: number;
    name?: Role;
  } | null;
};

export type UpdateUserProfilePayload = {
  currentWeightKg?: number;
  dateOfBirth?: string;
  firstName?: string;
  heightCm?: number;
  lastName?: string;
};

export type UpdateUserAccountPayload = {
  email?: string;
  phone_no?: string;
};

export function createUsersApi(transport: ApiTransport) {
  return {
    getProfile() {
      return unwrapResponse<UserProfileResponse>(
        transport.get("/users/profile"),
        "Unable to load profile."
      );
    },
    getDeletionRequestStatus() {
      return unwrapResponse<{ status?: string | null }>(
        transport.get("/users/deletion-request"),
        "Unable to load deletion request status."
      );
    },
    updateProfile(payload: UpdateUserProfilePayload) {
      return unwrapVoidResponse(
        transport.patch("/users/profile", payload),
        "Unable to update profile."
      );
    },
    updateAccount(payload: UpdateUserAccountPayload) {
      return unwrapVoidResponse(
        transport.patch("/users/account", payload),
        "Unable to update account."
      );
    },
    requestDeletion(reason?: string) {
      return unwrapVoidResponse(
        transport.post("/users/request-deletion", reason ? { reason } : {}),
        "Unable to request account deletion."
      );
    },
    cancelDeletionRequest() {
      return unwrapVoidResponse(
        transport.delete("/users/deletion-request"),
        "Unable to cancel deletion request."
      );
    }
  };
}
