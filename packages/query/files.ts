import { mutationOptions } from "@tanstack/react-query";
import type { ApiClient } from "@fittrack/api-client";

export function uploadImageMutationOptions(client: Pick<ApiClient, "files">) {
  return mutationOptions({
    mutationFn: (payload: FormData) => client.files.uploadImage(payload)
  });
}

export function uploadMilestoneEvidenceMutationOptions(
  client: Pick<ApiClient, "files">
) {
  return mutationOptions({
    mutationFn: (payload: FormData) =>
      client.files.uploadMilestoneEvidence(payload)
  });
}
