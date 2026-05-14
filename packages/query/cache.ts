import type { QueryClient } from "@tanstack/react-query";
import type { AuthUser } from "@fittrack/types";
import { queryKeys } from "./query-keys";

export function setAuthUserQueryData(
  queryClient: QueryClient,
  user: AuthUser | null,
) {
  queryClient.setQueryData<AuthUser | null>(queryKeys.authUser(), user);
}

export function patchAuthUserQueryData(
  queryClient: QueryClient,
  patch: Partial<AuthUser>,
) {
  queryClient.setQueryData<AuthUser | null>(
    queryKeys.authUser(),
    (previous) => {
      if (!previous) return previous;
      return { ...previous, ...patch };
    },
  );
}

export function setProfileDeletionStatusQueryData(
  queryClient: QueryClient,
  userId: string | undefined,
  status: "approved" | "none" | "pending",
) {
  queryClient.setQueryData(queryKeys.profileDeletionStatus(userId), status);
}

export function invalidateVenueQueries(
  queryClient: QueryClient,
  userId?: string,
) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.venues(userId) });
}

export function invalidateBookingQueries(
  queryClient: QueryClient,
  userId?: string,
) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.bookings(userId),
  });
}

export async function invalidateNotificationQueries(
  queryClient: QueryClient,
  userId?: string,
) {
  await queryClient.invalidateQueries({
    predicate: (query) => {
      const [scope, , queryUserId] = query.queryKey as [string, string?, string?];
      if (scope !== "notifications") return false;
      return !userId || queryUserId === userId || queryUserId === undefined;
    }
  });
}

export function invalidateGymLayoutQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.gymLayoutEquipment(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.gymLayoutFloorPlanMedia(),
    }),
  ]);
}

export function invalidateAiChatSessionsQuery(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.aiChatSessions(),
  });
}

export function invalidateAiChatSessionQuery(
  queryClient: QueryClient,
  sessionId?: string,
) {
  if (!sessionId) return Promise.resolve();
  return queryClient.invalidateQueries({
    queryKey: queryKeys.aiChatSession(sessionId),
  });
}

export function invalidateAiChatMessagesQuery(
  queryClient: QueryClient,
  sessionId?: string,
) {
  if (!sessionId) return Promise.resolve();
  return queryClient.invalidateQueries({
    queryKey: queryKeys.aiChatMessages(sessionId),
  });
}

export function invalidateAppointmentQueries(
  queryClient: QueryClient,
  userId?: string,
) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.appointments(userId),
  });
}

export async function invalidateMembershipQueries(
  queryClient: QueryClient,
  userId?: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.membershipPlans() }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.membershipOperationsDashboard(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.membershipCurrentSubscription(userId),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.membershipPayments(userId),
    }),
  ]);
}

export function invalidateCoachScheduleQueries(
  queryClient: QueryClient,
  userId?: string,
) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.coachSchedule(userId),
  });
}

export function invalidateProfileDeletionStatusQuery(
  queryClient: QueryClient,
  userId?: string,
) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.profileDeletionStatus(userId),
  });
}

export function invalidateAttendanceQrQuery(
  queryClient: QueryClient,
  userId?: string,
) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.attendanceQr(userId),
  });
}

export function invalidateAdminMembersQuery(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.adminMembers() });
}

export function invalidateAdminDeletionRequestsQuery(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.adminDeletionRequests(),
  });
}

export function invalidateAdminBookingsQuery(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.adminBookings() });
}

export function invalidateAdminGamificationOverviewQuery(
  queryClient: QueryClient,
) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.adminGamificationOverview(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.adminGamificationSeasons(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.adminGamificationSeasonStandings(),
    }),
  ]);
}

export function invalidateAdminMembershipPaymentQueries(
  queryClient: QueryClient,
) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.membershipReviewPayments(),
  });
}

export async function invalidateStaffBookingQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.staffBookings("all") }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.staffBookings("pending"),
    }),
    queryClient.invalidateQueries({ queryKey: queryKeys.adminBookings() }),
  ]);
}

