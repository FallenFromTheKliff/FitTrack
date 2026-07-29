import {
  mutationOptions,
  queryOptions,
  type QueryClient,
} from "@tanstack/react-query";
import type {
  AdminMilestoneDefinitionListParams,
  AdminMilestoneEvidenceListParams,
  AnalyzePoseSequenceInput,
  ApiClient,
  CreateExerciseDraftProposalInput,
  CreateExerciseReviewSubmissionInput,
  CreateFitnessExerciseInput,
  CreateMuscleDefinitionInput,
  DetectPoseEquipmentInput,
  FinalizePoseSessionInput,
  FitnessExerciseListParams,
  FitnessExerciseReviewSubmissionListParams,
  FitnessLeaderboardListParams,
  FitnessMuscleLeaderboardListParams,
  FitnessMasteryListParams,
  FitnessMilestoneListParams,
  FitnessSeasonHistoryListParams,
  LogWorkoutSetInput,
  MuscleDefinitionListParams,
  ReviewFitnessMilestoneEvidenceInput,
  StartPoseSessionInput,
  StartWorkoutSessionInput,
  CreateTrainingPlanInput,
  SubmitFitnessMilestoneEvidenceInput,
  TrainingPlanListParams,
  UpdateFitnessRankingProfileInput,
  UpdateExerciseReviewSubmissionInput,
  UpdateFitnessExerciseInput,
  UpdateMuscleDefinitionInput,
  UpsertAdminMilestoneDefinitionInput,
  WorkoutSessionListParams,
} from "@fittrack/api-client";
import { invalidateFitnessQueries, invalidateFitnessPoseQuery } from "./cache";
import { queryKeys } from "./query-keys";

export function fitnessExercisesQueryOptions(
  client: Pick<ApiClient, "fitness">,
  params?: FitnessExerciseListParams,
) {
  return queryOptions({
    queryKey: queryKeys.fitnessExercises(params),
    queryFn: () => client.fitness.listExercises(params),
  });
}

export function fitnessExerciseReviewSubmissionsQueryOptions(
  client: Pick<ApiClient, "fitness">,
  params?: FitnessExerciseReviewSubmissionListParams,
) {
  return queryOptions({
    queryKey: queryKeys.fitnessExerciseReviewSubmissions(params),
    queryFn: () => client.fitness.listExerciseReviewSubmissions(params),
  });
}

export function fitnessMuscleDefinitionsQueryOptions(
  client: Pick<ApiClient, "fitness">,
  params?: MuscleDefinitionListParams,
) {
  return queryOptions({
    queryKey: queryKeys.fitnessMuscleDefinitions(params),
    queryFn: () => client.fitness.listMuscleDefinitions(params),
  });
}

export function createFitnessExerciseMutationOptions(
  client: Pick<ApiClient, "fitness">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({ payload }: { payload: CreateFitnessExerciseInput }) =>
      client.fitness.createExercise(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.fitnessExercises(),
      });
    },
  });
}

export function updateFitnessExerciseMutationOptions(
  client: Pick<ApiClient, "fitness">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      exerciseId,
      payload,
    }: {
      exerciseId: string;
      payload: UpdateFitnessExerciseInput;
    }) => client.fitness.updateExercise(exerciseId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.fitnessExercises(),
      });
    },
  });
}

export function createMuscleDefinitionMutationOptions(
  client: Pick<ApiClient, "fitness">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({ payload }: { payload: CreateMuscleDefinitionInput }) =>
      client.fitness.createMuscleDefinition(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.fitnessMuscleDefinitions(),
      });
    },
  });
}

export function updateMuscleDefinitionMutationOptions(
  client: Pick<ApiClient, "fitness">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      muscleDefinitionId,
      payload,
    }: {
      muscleDefinitionId: string;
      payload: UpdateMuscleDefinitionInput;
    }) => client.fitness.updateMuscleDefinition(muscleDefinitionId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.fitnessMuscleDefinitions(),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.fitnessExercises(),
        }),
      ]);
    },
  });
}

export function archiveMuscleDefinitionMutationOptions(
  client: Pick<ApiClient, "fitness">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({ muscleDefinitionId }: { muscleDefinitionId: string }) =>
      client.fitness.archiveMuscleDefinition(muscleDefinitionId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.fitnessMuscleDefinitions(),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.fitnessExercises(),
        }),
      ]);
    },
  });
}

