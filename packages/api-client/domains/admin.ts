import type {
  AdminGamificationCreatorStateInput,
  AdminGamificationCreatorStateRecord,
  AdminGamificationIntegrityCaseMutationRecord,
  AdminGamificationIntegrityResolutionInput,
  AdminGamificationOverviewRecord,
  AdminGamificationRankingOverrideInput,
  AdminGamificationRankingOverrideRecord,
  AdminGamificationSeasonGovernanceRecord,
  AdminGamificationSeasonStandingListParams,
  AdminGamificationSeasonStandingRecord,
  AdminGamificationSeasonSummaryRecord,
  AdminGamificationSeasonStatusInput,
  AdminManualExpGrantInput,
  AdminProgressionGrantRecord,
  AttendanceCheckInRecord,
  CreateUserInput,
  MemberDirectoryFilters,
  MemberRecord,
  RestoreUserResult as RestoreUserResultType,
  UpdateMembershipCardInput,
} from "@fittrack/types";
import { normalizePhilippineMobileNumber } from "@fittrack/validators";
import type { ApiTransport } from "../transport/createAxiosTransport";
import {
  getListFromEnvelope,
  unwrapPaginatedResponse,
  unwrapResponse,
  unwrapVoidResponse,
} from "../request";
import {
  mapAmenityBookingToVenueBookingRecord,
  toVenueBookingListParams,
  type VenueBookingListParams,
} from "./bookings";

export type {
  AdminGamificationCreatorStateInput,
  AdminGamificationCreatorStateRecord,
  AdminGamificationIntegrityCaseMutationRecord,
  AdminGamificationIntegrityResolutionInput,
  AdminGamificationOverviewRecord,
  AdminGamificationRankingOverrideInput,
  AdminGamificationRankingOverrideRecord,
  AdminGamificationSeasonGovernanceRecord,
  AdminGamificationSeasonStandingListParams,
  AdminGamificationSeasonStandingRecord,
  AdminGamificationSeasonSummaryRecord,
  AdminGamificationSeasonStatusInput,
  AdminManualExpGrantInput,
  AdminProgressionGrantRecord,
};

export type ReviewDeletionPayload = {
  reviewNotes?: string;
};

export type UpgradeToCoachPayload = {
  bio?: string;
  certifications?: string[];
  hourlyRate: number;
  specialties: string[];
  userId: string;
  yearsExperience: number;
};

export type UpdateMemberPayload = {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  activityLevel?: string;
  fitnessGoal?: string;
  currentWeightKg?: number;
  heightCm?: number;
};

export type UpdateMembershipCardPayload = Omit<UpdateMembershipCardInput, "id">;
export type ManualAttendanceCheckInInput =
  import("@fittrack/types").ManualAttendanceCheckInInput;
export type ScanAttendanceQrInput =
  import("@fittrack/types").ScanAttendanceQrInput;
export type RestoreUserResult = RestoreUserResultType;
export type VerifyNonMemberResult = {
  message: string;
  user: Pick<MemberRecord, "emailVerified" | "id" | "status">;
};

