import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { ApiClient } from "@fittrack/api-client";

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
