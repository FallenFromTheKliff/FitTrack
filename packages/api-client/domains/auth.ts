import type { MemberProfile } from "@fittrack/types";
import type { ApiTransport } from "../transport/createAxiosTransport";
import { unwrapResponse, unwrapVoidResponse } from "../request";

export type LoginCredentials = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  email: string;
  phone_no?: string;
  password: string;
};

export type LogoutPayload = {
  refresh_token: string;
};

export type ChangePasswordPayload = {
  email: string;
  password: string;
};

export type VerifyEmailPayload = {
  email: string;
  otp: string;
};

export type ForgotPasswordPayload = {
  email: string;
};

export type ResetPasswordPayload = {
  token: string;
  newPassword: string;
};

export type LoginUserResponse = {
  email: string;
  emailVerified?: boolean;
  id: string;
  phone_no?: string | null;
  phoneVerified?: boolean;
  profile?: MemberProfile | null;
  role: string;
};

export type LoginSuccessResponse = {
  access_token: string;
  refresh_token: string;
  user: LoginUserResponse;
};

export type LoginOtpResponse = {
  otpRequired?: boolean;
};

export type RegisterResponse = {
  email?: string;
  userId?: string;
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
        transport.post("/auth/verify-current-password", { currentPassword }),
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
      return unwrapResponse<{ emailVerified?: boolean }>(
        transport.post("/auth/verify-email", payload),
        "Email verification failed."
      );
    },
    forgotPassword(payload: ForgotPasswordPayload) {
      return unwrapResponse<{ message?: string }>(
        transport.post("/auth/forgot-password", payload),
        "Unable to send verification code."
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