export function updateExerciseReviewSubmissionMutationOptions(
  client: Pick<ApiClient, "fitness">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      submissionId,
      payload,
    }: {
      payload: UpdateExerciseReviewSubmissionInput;
      submissionId: string;
    }) => client.fitness.updateExerciseReviewSubmission(submissionId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.fitnessExerciseReviewSubmissions(),
      });
    },
  });
}

export function createExerciseReviewSubmissionMutationOptions(
  client: Pick<ApiClient, "fitness">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      payload,
    }: {
      payload: CreateExerciseReviewSubmissionInput;
      userId?: string;
    }) => client.fitness.createExerciseReviewSubmission(payload),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.fitnessExerciseReviewSubmissions(),
      });
      if (variables.payload.poseSessionId) {
        await invalidateFitnessPoseQuery(
          queryClient,
          variables.payload.poseSessionId,
        );
      }
    },
  });
}

export function createExerciseDraftProposalMutationOptions(
  client: Pick<ApiClient, "fitness">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      payload,
    }: {
      payload: CreateExerciseDraftProposalInput;
      userId?: string;
    }) => client.fitness.createExerciseDraftProposal(payload),
    onSuccess: async (data, variables) => {
      if (variables.payload.poseSessionId) {
        await invalidateFitnessPoseQuery(
          queryClient,
          variables.payload.poseSessionId,
        );
      }
      if (variables.userId) {
        await invalidateFitnessQueries(queryClient, variables.userId);
      }
    },
  });
}

export function fitnessPlansQueryOptions(
  client: Pick<ApiClient, "fitness">,
  userId?: string,
  params?: TrainingPlanListParams,
) {
  return queryOptions({
    queryKey: queryKeys.fitnessPlans(userId, params),
    queryFn: async () => {
      if (!userId) {
        return {
          data: [],
          meta: {
            page: 1,
            limit: params?.limit ?? 0,
            total: 0,
            total_pages: 0,
          },
        };
      }
      return client.fitness.listPlans(params);
    },
  });
}

export function fitnessClientPlansQueryOptions(
  client: Pick<ApiClient, "fitness">,
  coachUserId?: string,
  memberId?: string,
  params?: TrainingPlanListParams,
) {
  return queryOptions({
    queryKey: [
      ...queryKeys.fitnessPlans(coachUserId, params),
      "client",
      memberId,
    ],
    queryFn: async () => {
      if (!coachUserId || !memberId) {
        return {
          data: [],
          meta: { page: 1, limit: params?.limit ?? 0, total: 0, total_pages: 0 },
        };
      }
      return client.fitness.listClientPlans(memberId, params);
    },
  });
}

export function activateFitnessPlanMutationOptions(
  client: Pick<ApiClient, "fitness">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({ planId }: { planId: string; userId?: string }) =>
      client.fitness.activatePlan(planId),
    onSuccess: async (_data, variables) => {
      await invalidateFitnessQueries(queryClient, variables.userId);
    },
  });
}

export function createFitnessPlanMutationOptions(
  client: Pick<ApiClient, "fitness">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      input,
    }: {
      input: CreateTrainingPlanInput;
      userId?: string;
    }) => client.fitness.createPlan(input),
    onSuccess: async (_data, variables) => {
      await invalidateFitnessQueries(queryClient, variables.userId);
    },
  });
}

export function updateFitnessPlanMutationOptions(
  client: Pick<ApiClient, "fitness">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      input,
      planId,
    }: {
      input: CreateTrainingPlanInput;
      planId: string;
      userId?: string;
    }) => client.fitness.updatePlan(planId, input),
    onSuccess: async (_data, variables) => {
      await invalidateFitnessQueries(queryClient, variables.userId);
    },
  });
}

export function createCustomFitnessExerciseMutationOptions(
  client: Pick<ApiClient, "fitness">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      input,
    }: {
      input: CreateFitnessExerciseInput;
      userId?: string;
    }) => client.fitness.createCustomExercise(input),
    onSuccess: async (_data, variables) => {
      await invalidateFitnessQueries(queryClient, variables.userId);
    },
  });
}

export function deleteFitnessPlanMutationOptions(
  client: Pick<ApiClient, "fitness">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({ planId }: { planId: string; userId?: string }) =>
      client.fitness.deletePlan(planId),
    onSuccess: async (_data, variables) => {
      await invalidateFitnessQueries(queryClient, variables.userId);
    },
  });
}

