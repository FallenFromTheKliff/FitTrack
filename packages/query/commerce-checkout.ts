import {
  mutationOptions,
  queryOptions,
  type QueryClient,
} from "@tanstack/react-query";
import type { ApiClient } from "@fittrack/api-client";
import { queryKeys } from "./query-keys";

export function commerceCheckoutHoldQueryOptions(
  client: Pick<ApiClient, "commerceCheckout">,
  holdId: string,
) {
  return queryOptions({
    queryFn: () => client.commerceCheckout.getHoldStatus(holdId),
    queryKey: ["commerce-checkout", "hold", holdId] as const,
  });
}

export function reconcileCommerceCheckoutMutationOptions(
  client: Pick<ApiClient, "commerceCheckout">,
) {
  return mutationOptions({
    mutationFn: (holdId: string) =>
      client.commerceCheckout.reconcileHold(holdId),
  });
}

/** Refresh member appointments only after server reconciliation is terminal-successful. */
export function invalidateSuccessfulCheckoutQueries(
  queryClient: QueryClient,
  state: string | null | undefined,
) {
  if (state !== "succeeded") return Promise.resolve();
  return queryClient.invalidateQueries({
    queryKey: queryKeys.appointments(),
  });
}
