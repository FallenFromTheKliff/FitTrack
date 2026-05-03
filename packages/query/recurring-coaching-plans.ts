import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type {
  ApiClient,
  BulkUpdateRecurringCoachingSessionsInput,
  RecurringCoachingBillingCyclePaymentInput,
  RecurringCoachingPlanInput,
  UpdateRecurringCoachingSessionInput,
} from "@fittrack/api-client";

import { invalidateStaffCoachManagementQueries } from "./cache";
import { queryKeys } from "./query-keys";

export function recurringCoachingPlanSessionsQueryOptions(
  client: Pick<ApiClient, "recurringCoachingPlans">,
  planId: string,
) {
  return queryOptions({
    queryKey: queryKeys.recurringCoachingPlanSessions({ planId }),
    queryFn: () => client.recurringCoachingPlans.listSessions(planId),
  });
}

export function previewRecurringCoachingPlanMutationOptions(
  client: Pick<ApiClient, "recurringCoachingPlans">,
) {
  return mutationOptions({
    mutationFn: (input: RecurringCoachingPlanInput) =>
      client.recurringCoachingPlans.preview(input),
  });
}

export function createRecurringCoachingPlanMutationOptions(
  client: Pick<ApiClient, "recurringCoachingPlans">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: (input: RecurringCoachingPlanInput) =>
      client.recurringCoachingPlans.create(input),
    onSuccess: async (_data, variables) => {
      await invalidateStaffCoachManagementQueries(queryClient, variables.coachId);
    },
  });
}

export function payRecurringCoachingBillingCycleMutationOptions(
  client: Pick<ApiClient, "recurringCoachingPlans">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      cycleId,
      input,
      planId,
    }: {
      cycleId: string;
      input: RecurringCoachingBillingCyclePaymentInput;
      planId: string;
    }) => client.recurringCoachingPlans.payBillingCycle(planId, cycleId, input),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.recurringCoachingPlanSessions({
          planId: variables.planId,
        }),
      });
      await invalidateStaffCoachManagementQueries(queryClient);
    },
  });
}

export function updateRecurringCoachingSessionMutationOptions(
  client: Pick<ApiClient, "recurringCoachingPlans">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      input,
      planId,
      sessionId,
    }: {
      input: UpdateRecurringCoachingSessionInput;
      planId: string;
      sessionId: string;
    }) => client.recurringCoachingPlans.updateSession(planId, sessionId, input),
    onSuccess: async () => {
      await invalidateStaffCoachManagementQueries(queryClient);
    },
  });
}

export function bulkUpdateRecurringCoachingSessionsMutationOptions(
  client: Pick<ApiClient, "recurringCoachingPlans">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      input,
      planId,
    }: {
      input: BulkUpdateRecurringCoachingSessionsInput;
      planId: string;
    }) => client.recurringCoachingPlans.bulkUpdate(planId, input),
    onSuccess: async (_data, variables) => {
      await invalidateStaffCoachManagementQueries(queryClient, variables.input.coachId);
    },
  });
}

export function cancelRecurringCoachingPlanMutationOptions(
  client: Pick<ApiClient, "recurringCoachingPlans">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({ planId, reason }: { planId: string; reason?: string }) =>
      client.recurringCoachingPlans.cancel(planId, reason),
    onSuccess: async () => {
      await invalidateStaffCoachManagementQueries(queryClient);
    },
  });
}
