import type { AxiosInstance } from "axios";
import { createAiApi } from "./domains/ai";
import { createAnalyticsApi } from "./domains/analytics";
import { createAuditApi } from "./domains/audit";
import { createAuthApi } from "./domains/auth";
import { createUsersApi } from "./domains/users";
import { createVenuesApi } from "./domains/venues";
import { createBookingsApi } from "./domains/bookings";
import { createAppointmentsApi } from "./domains/appointments";
import { createCoachesApi } from "./domains/coaches";
import { createAdminApi } from "./domains/admin";
import { createFitnessApi } from "./domains/fitness";
import { createFilesApi } from "./domains/files";
import { createGymKnowledgeApi } from "./domains/gym-knowledge";
import { createInventoryApi } from "./domains/inventory";
import { createMembershipApi } from "./domains/membership";
import { createNutritionApi } from "./domains/nutrition";
import { createNotificationsApi } from "./domains/notifications";
import { createRecurringCoachingPlansApi } from "./domains/recurring-coaching-plans";
import { createStaffApi } from "./domains/staff";
import { createGymLayoutApi } from "./domains/gym-layout";
import { resolveApiBaseUrl } from "./base-url";
import {
  createAxiosTransport,
  type ApiTransportConfig,
} from "./transport/createAxiosTransport";

