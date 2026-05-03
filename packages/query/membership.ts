import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type { ApiClient } from "@fittrack/api-client";
import type {
  CancelMembershipInput,
  ManualMembershipPaymentInput,
  MembershipPaymentHistoryParams,
  MembershipPaymentReviewFilters,
  MembershipPlanListParams,
  PurchaseMembershipCardInput,
  SubscribeToMembershipInput,
  VerifyMembershipPaymentInput
} from "@fittrack/types";
import {
  invalidateAnalyticsQueries,
  invalidateAdminMembershipPaymentQueries,
  invalidateMembershipQueries
} from "./cache";
import { queryKeys } from "./query-keys";

export function membershipPlansQueryOptions(
  client: Pick<ApiClient, "membership">,
  params?: MembershipPlanListParams
) {
  return queryOptions({
    queryKey: queryKeys.membershipPlans(params),
    queryFn: () => client.membership.listPlans(params)
  });
}

export function membershipCurrentSubscriptionQueryOptions(
  client: Pick<ApiClient, "membership">,
  userId?: string
) {
  return queryOptions({
    queryKey: queryKeys.membershipCurrentSubscription(userId),
    queryFn: () => client.membership.getCurrentSubscription()
  });
}

export function membershipPaymentsQueryOptions(
  client: Pick<ApiClient, "membership">,
  userId?: string,
  params?: MembershipPaymentHistoryParams
) {
  return queryOptions({
    queryKey: queryKeys.membershipPayments(userId, params),
    queryFn: () => client.membership.listMyPayments(params)
  });
}

export function reviewMembershipPaymentsQueryOptions(
  client: Pick<ApiClient, "membership">,
  filters?: MembershipPaymentReviewFilters
) {
  return queryOptions({
    queryKey: queryKeys.membershipReviewPayments(filters),
    queryFn: () => client.membership.listPayments(filters)
  });
}

export function subscribeMembershipMutationOptions(
  client: Pick<ApiClient, "membership">,
  queryClient: QueryClient
) {
  return mutationOptions({
    mutationFn: ({
      payload
    }: {
      payload: SubscribeToMembershipInput;
      userId?: string;
    }) => client.membership.subscribe(payload),
    onSuccess: async (_data, variables) => {
      await invalidateMembershipQueries(queryClient, variables.userId);
    }
  });
}

export function purchaseMembershipCardMutationOptions(
  client: Pick<ApiClient, "membership">,
  queryClient: QueryClient
) {
  return mutationOptions({
    mutationFn: ({
      payload
    }: {
      payload: PurchaseMembershipCardInput;
      userId?: string;
    }) => client.membership.purchaseMembershipCard(payload),
    onSuccess: async (_data, variables) => {
      await invalidateMembershipQueries(queryClient, variables.userId);
    }
  });
}

export function cancelMembershipMutationOptions(
  client: Pick<ApiClient, "membership">,
  queryClient: QueryClient
) {
  return mutationOptions({
    mutationFn: ({
      payload
    }: {
      payload?: CancelMembershipInput;
      userId?: string;
    }) => client.membership.cancelSubscription(payload),
    onSuccess: async (_data, variables) => {
      await invalidateMembershipQueries(queryClient, variables.userId);
    }
  });
}

export function submitManualMembershipPaymentMutationOptions(
  client: Pick<ApiClient, "membership">,
  queryClient: QueryClient
) {
  return mutationOptions({
    mutationFn: ({
      payload
    }: {
      payload: ManualMembershipPaymentInput;
      userId?: string;
    }) => client.membership.submitManualPayment(payload),
    onSuccess: async (_data, variables) => {
      await invalidateMembershipQueries(queryClient, variables.userId);
    }
  });
}

export function verifyMembershipPaymentMutationOptions(
  client: Pick<ApiClient, "membership">,
  queryClient: QueryClient
) {
  return mutationOptions({
    mutationFn: ({
      paymentId,
      payload
    }: {
      affectedUserId?: string;
      paymentId: string;
      payload: VerifyMembershipPaymentInput;
    }) => client.membership.verifyPayment(paymentId, payload),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        invalidateAnalyticsQueries(queryClient),
        invalidateAdminMembershipPaymentQueries(queryClient),
        invalidateMembershipQueries(queryClient, variables.affectedUserId)
      ]);
    }
  });
}
