import { mutationOptions } from "@tanstack/react-query";
import type { ApiClient, ForgotPasswordPayload, ResetPasswordPayload } from "@fittrack/api-client";

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