type AdminGamificationOverviewApiRecord = {
  active_season: {
    archived_at: string | null;
    closed_at: string | null;
    disqualified_count: number;
    ends_at: string;
    hidden_count: number;
    id: string;
    standing_count: number;
    starts_at: string;
    status: AdminGamificationOverviewRecord["activeSeason"] extends infer T
      ? T extends { status: infer S }
        ? S
        : never
      : never;
    title: string;
  } | null;
  audit: {
    recent_actions: {
      action_type: AdminGamificationOverviewRecord["audit"]["recentActions"][number]["actionType"];
      created_at: string;
      id: string;
      integrity_case_id: string | null;
      progression_grant_id: string | null;
      rationale: string | null;
      season_id: string | null;
      target_name: string;
      target_user_id: string;
    }[];
    recent_correction_count: number;
  };
  creators: {
    approved_count: number;
    candidate_count: number;
    pending_review_count: number;
    profiles: {
      admin_notes: string | null;
      last_state_changed_at: string | null;
      member_name: string;
      published_submission_count: number;
      state: AdminGamificationOverviewRecord["creators"]["profiles"][number]["state"];
      state_label: string;
      submission_count: number;
      user_id: string;
    }[];
    revoked_count: number;
    suspended_count: number;
  };
  generated_at: string;
  integrity: {
    cases: {
      case_id: string;
      evidence_event_count: number;
      member_name: string;
      opened_at: string;
      risk_level: AdminGamificationOverviewRecord["integrity"]["cases"][number]["riskLevel"];
      status: AdminGamificationOverviewRecord["integrity"]["cases"][number]["status"];
      summary: string | null;
      user_id: string;
    }[];
    escalated_case_count: number;
    high_risk_profile_count: number;
    open_case_count: number;
  };
  rankings: {
    disqualified_profile_count: number;
    governed_profile_count: number;
    hidden_profile_count: number;
    profiles: {
      admin_note: string | null;
      display_alias: string | null;
      governance_status: AdminGamificationOverviewRecord["rankings"]["profiles"][number]["governanceStatus"];
      member_name: string;
      season_is_disqualified: boolean;
      season_is_hidden: boolean;
      updated_at: string;
      user_id: string;
      visibility: AdminGamificationOverviewRecord["rankings"]["profiles"][number]["visibility"];
    }[];
  };
};

type AdminSeasonGovernanceApiRecord = {
  archived_at: string | null;
  closed_at: string | null;
  season_id: string;
  status: AdminGamificationSeasonGovernanceRecord["status"];
  title: string;
};

type AdminGamificationSeasonListApiRecord = {
  archived_at: string | null;
  closed_at: string | null;
  disqualified_count: number;
  ends_at: string;
  hidden_count: number;
  id: string;
  standing_count: number;
  starts_at: string;
  status: AdminGamificationSeasonSummaryRecord["status"];
  title: string;
};

type AdminSeasonStandingApiRecord = {
  display_alias: string | null;
  governance_status: AdminGamificationSeasonStandingRecord["governanceStatus"];
  is_disqualified: boolean;
  is_hidden: boolean;
  last_earned_at: string | null;
  member_name: string;
  milestone_claimed_count: number;
  milestone_unlocked_count: number;
  rank_position: number | null;
  season_id: string;
  season_points: number;
  season_status: AdminGamificationSeasonStandingRecord["seasonStatus"];
  season_title: string;
  top_muscle: string | null;
  top_muscle_xp: number;
  total_xp: number;
  user_id: string;
  visibility: AdminGamificationSeasonStandingRecord["visibility"];
};

type AdminCreatorStateApiRecord = {
  admin_notes: string | null;
  last_state_changed_at: string | null;
  member_name: string;
  moderation_action_id: string | null;
  state: AdminGamificationCreatorStateRecord["state"];
  state_label: string;
  user_id: string;
};

type AdminRankingOverrideApiRecord = {
  admin_note: string | null;
  display_alias: string | null;
  governance_status: AdminGamificationRankingOverrideRecord["governanceStatus"];
  moderation_action_id: string;
  season_is_disqualified: boolean;
  season_is_hidden: boolean;
  user_id: string;
  visibility: AdminGamificationRankingOverrideRecord["visibility"];
};

type AdminIntegrityCaseMutationApiRecord = {
  case_id: string;
  moderation_action_id: string | null;
  open_case_count: number;
  risk_level: AdminGamificationIntegrityCaseMutationRecord["riskLevel"];
  status: AdminGamificationIntegrityCaseMutationRecord["status"];
  summary: string | null;
  user_id: string;
};

type AdminProgressionGrantApiRecord = {
  current_season_points: number;
  grant_id: string;
  grant_status: AdminProgressionGrantRecord["grantStatus"];
  moderation_action_id: string;
  moderation_action_type: AdminProgressionGrantRecord["moderationActionType"];
  total_xp: number;
  user_id: string;
};

