import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type {
  ApiClient,
  ChangePasswordPayload,
  ForgotPasswordPayload,
  LoginCredentials,
  RegisterPayload,
  ResetPasswordPayload,
  VerifyEmailPayload
} from "@fittrack/api-client";
import { queryKeys } from "./query-keys";

export function authUserQueryOptions(client: Pick<ApiClient, "users">) {
  return queryOptions({
    queryKey: queryKeys.authUser(),
    queryFn: () => client.users.getProfile()
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

export function resetPasswordMutationOptions(client: Pick<ApiClient, "auth">) {
  return mutationOptions({
    mutationFn: (payload: ResetPasswordPayload) => client.auth.resetPassword(payload)
  });
}
