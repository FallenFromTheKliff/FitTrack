import type { MemberProfile, MembershipCardRecord } from "@fittrack/types";
import type { ApiTransport } from "../transport/createAxiosTransport";
import { unwrapResponse, unwrapVoidResponse } from "../request";

export type LoginCredentials = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  phone?: string;
};

export type LogoutPayload = {
  refresh_token: string;
};

export type ChangePasswordPayload = {
  current_password: string;
  new_password: string;
};

export type VerifyEmailPayload = {
  user_id: string;
  code: string;
};

export type ForgotPasswordPayload = {
  email: string;
};

export type VerifyCurrentPasswordPayload = {
  current_password: string;
};

export type VerifyResetOtpPayload = {
  code: string;
  email: string;
};

export type ResetPasswordPayload = {
  code: string;
  email: string;
  new_password: string;
};

export type ResendOtpPayload = {
  user_id: string;
};

export type LoginUserResponse = {
  email?: string;
  email_verified_at?: string | null;
  emailVerified?: boolean;
  id: string;
  membership_card?: MembershipCardRecord | null;
  membershipCard?: MembershipCardRecord | null;
  phone?: string | null;
  phone_no?: string | null;
  phone_verified_at?: string | null;
  phoneVerified?: boolean;
  profile?: (MemberProfile & {
    activity_level?: string | null;
    avatar_url?: string | null;
    date_of_birth?: string | null;
    fitness_goal?: string | null;
    first_name?: string | null;
    height_cm?: number | null;
    last_name?: string | null;
    membership_type?: string | null;
    phone?: string | null;
    weight_kg?: number | null;
  }) | null;
  qr_code_token?: string | null;
  qrCodeReady?: boolean;
  attendanceQrReady?: boolean;
  qrCodeToken?: string | null;
  role: string;
  status?: string;
};

export type LoginSuccessResponse = {
  access_token: string;
  refresh_token?: string;
  user: LoginUserResponse;
};

export type LoginOtpResponse = {
  otpRequired?: boolean;
};

export type RegisterResponse = {
  user_id?: string;
};

export function createAuthApi(transport: ApiTransport) {
  return {
    login(credentials: LoginCredentials) {
      return unwrapResponse<LoginSuccessResponse | LoginOtpResponse>(
        transport.post("/auth/login", credentials),
        "Login failed."
      );
    },
    register(payload: RegisterPayload) {
      return unwrapResponse<RegisterResponse>(
        transport.post("/auth/register", payload),
        "Registration failed."
      );
    },
    logout(payload: LogoutPayload) {
      return unwrapVoidResponse(
        transport.post("/auth/logout", payload),
        "Logout failed."
      );
    },
    verifyCurrentPassword(currentPassword: string) {
      return unwrapResponse<{ verified?: boolean }>(
        transport.post(
          "/auth/verify-current-password",
          { current_password: currentPassword },
          { _preserveSessionOn401: true }
        ),
        "Password verification failed."
      );
    },
    changePassword(payload: ChangePasswordPayload) {
      return unwrapVoidResponse(
        transport.post("/auth/change-password", payload),
        "Password change failed."
      );
    },
    verifyEmail(payload: VerifyEmailPayload) {
      return unwrapResponse<LoginSuccessResponse>(
        transport.post("/auth/verify-email", payload),
        "Email verification failed."
      );
    },
    resendOtp(payload: ResendOtpPayload) {
      return unwrapResponse<{ message?: string }>(
        transport.post("/auth/resend-otp", payload),
        "Unable to resend verification code."
      );
    },
    forgotPassword(payload: ForgotPasswordPayload) {
      return unwrapResponse<{ message?: string }>(
        transport.post("/auth/forgot-password", payload),
        "Unable to send verification code."
      );
    },
    verifyResetOtp(payload: VerifyResetOtpPayload) {
      return unwrapResponse<{ verified?: boolean }>(
        transport.post("/auth/verify-reset-otp", payload),
        "Unable to verify reset code."
      );
    },
    resetPassword(payload: ResetPasswordPayload) {
      return unwrapResponse<{ message?: string }>(
        transport.post("/auth/reset-password", payload),
        "Unable to reset password."
      );
    }
  };
}