export async function invalidateStaffCoachManagementQueries(
  queryClient: QueryClient,
  coachId?: string,
) {
  const tasks = [
    queryClient.invalidateQueries({ queryKey: queryKeys.staffAppointments() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.staffCoaches() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.recurringCoachingPlanSessions() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.coaches() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.appointments() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.coachSchedule() }),
  ];

  if (coachId) {
    tasks.push(
      queryClient.invalidateQueries({
        queryKey: queryKeys.staffCoachDetail(coachId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.coachDetail(coachId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.coachAvailability(coachId),
      }),
    );
  }

  await Promise.all(tasks);
}

export async function invalidateCoachQueries(
  queryClient: QueryClient,
  userId?: string,
  coachId?: string,
) {
  const tasks = [
    queryClient.invalidateQueries({ queryKey: queryKeys.coaches() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.staffCoaches() }),
  ];
  if (userId) {
    tasks.push(
      queryClient.invalidateQueries({
        queryKey: queryKeys.coachSelfProfile(userId),
      }),
    );
    tasks.push(
      queryClient.invalidateQueries({
        queryKey: queryKeys.coachSchedule(userId),
      }),
    );
  }
  if (coachId) {
    tasks.push(
      queryClient.invalidateQueries({
        queryKey: queryKeys.coachAvailability(coachId),
      }),
    );
  }
  await Promise.all(tasks);
}

export function invalidateNutritionQueries(
  queryClient: QueryClient,
  userId?: string,
) {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const [scope, , queryUserId] = query.queryKey as [
        string,
        string?,
        string?,
      ];
      if (scope !== "nutrition") return false;
      return !userId || queryUserId === undefined || queryUserId === userId;
    },
  });
}

export async function invalidateInventoryQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.inventoryProducts() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.inventoryEquipment() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.inventorySales() }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.inventorySalesSummary(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.inventorySalesAnalytics(),
    }),
  ]);
}

export async function invalidateAnalyticsQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.analyticsSnapshot() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.analyticsOverview() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.analyticsRevenue() }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.analyticsAttendance(),
    }),
    queryClient.invalidateQueries({ queryKey: queryKeys.analyticsMembers() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.analyticsCoaches() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.analyticsInsights() }),
  ]);
}

export async function invalidateFitnessQueries(
  queryClient: QueryClient,
  userId?: string,
  sessionId?: string,
) {
  const tasks = [
    queryClient.invalidateQueries({
      queryKey: queryKeys.fitnessExercises(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.fitnessExerciseReviewSubmissions(),
    }),
    queryClient.invalidateQueries({
      predicate: (query) => {
        const [scope, area, queryUserId] = query.queryKey as [
          string,
          string?,
          string?,
        ];
        if (scope !== "fitness") return false;
        if (
          area !== "plans" &&
          area !== "sessions" &&
          area !== "mastery" &&
          area !== "leaderboard" &&
          area !== "progression-profile" &&
          area !== "ranking-profile" &&
          area !== "season-standing" &&
          area !== "milestones" &&
          area !== "integrity-summary"
        ) {
          return false;
        }
        return !userId || queryUserId === undefined || queryUserId === userId;
      },
    }),
  ];
  if (sessionId) {
    tasks.push(
      queryClient.invalidateQueries({
        queryKey: queryKeys.fitnessSessionDetail(sessionId),
      }),
    );
  }
  await Promise.all(tasks);
}

export function invalidateFitnessPoseQuery(
  queryClient: QueryClient,
  poseSessionId?: string,
) {
  if (!poseSessionId) return Promise.resolve();
  return queryClient.invalidateQueries({
    queryKey: queryKeys.fitnessPoseSession(poseSessionId),
  });
}

export async function invalidateScheduleBookingsQuery(
  queryClient: QueryClient,
  mode: "admin" | "staff",
) {
  if (mode === "staff") {
    await invalidateStaffBookingQueries(queryClient);
    return;
  }
  await invalidateAdminBookingsQuery(queryClient);
}

export function clearScheduleBookingsQuery(
  queryClient: QueryClient,
  mode: "admin" | "staff",
) {
  if (mode === "staff") {
    queryClient.setQueryData(queryKeys.staffBookings("all"), null);
    return;
  }
  queryClient.setQueryData(queryKeys.adminBookings(), null);
}