function mapAdminGamificationOverview(
  record: AdminGamificationOverviewApiRecord,
): AdminGamificationOverviewRecord {
  return {
    generatedAt: record.generated_at,
    activeSeason: record.active_season
      ? {
          archivedAt: record.active_season.archived_at,
          closedAt: record.active_season.closed_at,
          disqualifiedCount: record.active_season.disqualified_count,
          endsAt: record.active_season.ends_at,
          hiddenCount: record.active_season.hidden_count,
          id: record.active_season.id,
          standingCount: record.active_season.standing_count,
          startsAt: record.active_season.starts_at,
          status: record.active_season.status,
          title: record.active_season.title,
        }
      : null,
    integrity: {
      openCaseCount: record.integrity.open_case_count,
      escalatedCaseCount: record.integrity.escalated_case_count,
      highRiskProfileCount: record.integrity.high_risk_profile_count,
      cases: record.integrity.cases.map((item) => ({
        caseId: item.case_id,
        evidenceEventCount: item.evidence_event_count,
        memberName: item.member_name,
        openedAt: item.opened_at,
        riskLevel: item.risk_level,
        status: item.status,
        summary: item.summary,
        userId: item.user_id,
      })),
    },
    rankings: {
      governedProfileCount: record.rankings.governed_profile_count,
      hiddenProfileCount: record.rankings.hidden_profile_count,
      disqualifiedProfileCount: record.rankings.disqualified_profile_count,
      profiles: record.rankings.profiles.map((profile) => ({
        adminNote: profile.admin_note,
        displayAlias: profile.display_alias,
        governanceStatus: profile.governance_status,
        memberName: profile.member_name,
        seasonIsDisqualified: profile.season_is_disqualified,
        seasonIsHidden: profile.season_is_hidden,
        updatedAt: profile.updated_at,
        userId: profile.user_id,
        visibility: profile.visibility,
      })),
    },
    creators: {
      approvedCount: record.creators.approved_count,
      candidateCount: record.creators.candidate_count,
      pendingReviewCount: record.creators.pending_review_count,
      revokedCount: record.creators.revoked_count,
      suspendedCount: record.creators.suspended_count,
      profiles: record.creators.profiles.map((profile) => ({
        adminNotes: profile.admin_notes,
        lastStateChangedAt: profile.last_state_changed_at,
        memberName: profile.member_name,
        publishedSubmissionCount: profile.published_submission_count,
        state: profile.state,
        stateLabel: profile.state_label,
        submissionCount: profile.submission_count,
        userId: profile.user_id,
      })),
    },
    audit: {
      recentCorrectionCount: record.audit.recent_correction_count,
      recentActions: record.audit.recent_actions.map((action) => ({
        actionType: action.action_type,
        createdAt: action.created_at,
        id: action.id,
        integrityCaseId: action.integrity_case_id,
        progressionGrantId: action.progression_grant_id,
        rationale: action.rationale,
        seasonId: action.season_id,
        targetName: action.target_name,
        targetUserId: action.target_user_id,
      })),
    },
  };
}

function mapAdminSeasonGovernance(
  record: AdminSeasonGovernanceApiRecord,
): AdminGamificationSeasonGovernanceRecord {
  return {
    archivedAt: record.archived_at,
    closedAt: record.closed_at,
    seasonId: record.season_id,
    status: record.status,
    title: record.title,
  };
}

function mapAdminGamificationSeason(
  record: AdminGamificationSeasonListApiRecord,
): AdminGamificationSeasonSummaryRecord {
  return {
    archivedAt: record.archived_at,
    closedAt: record.closed_at,
    disqualifiedCount: record.disqualified_count,
    endsAt: record.ends_at,
    hiddenCount: record.hidden_count,
    id: record.id,
    standingCount: record.standing_count,
    startsAt: record.starts_at,
    status: record.status,
    title: record.title,
  };
}

function mapAdminSeasonStanding(
  record: AdminSeasonStandingApiRecord,
): AdminGamificationSeasonStandingRecord {
  return {
    displayAlias: record.display_alias,
    governanceStatus: record.governance_status,
    isDisqualified: record.is_disqualified,
    isHidden: record.is_hidden,
    lastEarnedAt: record.last_earned_at,
    memberName: record.member_name,
    milestoneClaimedCount: record.milestone_claimed_count,
    milestoneUnlockedCount: record.milestone_unlocked_count,
    rankPosition: record.rank_position,
    seasonId: record.season_id,
    seasonPoints: record.season_points,
    seasonStatus: record.season_status,
    seasonTitle: record.season_title,
    topMuscle: record.top_muscle,
    topMuscleXp: record.top_muscle_xp,
    totalXp: record.total_xp,
    userId: record.user_id,
    visibility: record.visibility,
  };
}

