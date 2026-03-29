import { mutationOptions } from "@tanstack/react-query";
import type { ApiClient, UpdateUserAccountPayload, UpdateUserProfilePayload } from "@fittrack/api-client";

export function updateProfileMutationOptions(client: Pick<ApiClient, "users">) {
  return mutationOptions({
    mutationFn: (payload: UpdateUserProfilePayload) => client.users.updateProfile(payload)
  });
}

export function updateAccountMutationOptions(client: Pick<ApiClient, "users">) {
  return mutationOptions({
    mutationFn: (payload: UpdateUserAccountPayload) => client.users.updateAccount(payload)
  });
}
