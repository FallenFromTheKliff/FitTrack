import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type {
  ApiClient,
  BulkUpdateRecurringCoachingSessionsInput,
  RecurringCoachingEnrollmentInput,
  RecurringCoachingPlanInput,
  UpdateRecurringCoachingSessionInput,
} from "@fittrack/api-client";

import {
  invalidateCoachScheduleQueries,
  invalidateStaffCoachManagementQueries,
} from "./cache";
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

export function recurringCoachingPlansQueryOptions(
  client: Pick<ApiClient, "recurringCoachingPlans">,
) {
  return queryOptions({
    queryKey: queryKeys.recurringCoachingPlans(),
    queryFn: () => client.recurringCoachingPlans.list(),
  });
}

export function enrollRecurringCoachingPlanMutationOptions(
  client: Pick<ApiClient, "recurringCoachingPlans">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: (input: RecurringCoachingEnrollmentInput) =>
      client.recurringCoachingPlans.enroll(input),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.recurringCoachingPlans(),
      });
      await invalidateCoachScheduleQueries(queryClient, variables.coachId);
      await invalidateStaffCoachManagementQueries(queryClient, variables.coachId);
    },
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
      await queryClient.invalidateQueries({
        queryKey: queryKeys.recurringCoachingPlans(),
      });
      await invalidateStaffCoachManagementQueries(queryClient, variables.coachId);
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
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.recurringCoachingPlans(),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.recurringCoachingPlanSessions({
          planId: variables.planId,
        }),
      });
      await invalidateCoachScheduleQueries(queryClient, variables.input.coachId);
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
      await Promise.all([
        invalidateStaffCoachManagementQueries(queryClient),
        queryClient.invalidateQueries({
          queryKey: queryKeys.recurringCoachingPlans(),
        }),
      ]);
    },
  });
}
