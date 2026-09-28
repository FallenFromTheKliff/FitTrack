import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type {
  ApiClient,
  ChangePasswordPayload,
  ForgotPasswordPayload,
  LoginCredentials,
  RegisterPayload,
  ResetPasswordPayload,
  VerifyResetOtpPayload,
  VerifyEmailPayload
} from "@fittrack/api-client";
import type { AuthUser, LoginPortal } from "@fittrack/types";
import { queryKeys } from "./query-keys";

export function authUserQueryOptions(client: Pick<ApiClient, "users">) {
  return queryOptions({
    queryKey: queryKeys.authUser(),
    queryFn: () => client.users.getProfile()
  });
}

export function authCurrentUserQueryOptions(loadCurrentUser: () => Promise<AuthUser | null>) {
  return queryOptions({
    queryKey: queryKeys.authUser(),
    queryFn: loadCurrentUser,
    retry: false,
    staleTime: Infinity
  });
}

export function loginMutationOptions(client: Pick<ApiClient, "auth">) {
  return mutationOptions({
    mutationFn: (payload: LoginCredentials) => client.auth.login(payload)
  });
}

export function registerMutationOptions(client: Pick<ApiClient, "auth">) {
  return mutationOptions({
    mutationFn: (payload: RegisterPayload) => client.auth.register(payload)
  });
}

export function logoutMutationOptions(client: Pick<ApiClient, "auth">) {
  return mutationOptions({
    mutationFn: (payload: { refresh_token: string }) => client.auth.logout(payload)
  });
}

export function verifyCurrentPasswordMutationOptions(client: Pick<ApiClient, "auth">) {
  return mutationOptions({
    mutationFn: async (currentPassword: string) => {
      const data = await client.auth.verifyCurrentPassword(currentPassword);
      return !!data.verified;
    }
  });
}

export function changePasswordMutationOptions(client: Pick<ApiClient, "auth">) {
  return mutationOptions({
    mutationFn: (payload: ChangePasswordPayload) => client.auth.changePassword(payload)
  });
}

export function verifyEmailMutationOptions(client: Pick<ApiClient, "auth">) {
  return mutationOptions({
    mutationFn: (payload: VerifyEmailPayload) => client.auth.verifyEmail(payload)
  });
}

export function forgotPasswordMutationOptions(client: Pick<ApiClient, "auth">) {
  return mutationOptions({
    mutationFn: (payload: ForgotPasswordPayload) => client.auth.forgotPassword(payload)
  });
}

export function verifyResetOtpMutationOptions(client: Pick<ApiClient, "auth">) {
  return mutationOptions({
    mutationFn: (payload: VerifyResetOtpPayload) => client.auth.verifyResetOtp(payload)
  });
}

export function resetPasswordMutationOptions(client: Pick<ApiClient, "auth">) {
  return mutationOptions({
    mutationFn: (payload: ResetPasswordPayload) => client.auth.resetPassword(payload)
  });
}

export function loginActionMutationOptions<TResult>(
  login: (
    email: string,
    password: string,
    options?: { portal?: LoginPortal }
  ) => Promise<TResult>
) {
  return mutationOptions({
    mutationFn: ({
      email,
      password,
      portal
    }: {
      email: string;
      password: string;
      portal?: LoginPortal;
    }) => login(email, password, { portal })
  });
}

export function registerActionMutationOptions<TPayload extends RegisterPayload, TResult>(
  register: (payload: TPayload) => Promise<TResult>
) {
  return mutationOptions({
    mutationFn: (payload: TPayload) => register(payload)
  });
}

export function verifyCurrentPasswordActionMutationOptions<TResult>(
  verifyCurrentPassword: (password: string) => Promise<TResult>
) {
  return mutationOptions({
    mutationFn: (currentPassword: string) => verifyCurrentPassword(currentPassword)
  });
}

export function changePasswordActionMutationOptions<TResult>(
  changePassword: (currentPassword: string, newPassword: string) => Promise<TResult>
) {
  return mutationOptions({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      changePassword(currentPassword, newPassword)
  });
}

export function logoutActionMutationOptions<TResult>(logout: () => Promise<TResult>) {
  return mutationOptions({
    mutationFn: () => logout()
  });
}

export function verifyOtpActionMutationOptions<TResult>(verifyOtp: (code: string) => Promise<TResult>) {
  return mutationOptions({
    mutationFn: (code: string) => verifyOtp(code)
  });
}