function toAdminSeasonStandingParams(
  params?: AdminGamificationSeasonStandingListParams,
) {
  return {
    ...(params?.page !== undefined ? { page: params.page } : {}),
    ...(params?.limit !== undefined ? { limit: params.limit } : {}),
    ...(params?.seasonId ? { season_id: params.seasonId } : {}),
    ...(params?.muscleKey ? { muscle_key: params.muscleKey } : {}),
    ...(params?.search ? { search: params.search } : {}),
    ...(params?.visibility ? { visibility: params.visibility } : {}),
    ...(params?.governanceStatus
      ? { governance_status: params.governanceStatus }
      : {}),
    ...(params?.includeArchived ? { include_archived: true } : {}),
  };
}

function mapAdminCreatorState(
  record: AdminCreatorStateApiRecord,
): AdminGamificationCreatorStateRecord {
  return {
    adminNotes: record.admin_notes,
    lastStateChangedAt: record.last_state_changed_at,
    memberName: record.member_name,
    moderationActionId: record.moderation_action_id,
    state: record.state,
    stateLabel: record.state_label,
    userId: record.user_id,
  };
}

function mapAdminRankingOverride(
  record: AdminRankingOverrideApiRecord,
): AdminGamificationRankingOverrideRecord {
  return {
    adminNote: record.admin_note,
    displayAlias: record.display_alias,
    governanceStatus: record.governance_status,
    moderationActionId: record.moderation_action_id,
    seasonIsDisqualified: record.season_is_disqualified,
    seasonIsHidden: record.season_is_hidden,
    userId: record.user_id,
    visibility: record.visibility,
  };
}

function mapAdminIntegrityCaseMutation(
  record: AdminIntegrityCaseMutationApiRecord,
): AdminGamificationIntegrityCaseMutationRecord {
  return {
    caseId: record.case_id,
    moderationActionId: record.moderation_action_id,
    openCaseCount: record.open_case_count,
    riskLevel: record.risk_level,
    status: record.status,
    summary: record.summary,
    userId: record.user_id,
  };
}

function mapAdminProgressionGrant(
  record: AdminProgressionGrantApiRecord,
): AdminProgressionGrantRecord {
  return {
    currentSeasonPoints: record.current_season_points,
    grantId: record.grant_id,
    grantStatus: record.grant_status,
    moderationActionId: record.moderation_action_id,
    moderationActionType: record.moderation_action_type,
    totalXp: record.total_xp,
    userId: record.user_id,
  };
}