export type { AuthEvents } from "./auth/auth-events";
export { createTokenStore } from "./auth/createTokenStore";
export type { KeyValueStorageAdapter } from "./auth/createTokenStore";
export type { Awaitable, TokenSet, TokenStore } from "./auth/token-store";
export { ApiClientError, toApiClientError } from "./errors/api-client-error";
export type { ApiClientErrorKind } from "./errors/api-client-error";
export { resolveApiBaseUrl } from "./base-url";
export { createAxiosTransport } from "./transport/createAxiosTransport";
export type {
  ApiTransport,
  ApiTransportConfig,
} from "./transport/createAxiosTransport";
export type {
  AiChatMessageRecord,
  AiChatRequest,
  AiChatResponse,
  AiChatSessionRecord,
  AiGeneratePlanInput,
  AiTrainingPlanDetailRecord,
  AiPaginationParams,
} from "./domains/ai";
export type {
  AuditActorRecord,
  AuditLogListParams,
  AuditLogRecord,
} from "./domains/audit";
export type {
  AnalyticsAttendancePeakHourRecord,
  AnalyticsAttendanceRecord,
  AnalyticsCoachesRecord,
  AnalyticsDailyInsightsRecord,
  AnalyticsPdfExportResult,
  AnalyticsMembersRecord,
  AnalyticsOverviewRecord,
  AnalyticsPaginatedResult,
  AnalyticsPerformanceKpisRecord,
  AnalyticsPeriod,
  AnalyticsQueryParams,
  AnalyticsRecentActivityRecord,
  AnalyticsRevenueRecord,
  AnalyticsRevenueTotalsRecord,
  AnalyticsSnapshotRecord,
  AnalyticsSystemAlertRecord,
  AnalyticsTopRevenueSourceRecord,
  BusinessInsightFocus,
  BusinessInsightHistoryParams,
  BusinessInsightPeriod,
  BusinessInsightRunDetailRecord,
  BusinessInsightRunSummaryRecord,
  ExportAnalyticsPdfInput,
  GenerateBusinessInsightInput,
} from "./domains/analytics";
export type {
  ChangePasswordPayload,
  ForgotPasswordPayload,
  LoginCredentials,
  LoginOtpResponse,
  LoginSuccessResponse,
  LoginUserResponse,
  LogoutPayload,
  RegisterPayload,
  RegisterResponse,
  ResetPasswordPayload,
  VerifyCurrentPasswordPayload,
  VerifyResetOtpPayload,
  VerifyEmailPayload,
} from "./domains/auth";
export type {
  AppointmentCheckoutResponse,
  AppointmentReviewSummary,
  AppointmentRecord,
  AppointmentPaymentProvider,
  AppointmentPaymentStage,
  CoachScheduleRecord,
  CreateAppointmentPayload,
} from "./domains/appointments";
export type {
  BookingBalancePaymentProvider,
  CreateBookingPayload,
  VenueBookingListParams,
  VenueBookingRecord,
} from "./domains/bookings";
export type {
  CoachReceivedReviewRecord,
  CoachAppointmentScheduleRecord,
  CoachAvailabilityResponse,
  CoachAvailabilitySlot,
  CoachListFilters,
  CreateCoachManagedAppointmentPayload,
  ReplaceCoachAvailabilityPayload,
  SubmitCoachAppointmentFeedbackPayload,
  SubmitCoachReviewPayload,
  UpdateCoachProfilePayload,
  UpsertCoachAvailabilityPayload,
} from "./domains/coaches";
export type {
  AdminMilestoneDefinitionListParams,
  AdminMilestoneDefinitionRecord,
  AdminMilestoneEvidenceListParams,
  AnalyzePoseSequenceInput,
  CreateExerciseDraftProposalInput,
  CreateExerciseReviewSubmissionInput,
  CreateFitnessExerciseInput,
  CreateTrainingPlanInput,
  CreateMuscleDefinitionInput,
  DetectPoseEquipmentInput,
  ExerciseHandShapeProfileRecord,
  ExerciseDraftProposalRecord,
  ExerciseReviewEvidenceRecord,
  ExerciseReviewSubmissionRecord,
  ExerciseLogRecord,
  ExerciseReviewSubmissionStatus,
  ExerciseMovementProfileRecord,
  ExerciseMuscleTargetRecord,
  ExerciseMuscleTargetRole,
  ExerciseRigKeyframeKind,
  FinalizePoseSessionInput,
  FitnessAchievementReviewRecord,
  FitnessCreatorState,
  FitnessExerciseCategory,
  FitnessExerciseListParams,
  FitnessExerciseReviewSubmissionListParams,
  FitnessExerciseRecord,
  FitnessIntegritySummaryRecord,
  FitnessLeaderboardEntryRecord,
  FitnessLeaderboardListParams,
  FitnessMuscleLeaderboardEntryRecord,
  FitnessMuscleLeaderboardListParams,
  FitnessMilestoneListParams,
  FitnessMilestoneEvidenceSubmissionRecord,
  FitnessMilestoneProgressRecord,
  FitnessMasteryListParams,
  FitnessMasteryRank,
  FitnessPaginatedResult,
  FitnessProgressionProfileRecord,
  FitnessProgressionSourceListParams,
  FitnessProgressionSourceRecord,
  FitnessRankingGovernanceStatus,
  FitnessRankingProfileRecord,
  FitnessRankingVisibility,
  FitnessSeasonStandingRecord,
  FitnessSeasonHistoryListParams,
  FitnessSeasonHistoryRecord,
  MuscleDefinitionListParams,
  MuscleDefinitionRecord,
  LogWorkoutSetInput,
  MuscleMasteryRecord,
  PoseEquipmentDetectionRecord,
  PoseFrameAnalysisRecord,
  PoseKeypointRecord,
  PoseSessionRecord,
  ReviewFitnessMilestoneEvidenceInput,
  StartPoseSessionInput,
  StartedPoseSessionRecord,
  StartWorkoutSessionInput,
  SubmitFitnessMilestoneEvidenceInput,
  TrainingPlanListParams,
  UpdateFitnessRankingProfileInput,
  UpsertAdminMilestoneDefinitionInput,
  UpdateExerciseReviewSubmissionInput,
  UpdateFitnessExerciseInput,
  UpdateMuscleDefinitionInput,
  WorkoutSessionDetailRecord,
  WorkoutSessionListParams,
  WorkoutSessionSummaryRecord,
} from "./domains/fitness";
export type { UploadedFileRecord } from "./domains/files";
export type {
  CreateGymPromotionInput,
  GymKnowledgePaginationParams,
  GymProfileRecord,
  GymPromotionRecord,
  UpdateGymProfileInput,
} from "./domains/gym-knowledge";
export type {
  InventoryCreateSaleInput,
  InventoryEquipmentArchiveInput,
  InventoryEquipmentCreateInput,
  InventoryEquipmentDetailRecord,
  InventoryEquipmentListParams,
  InventoryEquipmentRecord,
  InventoryEquipmentUpdateInput,
  InventoryEquipmentWriteOffInput,
  InventoryEquipmentWriteOffRecord,
  InventoryAnalyticsPeriod,
  InventoryPaginatedResult,
  InventoryProductCategory,
  InventoryProductListParams,
  InventoryProductMutationInput,
  InventoryProductRecord,
  InventoryRestockInput,
  InventorySalesAnalyticsRecord,
  InventorySaleCheckoutRecord,
  InventorySaleListParams,
  InventorySaleSource,
  InventorySalesSummaryRecord,
  InventorySaleTransactionDetailRecord,
  InventorySaleTransactionSummaryRecord,
} from "./domains/inventory";
export type {
  CancelMembershipInput,
  CreateMembershipPlanInput,
  MembershipCardPurchaseRecord,
  ManualMembershipPaymentInput,
  MembershipCheckoutRecord,
  MembershipOperationsDashboardRecord,
  MembershipPaymentDetailsRecord,
  MembershipPaymentHistoryParams,
  MembershipPaymentRecord,
  MembershipPaymentReviewFilters,
  MembershipPlanListParams,
  MembershipPlanRecord,
  MembershipSubscriptionRecord,
  PaginatedResult,
  PurchaseMembershipCardInput,
  SubscribeToMembershipInput,
  UpdateMembershipPlanInput,
  VerifyMembershipPaymentInput,
} from "./domains/membership";
export type {
  MarkAllNotificationsReadResult,
  DeleteAllNotificationsResult,
  NotificationInboxResult,
  NotificationListParams,
  NotificationPreferencesRecord,
  NotificationPreferencesUpdateInput,
  NotificationRecord,
  NotificationUnreadCountRecord,
} from "./domains/notifications";
export type {
  BulkUpdateRecurringCoachingSessionsInput,
  RecurringCoachingBillingCyclePaymentInput,
  RecurringCoachingBillingCyclePaymentResult,
  RecurringCoachingBillingCycleRecord,
  RecurringCoachingBillingCycleStatus,
  RecurringCoachingFrequency,
  RecurringCoachingPlanInput,
  RecurringCoachingPlanMutationResult,
  RecurringCoachingPlanPreviewResult,
  RecurringCoachingPlanRecord,
  RecurringCoachingPlanSessionRecord,
  RecurringCoachingPlanStatus,
  RecurringCoachingScheduleItemInput,
  RecurringCoachingScheduleItemRecord,
  RecurringCoachingPreviewSession,
  RecurringCoachingSessionOverrideInput,
  RecurringCoachingSessionState,
  UpdateRecurringCoachingSessionInput,
} from "./domains/recurring-coaching-plans";
export type {
  CreateNutritionLogPayload,
  NutritionHistoryParams,
  NutritionLogListParams,
  RecalculateNutritionPayload,
  UpdateNutritionLogPayload,
} from "./domains/nutrition";
export type {
  FacilityFloorPlanMediaMutationInput,
  FacilityFloorPlanMediaRecord,
  GymLayoutEquipmentMutationInput,
  GymLayoutEquipmentRecord,
} from "./domains/gym-layout";
export type {
  CreateStaffCoachBookingPayload,
  CreateStaffCoachPayload,
  CreateStaffVenueBookingPayload,
  StaffAppointmentListParams,
  StaffAppointmentRecord,
  StaffCoachAvailabilityPayload,
} from "./domains/staff";
export type {
  AppFeedbackRecord,
  AttendanceQrCodeResponse,
  PrivacyAcceptanceResponse,
  SubmitAppFeedbackPayload,
  UpdateUserPhonePayload,
  UpdateUserProfilePayload,
  UploadUserAvatarResponse,
  UserProfileResponse,
} from "./domains/users";
export type {
  SubmitVenueFeedbackPayload,
  VenueAvailabilityRecord,
  VenueFeedbackRecord,
  VenueMutationPayload,
} from "./domains/venues";
export type {
  AdminGamificationCreatorStateInput,
  AdminGamificationCreatorStateRecord,
  AdminGamificationIntegrityCaseMutationRecord,
  AdminGamificationIntegrityResolutionInput,
  AdminGamificationMuscleLeaderboardListParams,
  AdminGamificationOverviewRecord,
  AdminGamificationRankingOverrideInput,
  AdminGamificationRankingOverrideRecord,
  AdminGamificationSeasonGovernanceRecord,
  AdminGamificationSeasonCreateInput,
  AdminGamificationSeasonStandingListParams,
  AdminGamificationSeasonStandingRecord,
  AdminGamificationSeasonSummaryRecord,
  AdminGamificationSeasonStatusInput,
  AdminGamificationSeasonUpdateInput,
  AdminManualExpGrantInput,
  AdminProgressionGrantRecord,
  ManualAttendanceCheckInInput,
  RestoreUserResult,
  ReviewDeletionPayload,
  ScanAttendanceQrInput,
  UpdateMemberPayload,
  UpdateMembershipCardPayload,
  UpgradeToCoachPayload,
} from "./domains/admin";

