import type { AxiosInstance } from "axios";
import { createAuthApi } from "./domains/auth";
import { createUsersApi } from "./domains/users";
import { createVenuesApi } from "./domains/venues";
import { createBookingsApi } from "./domains/bookings";
import { createAppointmentsApi } from "./domains/appointments";
import { createCoachesApi } from "./domains/coaches";
import { createAdminApi } from "./domains/admin";
import { createStaffApi } from "./domains/staff";
import { resolveApiBaseUrl } from "./base-url";
import { createAxiosTransport, type ApiTransportConfig } from "./transport/createAxiosTransport";

export type { AuthEvents } from "./auth/auth-events";
export { createTokenStore } from "./auth/createTokenStore";
export type { KeyValueStorageAdapter } from "./auth/createTokenStore";
export type { Awaitable, TokenSet, TokenStore } from "./auth/token-store";
export { ApiClientError, toApiClientError } from "./errors/api-client-error";
export type { ApiClientErrorKind } from "./errors/api-client-error";
export { resolveApiBaseUrl } from "./base-url";
export { createAxiosTransport } from "./transport/createAxiosTransport";
export type { ApiTransport, ApiTransportConfig } from "./transport/createAxiosTransport";
export type {
  ChangePasswordPayload,
  ForgotPasswordPayload,
  LoginCredentials,
  LoginOtpResponse,
  LoginSuccessResponse,
  LoginUserResponse,
  LogoutPayload,
  RegisterPayload,
  RegisterResponse,
  ResetPasswordPayload,
  VerifyEmailPayload
} from "./domains/auth";
export type { AppointmentRecord, CoachScheduleRecord, CreateAppointmentPayload } from "./domains/appointments";
export type { CreateBookingPayload, VenueBookingRecord } from "./domains/bookings";
export type { CoachAvailabilityResponse, CoachAvailabilitySlot, UpdateCoachProfilePayload, UpsertCoachAvailabilityPayload } from "./domains/coaches";
export type { UpdateUserAccountPayload, UpdateUserProfilePayload, UserProfileResponse } from "./domains/users";
export type { VenueAvailabilityRecord, VenueMutationPayload } from "./domains/venues";
export type { ReviewDeletionPayload, UpgradeToCoachPayload } from "./domains/admin";

type CreateApiClientConfig = (Omit<ApiTransportConfig, "baseURL"> & {
  baseURL?: string | null;
  fallbackBaseURL?: string;
}) | {
  transport: AxiosInstance;
};

export function createApiClient(config: CreateApiClientConfig) {
  const transport = "transport" in config
    ? config.transport
    : createAxiosTransport({
        ...config,
        baseURL: resolveApiBaseUrl(config.baseURL, config.fallbackBaseURL)
      });

  return {
    transport,
    auth: createAuthApi(transport),
    users: createUsersApi(transport),
    venues: createVenuesApi(transport),
    bookings: createBookingsApi(transport),
    appointments: createAppointmentsApi(transport),
    coaches: createCoachesApi(transport),
    admin: createAdminApi(transport),
    staff: createStaffApi(transport)
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
