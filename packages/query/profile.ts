import { mutationOptions } from "@tanstack/react-query";
import type { ApiClient, UpdateUserPhonePayload, UpdateUserProfilePayload } from "@fittrack/api-client";

export function updateProfileMutationOptions(client: Pick<ApiClient, "users">) {
  return mutationOptions({
    mutationFn: (payload: UpdateUserProfilePayload) => client.users.updateProfile(payload)
  });
}

export function updatePhoneMutationOptions(client: Pick<ApiClient, "users">) {
  return mutationOptions({
    mutationFn: (payload: UpdateUserPhonePayload) => client.users.updatePhone(payload)
  });
}