export function assignFitnessPlanMutationOptions(
  client: Pick<ApiClient, "fitness">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      memberId,
      planId,
    }: {
      memberId: string;
      planId: string;
      userId?: string;
    }) => client.fitness.assignPlan(planId, memberId),
    onSuccess: async (_data, variables) => {
      await invalidateFitnessQueries(queryClient, variables.userId);
    },
  });
}

export function fitnessMasteryQueryOptions(
  client: Pick<ApiClient, "fitness">,
  userId?: string,
  params?: FitnessMasteryListParams,
) {
  return queryOptions({
    queryKey: queryKeys.fitnessMastery(userId, params),
    queryFn: async () => {
      if (!userId) return [];
      return client.fitness.listMastery(params);
    },
  });
}

export function fitnessLeaderboardQueryOptions(
  client: Pick<ApiClient, "fitness">,
  userId?: string,
  params?: FitnessLeaderboardListParams,
) {
  return queryOptions({
    queryKey: queryKeys.fitnessLeaderboard(userId, params),
    queryFn: async () => {
      if (!userId) {
        return {
          data: [],
          meta: {
            page: 1,
            limit: params?.limit ?? 0,
            total: 0,
            total_pages: 0,
          },
        };
      }
      return client.fitness.listLeaderboard(params);
    },
  });
}

export function fitnessProgressionProfileQueryOptions(
  client: Pick<ApiClient, "fitness">,
  userId?: string,
) {
  return queryOptions({
    queryKey: queryKeys.fitnessProgressionProfile(userId),
    queryFn: async () => {
      if (!userId) return null;
      return client.fitness.getProgressionProfile();
    },
  });
}

export function fitnessRankingProfileQueryOptions(
  client: Pick<ApiClient, "fitness">,
  userId?: string,
) {
  return queryOptions({
    queryKey: queryKeys.fitnessRankingProfile(userId),
    queryFn: async () => {
      if (!userId) return null;
      return client.fitness.getRankingProfile();
    },
  });
}

export function updateFitnessRankingProfileMutationOptions(
  client: Pick<ApiClient, "fitness">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      input,
    }: {
      input: UpdateFitnessRankingProfileInput;
      userId?: string;
    }) => client.fitness.updateRankingProfile(input),
    onSuccess: async (_data, variables) => {
      await invalidateFitnessQueries(queryClient, variables.userId);
    },
  });
}

export function fitnessSeasonStandingQueryOptions(
  client: Pick<ApiClient, "fitness">,
  userId?: string,
) {
  return queryOptions({
    queryKey: queryKeys.fitnessSeasonStanding(userId),
    queryFn: async () => {
      if (!userId) return null;
      return client.fitness.getSeasonStanding();
    },
  });
}

export function fitnessMilestonesQueryOptions(
  client: Pick<ApiClient, "fitness">,
  userId?: string,
  params?: FitnessMilestoneListParams,
) {
  return queryOptions({
    queryKey: queryKeys.fitnessMilestones(userId, params),
    queryFn: async () => {
      if (!userId) return [];
      return client.fitness.listMilestones(params);
    },
  });
}

export function adminMilestonesQueryOptions(
  client: Pick<ApiClient, "fitness">,
  params?: AdminMilestoneDefinitionListParams,
) {
  return queryOptions({
    queryKey: queryKeys.fitnessAdminMilestones(params),
    queryFn: () => client.fitness.listAdminMilestones(params),
  });
}

export function adminMilestoneEvidenceQueryOptions(
  client: Pick<ApiClient, "fitness">,
  params?: AdminMilestoneEvidenceListParams,
) {
  return queryOptions({
    queryKey: queryKeys.fitnessAdminMilestoneEvidence(params),
    queryFn: () => client.fitness.listMilestoneEvidence(params),
  });
}

export function fitnessAchievementReviewsQueryOptions(
  client: Pick<ApiClient, "fitness">,
) {
  return queryOptions({
    queryKey: queryKeys.fitnessAchievementReviews(),
    queryFn: () => client.fitness.listAchievementReviews(),
  });
}

export function createAdminMilestoneMutationOptions(
  client: Pick<ApiClient, "fitness">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: (payload: UpsertAdminMilestoneDefinitionInput) =>
      client.fitness.createAdminMilestone(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.fitnessAdminMilestones(),
      });
    },
  });
}

