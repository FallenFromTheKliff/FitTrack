import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type { ApiClient } from "@fittrack/api-client";
import type {
  CancelMembershipInput,
  CreateMembershipPlanInput,
  ManualMembershipPaymentInput,
  MembershipPaymentHistoryParams,
  MembershipPaymentReviewFilters,
  MembershipAccessCandidatesParams,
  MembershipOnsiteSaleCandidatesParams,
  MembershipPlanListParams,
  PurchaseMembershipCardInput,
  RecordCashMembershipInput,
  RevokeMembershipSubscriptionInput,
  RevokeFreeDayPassInput,
  SubscribeToMembershipInput,
  UpdateMembershipCatalogSettingsInput,
  UpdateMembershipPlanInput,
  VerifyMembershipPaymentInput
} from "@fittrack/types";
import {
  invalidateAdminMembersQuery,
  invalidateAnalyticsQueries,
  invalidateAdminMembershipPaymentQueries,
  invalidateMembershipQueries,
  invalidateStaffCoachManagementQueries
} from "./cache";
import { queryKeys } from "./query-keys";

const onsiteSaleCandidatesKey = ["membership", "onsite-sale", "candidates"] as const;
const membershipAccessCandidatesKey = ["membership", "access-management", "candidates"] as const;

export function membershipAccessCandidatesQueryKey(
  params?: MembershipAccessCandidatesParams,
) {
  return params
    ? ([...membershipAccessCandidatesKey, params] as const)
    : membershipAccessCandidatesKey;
}

export function membershipAccessCandidatesQueryOptions(
  client: Pick<ApiClient, "membership">,
  params: MembershipAccessCandidatesParams,
) {
  return queryOptions({
    queryKey: membershipAccessCandidatesQueryKey(params),
    queryFn: () => client.membership.listMembershipAccessCandidates(params),
  });
}

export function membershipOnsiteSaleCandidatesQueryKey(
  params?: MembershipOnsiteSaleCandidatesParams,
) {
  return params
    ? ([...onsiteSaleCandidatesKey, params] as const)
    : onsiteSaleCandidatesKey;
}

export function membershipOnsiteSaleCandidatesQueryOptions(
  client: Pick<ApiClient, "membership">,
  params: MembershipOnsiteSaleCandidatesParams,
) {
  return queryOptions({
    queryKey: membershipOnsiteSaleCandidatesQueryKey(params),
    queryFn: () => client.membership.listOnsiteSaleCandidates(params),
  });
}

export function membershipPlansQueryOptions(
  client: Pick<ApiClient, "membership">,
  params?: MembershipPlanListParams
) {
  return queryOptions({
    queryKey: queryKeys.membershipPlans(params),
    queryFn: () => client.membership.listPlans(params)
  });
}

export function membershipOperationsDashboardQueryOptions(
  client: Pick<ApiClient, "membership">
) {
  return queryOptions({
    queryKey: queryKeys.membershipOperationsDashboard(),
    queryFn: () => client.membership.getOperationsDashboard()
  });
}

export function membershipCatalogSettingsQueryOptions(
  client: Pick<ApiClient, "membership">
) {
  return queryOptions({
    queryKey: ["membership", "catalog-settings"],
    queryFn: () => client.membership.getCatalogSettings()
  });
}

export function createMembershipPlanMutationOptions(
  client: Pick<ApiClient, "membership">,
  queryClient: QueryClient
) {
  return mutationOptions({
    mutationFn: (payload: CreateMembershipPlanInput) =>
      client.membership.createPlan(payload),
    onSuccess: async () => {
      await invalidateMembershipQueries(queryClient);
    }
  });
}

export function updateMembershipPlanMutationOptions(
  client: Pick<ApiClient, "membership">,
  queryClient: QueryClient
) {
  return mutationOptions({
    mutationFn: ({
      planId,
      payload
    }: {
      planId: string;
      payload: UpdateMembershipPlanInput;
    }) => client.membership.updatePlan(planId, payload),
    onSuccess: async () => {
      await invalidateMembershipQueries(queryClient);
    }
  });
}