export function createAdminApi(transport: ApiTransport) {
  return {
    listMembers(params?: MemberDirectoryFilters) {
      return unwrapResponse<MemberRecord[]>(
        transport.get("/admin/users", { params }),
        "Unable to load members.",
      );
    },
    createUser(payload: CreateUserInput) {
      return unwrapResponse<{ user_id: string; email: string; role: string }>(
        transport.post("/admin/users", {
          email: payload.email,
          password: payload.password,
          first_name: payload.firstName,
          last_name: payload.lastName,
          role: payload.role,
          ...(payload.phone_no
            ? { phone: normalizePhilippineMobileNumber(payload.phone_no) }
            : {}),
        }),
        "Unable to create user account.",
      );
    },
    updateMember(id: string, payload: UpdateMemberPayload) {
      return unwrapVoidResponse(
        transport.patch(`/users/${id}`, {
          ...(payload.firstName !== undefined
            ? { first_name: payload.firstName }
            : {}),
          ...(payload.lastName !== undefined
            ? { last_name: payload.lastName }
            : {}),
          ...(payload.dateOfBirth !== undefined
            ? { date_of_birth: payload.dateOfBirth }
            : {}),
          ...(payload.gender !== undefined ? { gender: payload.gender } : {}),
          ...(payload.activityLevel !== undefined
            ? { activity_level: payload.activityLevel }
            : {}),
          ...(payload.fitnessGoal !== undefined
            ? { fitness_goal: payload.fitnessGoal }
            : {}),
          ...(payload.currentWeightKg !== undefined
            ? { weight_kg: payload.currentWeightKg }
            : {}),
          ...(payload.heightCm !== undefined
            ? { height_cm: payload.heightCm }
            : {}),
        }),
        "Unable to update member.",
      );
    },
    updateMembershipCard(id: string, payload: UpdateMembershipCardPayload) {
      return unwrapResponse<{
        membershipCard: MemberRecord["membershipCard"];
        message: string;
      }>(
        transport.patch(`/admin/users/${id}/membership-card`, {
          action: payload.action,
          ...(payload.reason !== undefined ? { reason: payload.reason } : {}),
          ...(payload.source !== undefined ? { source: payload.source } : {}),
        }),
        "Unable to update membership card access.",
      );
    },
    verifyNonMember(id: string) {
      return unwrapResponse<VerifyNonMemberResult>(
        transport.patch(`/admin/users/${id}/verify-non-member`, {}),
        "Unable to verify this account.",
      );
    },
    deleteUser(id: string) {
      return unwrapVoidResponse(
        transport.delete(`/admin/users/${id}`),
        "Unable to delete user.",
      );
    },
    restoreUser(id: string) {
      return unwrapResponse<RestoreUserResult>(
        transport.patch(`/admin/users/${id}/restore`, {}),
        "Unable to restore user.",
      );
    },
    async listDeletionRequests<T>() {
      const data = await unwrapResponse<{ requests?: T[] } | T[]>(
        transport.get("/admin/deletion-requests"),
        "Unable to load deletion requests.",
      );
      return getListFromEnvelope<T>(data, "requests");
    },
    approveDeletionRequest(id: string, payload?: ReviewDeletionPayload) {
      return unwrapVoidResponse(
        transport.patch(
          `/admin/deletion-requests/${id}/approve`,
          payload ?? {},
        ),
        "Unable to approve deletion request.",
      );
    },
    rejectDeletionRequest(id: string, payload?: ReviewDeletionPayload) {
      return unwrapVoidResponse(
        transport.patch(`/admin/deletion-requests/${id}/reject`, payload ?? {}),
        "Unable to reject deletion request.",
      );
    },
    upgradeToCoach(payload: UpgradeToCoachPayload) {
      return unwrapVoidResponse(
        transport.post("/admin/users/upgrade-to-coach", payload),
        "Unable to upgrade user to coach.",
      );
    },
    async listBookings<T>(params?: VenueBookingListParams) {
      const data = await unwrapResponse<T[]>(
        transport.get("/bookings/amenity", {
          params: toVenueBookingListParams({ limit: 100, ...params }),
        }),
        "Unable to load bookings.",
      );
      return data.map((record) =>
        mapAmenityBookingToVenueBookingRecord(record as never),
      ) as T[];
    },
    confirmBooking(bookingId: string) {
      return unwrapVoidResponse(
        transport.patch(`/admin/bookings/${bookingId}/confirm`, {}),
        "Unable to confirm booking.",
      );
    },
    rejectBooking(bookingId: string, reason?: string) {
      return unwrapVoidResponse(
        transport.patch(
          `/admin/bookings/${bookingId}/reject`,
          reason ? { reason } : {},
        ),
        "Unable to reject booking.",
      );
    },
    completeBooking(bookingId: string) {
      return unwrapVoidResponse(
        transport.patch(`/admin/bookings/${bookingId}/complete`, {}),
        "Unable to mark booking complete.",
      );
    },
    cancelBooking(bookingId: string, reason?: string) {
      return unwrapVoidResponse(
        transport.patch(
          `/admin/bookings/${bookingId}/cancel`,
          reason ? { reason } : {},
        ),
        "Unable to cancel booking.",
      );
    },
    noShowBooking(bookingId: string) {
      return unwrapVoidResponse(
        transport.patch(`/admin/bookings/${bookingId}/no-show`, {}),
        "Unable to mark booking no-show.",
      );
    },
    scanAttendanceQr(payload: ScanAttendanceQrInput) {
      return unwrapResponse<AttendanceCheckInRecord>(
        transport.post("/attendance/scan", {
          qrValue: payload.qrValue,
        }),
        "Unable to scan attendance QR.",
      );
    },
    manualAttendanceCheckIn(payload: ManualAttendanceCheckInInput) {
      return unwrapResponse<AttendanceCheckInRecord>(
        transport.post("/attendance/manual", {
          user_id: payload.userId,
        }),
        "Unable to manually check in this member.",
      );
    },
    async getGamificationOverview() {
      const data = await unwrapResponse<AdminGamificationOverviewApiRecord>(
        transport.get("/admin/gamification/overview"),
        "Unable to load gamification governance.",
      );
      return mapAdminGamificationOverview(data);
    },
    async listGamificationSeasons() {
      const data = await unwrapResponse<AdminGamificationSeasonListApiRecord[]>(
        transport.get("/admin/gamification/seasons"),
        "Unable to load gamification seasons.",
      );
      return data.map(mapAdminGamificationSeason);
    },
    async listGamificationSeasonStandings(
      params?: AdminGamificationSeasonStandingListParams,
    ) {
      const result = await unwrapPaginatedResponse<AdminSeasonStandingApiRecord>(
        transport.get("/admin/gamification/season-standings", {
          params: toAdminSeasonStandingParams(params),
        }),
        "Unable to load season standings.",
      );
      return {
        ...result,
        data: result.data.map(mapAdminSeasonStanding),
      };
    },
    async updateGamificationSeasonStatus(
      seasonId: string,
      payload: AdminGamificationSeasonStatusInput,
    ) {
      const data = await unwrapResponse<AdminSeasonGovernanceApiRecord>(
        transport.patch(`/admin/gamification/seasons/${seasonId}/status`, {
          status: payload.status,
          rationale: payload.rationale,
        }),
        "Unable to update gamification season.",
      );
      return mapAdminSeasonGovernance(data);
    },
    async updateGamificationCreatorState(
      userId: string,
      payload: AdminGamificationCreatorStateInput,
    ) {
      const data = await unwrapResponse<AdminCreatorStateApiRecord>(
        transport.patch(`/admin/gamification/creators/${userId}`, {
          state: payload.state,
          rationale: payload.rationale,
          ...(payload.adminNotes !== undefined
            ? { admin_notes: payload.adminNotes }
            : {}),
        }),
        "Unable to update creator governance.",
      );
      return mapAdminCreatorState(data);
    },
    async updateGamificationRankingOverride(
      userId: string,
      payload: AdminGamificationRankingOverrideInput,
    ) {
      const data = await unwrapResponse<AdminRankingOverrideApiRecord>(
        transport.patch(`/admin/gamification/ranking/${userId}`, {
          governance_status: payload.governanceStatus,
          ...(payload.rationale !== undefined
            ? { rationale: payload.rationale }
            : {}),
          ...(payload.adminNote !== undefined
            ? { admin_note: payload.adminNote }
            : {}),
        }),
        "Unable to update ranking governance.",
      );
      return mapAdminRankingOverride(data);
    },
    async createManualExpGrant(payload: AdminManualExpGrantInput) {
      const data = await unwrapResponse<AdminProgressionGrantApiRecord>(
        transport.post("/admin/gamification/manual-exp-grants", {
          user_id: payload.userId,
          amount: payload.amount,
          rationale: payload.rationale,
          ...(payload.muscleGroup !== undefined
            ? { muscle_group: payload.muscleGroup }
            : {}),
          ...(payload.appointmentId !== undefined
            ? { appointment_id: payload.appointmentId }
            : {}),
        }),
        "Unable to create manual EXP grant.",
      );
      return mapAdminProgressionGrant(data);
    },
    async resolveGamificationIntegrityCase(
      caseId: string,
      payload: AdminGamificationIntegrityResolutionInput,
    ) {
      const data = await unwrapResponse<AdminIntegrityCaseMutationApiRecord>(
        transport.patch(
          `/admin/gamification/integrity-cases/${caseId}/resolve`,
          {
            status: payload.status,
            rationale: payload.rationale,
          },
        ),
        "Unable to resolve integrity case.",
      );
      return mapAdminIntegrityCaseMutation(data);
    },
  };
}