export function updateAdminMilestoneMutationOptions(
  client: Pick<ApiClient, "fitness">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      milestoneDefinitionId,
      payload,
    }: {
      milestoneDefinitionId: string;
      payload: UpsertAdminMilestoneDefinitionInput;
    }) => client.fitness.updateAdminMilestone(milestoneDefinitionId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.fitnessAdminMilestones(),
      });
    },
  });
}

export function archiveAdminMilestoneMutationOptions(
  client: Pick<ApiClient, "fitness">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: (milestoneDefinitionId: string) =>
      client.fitness.archiveAdminMilestone(milestoneDefinitionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.fitnessAdminMilestones(),
      });
    },
  });
}

export function restoreAdminMilestoneMutationOptions(
  client: Pick<ApiClient, "fitness">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: (milestoneDefinitionId: string) =>
      client.fitness.restoreAdminMilestone(milestoneDefinitionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.fitnessAdminMilestones(),
      });
    },
  });
}

export function submitFitnessMilestoneEvidenceMutationOptions(
  client: Pick<ApiClient, "fitness">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      milestoneDefinitionId,
      payload,
    }: {
      milestoneDefinitionId: string;
      payload: SubmitFitnessMilestoneEvidenceInput;
    }) => client.fitness.submitMilestoneEvidence(milestoneDefinitionId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.fitnessAdminMilestoneEvidence(),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.fitnessMilestones(),
      });
    },
  });
}

export function reviewFitnessMilestoneEvidenceMutationOptions(
  client: Pick<ApiClient, "fitness">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      evidenceSubmissionId,
      payload,
    }: {
      evidenceSubmissionId: string;
      payload: ReviewFitnessMilestoneEvidenceInput;
    }) => client.fitness.reviewMilestoneEvidence(evidenceSubmissionId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.fitnessAdminMilestoneEvidence(),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.fitnessAdminMilestones(),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.fitnessMilestones(),
        }),
      ]);
    },
  });
}

export function claimFitnessMilestoneMutationOptions(
  client: Pick<ApiClient, "fitness">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      milestoneDefinitionId,
    }: {
      milestoneDefinitionId: string;
      userId?: string;
    }) => client.fitness.claimMilestone(milestoneDefinitionId),
    onSuccess: async (_data, variables) => {
      await invalidateFitnessQueries(queryClient, variables.userId);
    },
  });
}

export function fitnessIntegritySummaryQueryOptions(
  client: Pick<ApiClient, "fitness">,
  userId?: string,
) {
  return queryOptions({
    queryKey: queryKeys.fitnessIntegritySummary(userId),
    queryFn: async () => {
      if (!userId) return null;
      return client.fitness.getIntegritySummary();
    },
  });
}

export function fitnessPlanDetailQueryOptions(
  client: Pick<ApiClient, "fitness">,
  planId?: string,
) {
  return queryOptions({
    queryKey: queryKeys.fitnessPlanDetail(planId),
    queryFn: async () => {
      if (!planId) return null;
      return client.fitness.getPlanById(planId);
    },
  });
}

export function fitnessMuscleLeaderboardQueryOptions(
  client: Pick<ApiClient, "fitness">,
  userId: string | undefined,
  params: FitnessMuscleLeaderboardListParams,
) {
  return queryOptions({
    queryKey: queryKeys.fitnessMuscleLeaderboard(userId, params),
    queryFn: async () => {
      if (!userId) {
        return {
          data: [],
          meta: {
            page: 1,
            limit: params.limit ?? 0,
            total: 0,
            total_pages: 0,
          },
        };
      }
      return client.fitness.listMuscleLeaderboard(params);
    },
  });
}

export function fitnessSeasonHistoryQueryOptions(
  client: Pick<ApiClient, "fitness">,
  userId?: string,
  params?: FitnessSeasonHistoryListParams,
) {
  return queryOptions({
    queryKey: queryKeys.fitnessSeasonHistory(userId, params?.limit),
    queryFn: async () => {
      if (!userId) return [];
      return client.fitness.listSeasonHistory(params);
    },
  });
}

export function fitnessPlanProgressionQueryOptions(
  client: Pick<ApiClient, "fitness">,
  planId?: string,
) {
  return queryOptions({
    queryKey: queryKeys.fitnessPlanProgression(planId),
    queryFn: async () => {
      if (!planId) return [];
      return client.fitness.getPlanProgressionSuggestions(planId);
    },
  });
}

