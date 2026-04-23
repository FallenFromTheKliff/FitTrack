import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type {
  AnalyticsQueryParams,
  ApiClient,
  BusinessInsightHistoryParams,
  GenerateBusinessInsightInput
} from "@fittrack/api-client";
import { invalidateAnalyticsQueries } from "./cache";
import { queryKeys } from "./query-keys";

export function analyticsOverviewQueryOptions(
  client: Pick<ApiClient, "analytics">,
  params?: AnalyticsQueryParams
) {
  return queryOptions({
    queryKey: queryKeys.analyticsOverview(params),
    queryFn: () => client.analytics.getOverview(params)
  });
}

export function analyticsSnapshotQueryOptions(
  client: Pick<ApiClient, "analytics">
) {
  return queryOptions({
    queryKey: queryKeys.analyticsSnapshot(),
    queryFn: () => client.analytics.getSnapshot()
  });
}

export function analyticsRevenueQueryOptions(
  client: Pick<ApiClient, "analytics">,
  params?: AnalyticsQueryParams
) {
  return queryOptions({
    queryKey: queryKeys.analyticsRevenue(params),
    queryFn: () => client.analytics.getRevenue(params)
  });
}

export function analyticsAttendanceQueryOptions(
  client: Pick<ApiClient, "analytics">,
  params?: AnalyticsQueryParams
) {
  return queryOptions({
    queryKey: queryKeys.analyticsAttendance(params),
    queryFn: () => client.analytics.getAttendance(params)
  });
}

export function analyticsMembersQueryOptions(
  client: Pick<ApiClient, "analytics">,
  params?: AnalyticsQueryParams
) {
  return queryOptions({
    queryKey: queryKeys.analyticsMembers(params),
    queryFn: () => client.analytics.getMembers(params)
  });
}

export function analyticsCoachesQueryOptions(
  client: Pick<ApiClient, "analytics">,
  params?: AnalyticsQueryParams
) {
  return queryOptions({
    queryKey: queryKeys.analyticsCoaches(params),
    queryFn: () => client.analytics.getCoaches(params)
  });
}

export function analyticsInsightsQueryOptions(
  client: Pick<ApiClient, "analytics">,
  params?: BusinessInsightHistoryParams
) {
  return queryOptions({
    queryKey: queryKeys.analyticsInsights(params),
    queryFn: () => client.analytics.listInsights(params)
  });
}

export function analyticsInsightDetailQueryOptions(
  client: Pick<ApiClient, "analytics">,
  insightId?: string
) {
  return queryOptions({
    queryKey: queryKeys.analyticsInsightDetail(insightId),
    queryFn: async () => {
      if (!insightId) return null;
      return client.analytics.getInsightById(insightId);
    }
  });
}

export function generateAnalyticsInsightMutationOptions(
  client: Pick<ApiClient, "analytics">,
  queryClient: QueryClient
) {
  return mutationOptions({
    mutationFn: ({ input }: { input: GenerateBusinessInsightInput }) =>
      client.analytics.generateInsight(input),
    onSuccess: async () => {
      await invalidateAnalyticsQueries(queryClient);
    }
  });
}