type CreateApiClientConfig =
  | (Omit<ApiTransportConfig, "baseURL"> & {
      baseURL?: string | null;
      fallbackBaseURL?: string;
    })
  | {
      transport: AxiosInstance;
    };

export function createApiClient(config: CreateApiClientConfig) {
  const transport =
    "transport" in config
      ? config.transport
      : createAxiosTransport({
          ...config,
          baseURL: resolveApiBaseUrl(config.baseURL, config.fallbackBaseURL),
        });

  return {
    transport,
    ai: createAiApi(transport),
    analytics: createAnalyticsApi(transport),
    audit: createAuditApi(transport),
    auth: createAuthApi(transport),
    users: createUsersApi(transport),
    venues: createVenuesApi(transport),
    bookings: createBookingsApi(transport),
    appointments: createAppointmentsApi(transport),
    coaches: createCoachesApi(transport),
    admin: createAdminApi(transport),
    fitness: createFitnessApi(transport),
    files: createFilesApi(transport),
    gymKnowledge: createGymKnowledgeApi(transport),
    inventory: createInventoryApi(transport),
    gymLayout: createGymLayoutApi(transport),
    membership: createMembershipApi(transport),
    notifications: createNotificationsApi(transport),
    recurringCoachingPlans: createRecurringCoachingPlansApi(transport),
    nutrition: createNutritionApi(transport),
    staff: createStaffApi(transport),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
