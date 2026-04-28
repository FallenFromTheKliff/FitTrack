import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type { ApiClient, GymLayoutEquipmentMutationInput } from "@fittrack/api-client";
import { invalidateGymLayoutQueries } from "./cache";
import { queryKeys } from "./query-keys";

type GymLayoutEquipmentQueryConfig = {
  refetchInterval?: false | number;
};

export function gymLayoutEquipmentQueryOptions(
  client: Pick<ApiClient, "gymLayout">,
  config?: GymLayoutEquipmentQueryConfig,
) {
  return queryOptions({
    queryKey: queryKeys.gymLayoutEquipment(),
    queryFn: () => client.gymLayout.listEquipment(),
    ...(config?.refetchInterval !== undefined
      ? { refetchInterval: config.refetchInterval }
      : {}),
  });
}

export function archivedGymLayoutEquipmentQueryOptions(
  client: Pick<ApiClient, "gymLayout">,
  config?: GymLayoutEquipmentQueryConfig,
) {
  return queryOptions({
    queryKey: queryKeys.gymLayoutArchivedEquipment(),
    queryFn: () => client.gymLayout.listArchivedEquipment(),
    ...(config?.refetchInterval !== undefined
      ? { refetchInterval: config.refetchInterval }
      : {}),
  });
}

async function invalidateGymLayout(queryClient: QueryClient) {
  await invalidateGymLayoutQueries(queryClient);
}

export function createGymLayoutEquipmentMutationOptions(
  client: Pick<ApiClient, "gymLayout">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: (payload: GymLayoutEquipmentMutationInput) =>
      client.gymLayout.createEquipment(payload),
    onSuccess: async () => {
      await invalidateGymLayout(queryClient);
    },
  });
}

export function updateGymLayoutEquipmentMutationOptions(
  client: Pick<ApiClient, "gymLayout">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      equipmentId,
      payload,
    }: {
      equipmentId: string;
      payload: GymLayoutEquipmentMutationInput;
    }) => client.gymLayout.updateEquipment(equipmentId, payload),
    onSuccess: async () => {
      await invalidateGymLayout(queryClient);
    },
  });
}

export function deleteGymLayoutEquipmentMutationOptions(
  client: Pick<ApiClient, "gymLayout">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: (equipmentId: string) =>
      client.gymLayout.deleteEquipment(equipmentId),
    onSuccess: async () => {
      await invalidateGymLayout(queryClient);
    },
  });
}

export function restoreGymLayoutEquipmentMutationOptions(
  client: Pick<ApiClient, "gymLayout">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: (equipmentId: string) =>
      client.gymLayout.restoreEquipment(equipmentId),
    onSuccess: async () => {
      await invalidateGymLayout(queryClient);
    },
  });
}