export function fitnessSessionsQueryOptions(
  client: Pick<ApiClient, "fitness">,
  userId?: string,
  params?: WorkoutSessionListParams,
) {
  return queryOptions({
    queryKey: queryKeys.fitnessSessions(userId, params),
    queryFn: async () => {
      if (!userId) {
        return {
          data: [],
          meta: {
            page: 1,
            limit: params?.limit ?? 0,
            total: 0,
            total_pages: 0,
          },
        };
      }
      return client.fitness.listSessions(params);
    },
  });
}

export function fitnessSessionDetailQueryOptions(
  client: Pick<ApiClient, "fitness">,
  sessionId?: string,
) {
  return queryOptions({
    queryKey: queryKeys.fitnessSessionDetail(sessionId),
    queryFn: async () => {
      if (!sessionId) return null;
      return client.fitness.getSessionById(sessionId);
    },
  });
}

export function fitnessPoseSessionQueryOptions(
  client: Pick<ApiClient, "fitness">,
  poseSessionId?: string,
) {
  return queryOptions({
    queryKey: queryKeys.fitnessPoseSession(poseSessionId),
    queryFn: async () => {
      if (!poseSessionId) return null;
      return client.fitness.getPoseSessionById(poseSessionId);
    },
  });
}

export function startWorkoutSessionMutationOptions(
  client: Pick<ApiClient, "fitness">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      input,
    }: {
      input: StartWorkoutSessionInput;
      userId?: string;
    }) => client.fitness.startSession(input),
    onSuccess: async (_data, variables) => {
      await invalidateFitnessQueries(queryClient, variables.userId);
    },
  });
}

export function logWorkoutSetMutationOptions(
  client: Pick<ApiClient, "fitness">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      sessionId,
      input,
    }: {
      input: LogWorkoutSetInput;
      sessionId: string;
      userId?: string;
    }) => client.fitness.logSet(sessionId, input),
    onSuccess: async (_data, variables) => {
      await invalidateFitnessQueries(
        queryClient,
        variables.userId,
        variables.sessionId,
      );
    },
  });
}

export function completeWorkoutSessionMutationOptions(
  client: Pick<ApiClient, "fitness">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({ sessionId }: { sessionId: string; userId?: string }) =>
      client.fitness.completeSession(sessionId),
    onSuccess: async (_data, variables) => {
      await invalidateFitnessQueries(
        queryClient,
        variables.userId,
        variables.sessionId,
      );
    },
  });
}

export function cancelWorkoutSessionMutationOptions(
  client: Pick<ApiClient, "fitness">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({ sessionId }: { sessionId: string; userId?: string }) =>
      client.fitness.cancelSession(sessionId),
    onSuccess: async (_data, variables) => {
      await invalidateFitnessQueries(
        queryClient,
        variables.userId,
        variables.sessionId,
      );
    },
  });
}

export function startPoseSessionMutationOptions(
  client: Pick<ApiClient, "fitness">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({ input }: { input: StartPoseSessionInput }) =>
      client.fitness.startPoseSession(input),
    onSuccess: async (data) => {
      await invalidateFitnessPoseQuery(queryClient, data.poseSessionId);
    },
  });
}

export function analyzePoseSessionMutationOptions(
  client: Pick<ApiClient, "fitness">,
) {
  return mutationOptions({
    mutationFn: ({
      poseSessionId,
      input,
    }: {
      input: AnalyzePoseSequenceInput;
      poseSessionId: string;
    }) => client.fitness.analyzePoseSession(poseSessionId, input),
  });
}

export function detectPoseEquipmentMutationOptions(
  client: Pick<ApiClient, "fitness">,
) {
  return mutationOptions({
    mutationFn: ({ input }: { input: DetectPoseEquipmentInput }) =>
      client.fitness.detectPoseEquipment(input),
  });
}

export function finalizePoseSessionMutationOptions(
  client: Pick<ApiClient, "fitness">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      poseSessionId,
      input,
    }: {
      input?: FinalizePoseSessionInput;
      poseSessionId: string;
    }) => client.fitness.finalizePoseSession(poseSessionId, input),
    onSuccess: async (data) => {
      await invalidateFitnessPoseQuery(queryClient, data.id);
    },
  });
}