export function recordCashMembershipMutationOptions(
  client: Pick<ApiClient, "membership">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: (payload: RecordCashMembershipInput) =>
      client.membership.recordCashMembership(payload),
    onSuccess: async () => {
      await Promise.all([
        invalidateMembershipQueries(queryClient),
        invalidateAnalyticsQueries(queryClient),
        invalidateAdminMembershipPaymentQueries(queryClient),
        invalidateAdminMembersQuery(queryClient),
        queryClient.invalidateQueries({
          queryKey: membershipOnsiteSaleCandidatesQueryKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: membershipAccessCandidatesQueryKey(),
        }),
      ]);
    },
  });
}

export function revokeMembershipSubscriptionMutationOptions(
  client: Pick<ApiClient, "membership">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      subscriptionId,
      payload,
    }: {
      subscriptionId: string;
      payload?: RevokeMembershipSubscriptionInput;
    }) => client.membership.revokeMembershipSubscription(subscriptionId, payload),
    onSuccess: async () => {
      await Promise.all([
        invalidateMembershipQueries(queryClient),
        invalidateAdminMembersQuery(queryClient),
        queryClient.invalidateQueries({
          queryKey: membershipOnsiteSaleCandidatesQueryKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: membershipAccessCandidatesQueryKey(),
        }),
      ]);
    },
  });
}

export function grantFreeDayPassMutationOptions(
  client: Pick<ApiClient, "membership">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: (memberId: string) => client.membership.grantFreeDayPass(memberId),
    onSuccess: async () => {
      await Promise.all([
        invalidateMembershipQueries(queryClient),
        invalidateAdminMembersQuery(queryClient),
        queryClient.invalidateQueries({
          queryKey: membershipAccessCandidatesQueryKey(),
        }),
      ]);
    },
  });
}

export function revokeFreeDayPassMutationOptions(
  client: Pick<ApiClient, "membership">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      memberId,
      payload,
    }: {
      memberId: string;
      payload: RevokeFreeDayPassInput;
    }) => client.membership.revokeFreeDayPass(memberId, payload),
    onSuccess: async () => {
      await Promise.all([
        invalidateMembershipQueries(queryClient),
        invalidateAdminMembersQuery(queryClient),
        queryClient.invalidateQueries({
          queryKey: membershipAccessCandidatesQueryKey(),
        }),
      ]);
    },
  });
}

export function deleteMembershipPlanMutationOptions(
  client: Pick<ApiClient, "membership">,
  queryClient: QueryClient
) {
  return mutationOptions({
    mutationFn: (planId: string) => client.membership.deletePlan(planId),
    onSuccess: async () => {
      await invalidateMembershipQueries(queryClient);
    }
  });
}

export function membershipManagementPlansQueryOptions(
  client: Pick<ApiClient, "membership">,
  params?: MembershipPlanListParams,
) {
  return queryOptions({
    queryKey: queryKeys.membershipManagementPlans(params),
    queryFn: () => client.membership.listManagementPlans(params),
  });
}

export function updateMembershipCatalogSettingsMutationOptions(
  client: Pick<ApiClient, "membership">,
  queryClient: QueryClient
) {
  return mutationOptions({
    mutationFn: (payload: UpdateMembershipCatalogSettingsInput) =>
      client.membership.updateCatalogSettings(payload),
    onSuccess: async () => {
      await invalidateMembershipQueries(queryClient);
      await queryClient.invalidateQueries({ queryKey: ["membership", "catalog-settings"] });
    }
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

export function membershipFreeDayPassEligibilityQueryOptions(
  client: Pick<ApiClient, "membership">,
  userId?: string,
) {
  return queryOptions({
    queryKey: queryKeys.membershipFreeDayPassEligibility(userId),
    queryFn: () => client.membership.getFreeDayPassEligibility(),
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
        invalidateMembershipQueries(queryClient, variables.affectedUserId),
        invalidateStaffCoachManagementQueries(queryClient)
      ]);
    }
  });
}
