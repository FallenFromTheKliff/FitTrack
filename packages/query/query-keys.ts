type BookingScope = "all" | "pending";
type StaffAppointmentFilters = {
  coachId?: string;
  endDate?: string;
  limit?: number;
  page?: number;
  startDate?: string;
  status?: string;
};

type RecurringPlanSessionsKey = {
  planId?: string;
};

type AiPaginationParams = {
  limit?: number;
  page?: number;
};

const adminKeys = {
  members: () => ["admin", "members"] as const,
  deletionRequests: () => ["admin", "deletion-requests"] as const,
  bookings: () => ["admin", "bookings"] as const,
  activeBookings: () => ["admin", "bookings", "active"] as const,
  gamificationOverview: () => ["admin", "gamification", "overview"] as const,
};

const staffKeys = {
  dashboardStats: () => ["staff", "dashboard", "stats"] as const,
  bookings: (scope?: BookingScope) =>
    scope
      ? (["staff", "bookings", scope] as const)
      : (["staff", "bookings"] as const),
  bookingDetail: (bookingId?: string) =>
    bookingId
      ? (["staff", "bookings", bookingId] as const)
      : (["staff", "bookings", "detail"] as const),
  appointments: (filters?: StaffAppointmentFilters) =>
    filters
      ? (["staff", "appointments", filters] as const)
      : (["staff", "appointments"] as const),
  users: () => ["staff", "users"] as const,
  userDetail: (userId?: string) =>
    userId
      ? (["staff", "users", userId] as const)
      : (["staff", "users", "detail"] as const),
  coaches: () => ["staff", "coaches"] as const,
  coachDetail: (coachId?: string) =>
    coachId
      ? (["staff", "coaches", coachId] as const)
      : (["staff", "coaches", "detail"] as const),
};

const memberKeys = {
  venues: (userId?: string) =>
    userId ? (["venues", userId] as const) : (["venues"] as const),
  archivedVenues: () => ["venues", "archived"] as const,
  venueDetail: (venueId?: string | number) =>
    venueId != null
      ? (["venues", "detail", String(venueId)] as const)
      : (["venues", "detail"] as const),
  venueAvailability: (venueId?: string | number, date?: string) =>
    venueId != null
      ? date
        ? (["venue-availability", String(venueId), date] as const)
        : (["venue-availability", String(venueId)] as const)
      : (["venue-availability"] as const),
  bookings: (userId?: string) =>
    userId ? (["bookings", userId] as const) : (["bookings"] as const),
  bookingDetail: (bookingId?: string) =>
    bookingId
      ? (["bookings", "detail", bookingId] as const)
      : (["bookings", "detail"] as const),
  appointments: (userId?: string) =>
    userId ? (["appointments", userId] as const) : (["appointments"] as const),
  appointmentDetail: (appointmentId?: string) =>
    appointmentId
      ? (["appointments", "detail", appointmentId] as const)
      : (["appointments", "detail"] as const),
  profileDeletionStatus: (userId?: string) =>
    ["profile-deletion-status", userId ?? "guest"] as const,
  attendanceQr: (userId?: string) =>
    ["attendance-qr", userId ?? "guest"] as const,
  membershipPlans: (params?: { limit?: number; page?: number }) =>
    params
      ? (["membership", "plans", params] as const)
      : (["membership", "plans"] as const),
  membershipCurrentSubscription: (userId?: string) =>
    userId
      ? (["membership", "current-subscription", userId] as const)
      : (["membership", "current-subscription"] as const),
  membershipPayments: (
    userId?: string,
    params?: {
      endDate?: string;
      limit?: number;
      page?: number;
      startDate?: string;
    },
  ) =>
    userId
      ? params
        ? (["membership", "payments", "mine", userId, params] as const)
        : (["membership", "payments", "mine", userId] as const)
      : params
        ? (["membership", "payments", "mine", params] as const)
        : (["membership", "payments", "mine"] as const),
  membershipReviewPayments: (filters?: {
    limit?: number;
    page?: number;
    payableType?: string;
    status?: string;
  }) =>
    filters
      ? (["membership", "payments", "review", filters] as const)
      : (["membership", "payments", "review"] as const),
};

const notificationKeys = {
  inbox: (
    userId?: string,
    params?: { limit?: number; page?: number; unreadOnly?: boolean },
  ) =>
    userId
      ? params
        ? (["notifications", "inbox", userId, params] as const)
        : (["notifications", "inbox", userId] as const)
      : params
        ? (["notifications", "inbox", params] as const)
        : (["notifications", "inbox"] as const),
  unreadCount: (userId?: string) =>
    userId
      ? (["notifications", "unread-count", userId] as const)
      : (["notifications", "unread-count"] as const),
  preferences: (userId?: string) =>
    userId
      ? (["notifications", "preferences", userId] as const)
      : (["notifications", "preferences"] as const),
};

const gymLayoutKeys = {
  equipment: () => ["gym-layout", "equipment"] as const,
  archivedEquipment: () => ["gym-layout", "equipment", "archived"] as const,
  floorPlanMedia: () => ["gym-layout", "floor-plans", "media"] as const,
};

const recurringCoachingPlanKeys = {
  sessions: (params?: RecurringPlanSessionsKey) =>
    params?.planId
      ? (["recurring-coaching-plans", params.planId, "sessions"] as const)
      : (["recurring-coaching-plans", "sessions"] as const),
};

const coachKeys = {
  list: () => ["coaches"] as const,
  detail: (coachId?: string) =>
    coachId
      ? (["coaches", coachId] as const)
      : (["coaches", "detail"] as const),
  schedule: (userId?: string) =>
    userId
      ? (["coach", "schedule", userId] as const)
      : (["coach", "schedule"] as const),
  selfProfile: (userId?: string) =>
    userId
      ? (["coach", "profile", userId] as const)
      : (["coach", "profile"] as const),
  availability: (coachId?: string) =>
    coachId
      ? (["coach-availability", coachId] as const)
      : (["coach-availability"] as const),
  ownAvailability: (userId?: string) =>
    userId
      ? (["coach", "availability", userId] as const)
      : (["coach", "availability"] as const),
};

const nutritionKeys = {
  active: (userId?: string) =>
    userId
      ? (["nutrition", "active", userId] as const)
      : (["nutrition", "active"] as const),
  history: (userId?: string, params?: { limit?: number; page?: number }) =>
    userId
      ? params
        ? (["nutrition", "history", userId, params] as const)
        : (["nutrition", "history", userId] as const)
      : params
        ? (["nutrition", "history", params] as const)
        : (["nutrition", "history"] as const),
  logs: (
    userId?: string,
    params?: {
      endDate?: string;
      limit?: number;
      page?: number;
      startDate?: string;
    },
  ) =>
    userId
      ? params
        ? (["nutrition", "logs", userId, params] as const)
        : (["nutrition", "logs", userId] as const)
      : params
        ? (["nutrition", "logs", params] as const)
        : (["nutrition", "logs"] as const),
  dailySummary: (userId?: string, date?: string) =>
    userId
      ? date
        ? (["nutrition", "daily-summary", userId, date] as const)
        : (["nutrition", "daily-summary", userId] as const)
      : date
        ? (["nutrition", "daily-summary", date] as const)
        : (["nutrition", "daily-summary"] as const),
};

const inventoryKeys = {
  products: (params?: {
    inStockOnly?: boolean;
    limit?: number;
    page?: number;
    search?: string;
  }) =>
    params
      ? (["inventory", "products", params] as const)
      : (["inventory", "products"] as const),
  productDetail: (productId?: string) =>
    productId
      ? (["inventory", "products", productId] as const)
      : (["inventory", "products", "detail"] as const),
  equipment: (params?: { limit?: number; page?: number }) =>
    params
      ? (["inventory", "equipment", params] as const)
      : (["inventory", "equipment"] as const),
  equipmentDetail: (equipmentId?: string) =>
    equipmentId
      ? (["inventory", "equipment", equipmentId] as const)
      : (["inventory", "equipment", "detail"] as const),
  sales: (params?: {
    endDate?: string;
    limit?: number;
    page?: number;
    startDate?: string;
  }) =>
    params
      ? (["inventory", "sales", params] as const)
      : (["inventory", "sales"] as const),
  saleDetail: (saleId?: string) =>
    saleId
      ? (["inventory", "sales", saleId] as const)
      : (["inventory", "sales", "detail"] as const),
  salesSummary: (params?: {
    endDate?: string;
    startDate?: string;
  }) =>
    params
      ? (["inventory", "sales", "summary", params] as const)
      : (["inventory", "sales", "summary"] as const),
  salesAnalytics: (period?: string) =>
    period
      ? (["inventory", "sales", "analytics", period] as const)
      : (["inventory", "sales", "analytics"] as const),
};

const analyticsKeys = {
  snapshot: () => ["analytics", "snapshot"] as const,
  overview: (params?: {
    endDate?: string;
    period?: string;
    startDate?: string;
  }) =>
    params
      ? (["analytics", "overview", params] as const)
      : (["analytics", "overview"] as const),
  revenue: (params?: {
    endDate?: string;
    period?: string;
    startDate?: string;
  }) =>
    params
      ? (["analytics", "revenue", params] as const)
      : (["analytics", "revenue"] as const),
  attendance: (params?: {
    endDate?: string;
    period?: string;
    startDate?: string;
  }) =>
    params
      ? (["analytics", "attendance", params] as const)
      : (["analytics", "attendance"] as const),
  members: (params?: {
    endDate?: string;
    period?: string;
    startDate?: string;
  }) =>
    params
      ? (["analytics", "members", params] as const)
      : (["analytics", "members"] as const),
  coaches: (params?: {
    endDate?: string;
    period?: string;
    startDate?: string;
  }) =>
    params
      ? (["analytics", "coaches", params] as const)
      : (["analytics", "coaches"] as const),
  insights: (params?: {
    focus?: string;
    limit?: number;
    page?: number;
    period?: string;
  }) =>
    params
      ? (["analytics", "insights", params] as const)
      : (["analytics", "insights"] as const),
  insightDetail: (insightId?: string) =>
    insightId
      ? (["analytics", "insights", insightId] as const)
      : (["analytics", "insights", "detail"] as const),
};

const fitnessKeys = {
  exercises: (params?: {
    category?: string;
    limit?: number;
    muscleGroup?: string;
    page?: number;
    search?: string;
  }) =>
    params
      ? (["fitness", "exercises", params] as const)
      : (["fitness", "exercises"] as const),
  exerciseReviewSubmissions: (params?: {
    limit?: number;
    page?: number;
    status?: string;
  }) =>
    params
      ? (["fitness", "exercise-review-submissions", params] as const)
      : (["fitness", "exercise-review-submissions"] as const),
  muscleDefinitions: (params?: { includeArchived?: boolean; search?: string }) =>
    params
      ? (["fitness", "muscle-definitions", params] as const)
      : (["fitness", "muscle-definitions"] as const),
  plans: (userId?: string, params?: { limit?: number; page?: number }) =>
    userId
      ? params
        ? (["fitness", "plans", userId, params] as const)
        : (["fitness", "plans", userId] as const)
      : params
        ? (["fitness", "plans", params] as const)
        : (["fitness", "plans"] as const),
  planDetail: (planId?: string) =>
    planId
      ? (["fitness", "plans", planId] as const)
      : (["fitness", "plans", "detail"] as const),
  sessions: (
    userId?: string,
    params?: {
      endDate?: string;
      limit?: number;
      page?: number;
      startDate?: string;
    },
  ) =>
    userId
      ? params
        ? (["fitness", "sessions", userId, params] as const)
        : (["fitness", "sessions", userId] as const)
      : params
        ? (["fitness", "sessions", params] as const)
        : (["fitness", "sessions"] as const),
  sessionDetail: (sessionId?: string) =>
    sessionId
      ? (["fitness", "sessions", sessionId] as const)
      : (["fitness", "sessions", "detail"] as const),
  mastery: (
    userId?: string,
    params?: { muscleGroup?: string; rank?: string },
  ) =>
    userId
      ? params
        ? (["fitness", "mastery", userId, params] as const)
        : (["fitness", "mastery", userId] as const)
      : params
        ? (["fitness", "mastery", params] as const)
        : (["fitness", "mastery"] as const),
  leaderboard: (userId?: string, params?: { limit?: number; page?: number }) =>
    userId
      ? params
        ? (["fitness", "leaderboard", userId, params] as const)
        : (["fitness", "leaderboard", userId] as const)
      : params
        ? (["fitness", "leaderboard", params] as const)
        : (["fitness", "leaderboard"] as const),
  progressionProfile: (userId?: string) =>
    userId
      ? (["fitness", "progression-profile", userId] as const)
      : (["fitness", "progression-profile"] as const),
  progressionSources: (
    userId?: string,
    params?: {
      limit?: number;
      page?: number;
      sourceStatus?: string;
      sourceType?: string;
    },
  ) =>
    userId
      ? params
        ? (["fitness", "progression-sources", userId, params] as const)
        : (["fitness", "progression-sources", userId] as const)
      : params
        ? (["fitness", "progression-sources", params] as const)
        : (["fitness", "progression-sources"] as const),
  rankingProfile: (userId?: string) =>
    userId
      ? (["fitness", "ranking-profile", userId] as const)
      : (["fitness", "ranking-profile"] as const),
  seasonStanding: (userId?: string) =>
    userId
      ? (["fitness", "season-standing", userId] as const)
      : (["fitness", "season-standing"] as const),
  milestones: (userId?: string) =>
    userId
      ? (["fitness", "milestones", userId] as const)
      : (["fitness", "milestones"] as const),
  integritySummary: (userId?: string) =>
    userId
      ? (["fitness", "integrity-summary", userId] as const)
      : (["fitness", "integrity-summary"] as const),
  poseSession: (poseSessionId?: string) =>
    poseSessionId
      ? (["fitness", "pose", poseSessionId] as const)
      : (["fitness", "pose"] as const),
};

const aiKeys = {
  sessions: (params?: AiPaginationParams) =>
    params
      ? (["ai", "chat", "sessions", params] as const)
      : (["ai", "chat", "sessions"] as const),
  session: (sessionId?: string) =>
    sessionId
      ? (["ai", "chat", "session", sessionId] as const)
      : (["ai", "chat", "session"] as const),
  messages: (sessionId?: string, params?: AiPaginationParams) =>
    sessionId
      ? params
        ? (["ai", "chat", "messages", sessionId, params] as const)
        : (["ai", "chat", "messages", sessionId] as const)
      : (["ai", "chat", "messages"] as const),
};

export const queryKeys = {
  authUser: () => ["auth", "user"] as const,
  aiChatSessions: aiKeys.sessions,
  aiChatSession: aiKeys.session,
  aiChatMessages: aiKeys.messages,
  adminMembers: adminKeys.members,
  adminDeletionRequests: adminKeys.deletionRequests,
  adminBookings: adminKeys.bookings,
  adminActiveBookings: adminKeys.activeBookings,
  adminGamificationOverview: adminKeys.gamificationOverview,
  staffDashboardStats: staffKeys.dashboardStats,
  staffBookings: staffKeys.bookings,
  staffBookingDetail: staffKeys.bookingDetail,
  staffAppointments: staffKeys.appointments,
  staffUsers: staffKeys.users,
  staffUserDetail: staffKeys.userDetail,
  staffCoaches: staffKeys.coaches,
  staffCoachDetail: staffKeys.coachDetail,
  recurringCoachingPlanSessions: recurringCoachingPlanKeys.sessions,
  venues: memberKeys.venues,
  archivedVenues: memberKeys.archivedVenues,
  venueDetail: memberKeys.venueDetail,
  venueAvailability: memberKeys.venueAvailability,
  bookings: memberKeys.bookings,
  bookingDetail: memberKeys.bookingDetail,
  appointments: memberKeys.appointments,
  appointmentDetail: memberKeys.appointmentDetail,
  profileDeletionStatus: memberKeys.profileDeletionStatus,
  attendanceQr: memberKeys.attendanceQr,
  membershipPlans: memberKeys.membershipPlans,
  membershipCurrentSubscription: memberKeys.membershipCurrentSubscription,
  membershipPayments: memberKeys.membershipPayments,
  membershipReviewPayments: memberKeys.membershipReviewPayments,
  notificationInbox: notificationKeys.inbox,
  notificationUnreadCount: notificationKeys.unreadCount,
  notificationPreferences: notificationKeys.preferences,
  coaches: coachKeys.list,
  coachDetail: coachKeys.detail,
  coachSchedule: coachKeys.schedule,
  coachSelfProfile: coachKeys.selfProfile,
  coachAvailability: coachKeys.availability,
  coachOwnAvailability: coachKeys.ownAvailability,
  nutritionActive: nutritionKeys.active,
  nutritionHistory: nutritionKeys.history,
  nutritionLogs: nutritionKeys.logs,
  nutritionDailySummary: nutritionKeys.dailySummary,
  inventoryProducts: inventoryKeys.products,
  inventoryProductDetail: inventoryKeys.productDetail,
  inventoryEquipment: inventoryKeys.equipment,
  inventoryEquipmentDetail: inventoryKeys.equipmentDetail,
  inventorySales: inventoryKeys.sales,
  inventorySalesSummary: inventoryKeys.salesSummary,
  inventorySalesAnalytics: inventoryKeys.salesAnalytics,
  inventorySaleDetail: inventoryKeys.saleDetail,
  analyticsSnapshot: analyticsKeys.snapshot,
  analyticsOverview: analyticsKeys.overview,
  analyticsRevenue: analyticsKeys.revenue,
  analyticsAttendance: analyticsKeys.attendance,
  analyticsMembers: analyticsKeys.members,
  analyticsCoaches: analyticsKeys.coaches,
  analyticsInsights: analyticsKeys.insights,
  analyticsInsightDetail: analyticsKeys.insightDetail,
  fitnessExercises: fitnessKeys.exercises,
  fitnessExerciseReviewSubmissions: fitnessKeys.exerciseReviewSubmissions,
  fitnessMuscleDefinitions: fitnessKeys.muscleDefinitions,
  fitnessPlans: fitnessKeys.plans,
  fitnessPlanDetail: fitnessKeys.planDetail,
  fitnessSessions: fitnessKeys.sessions,
  fitnessSessionDetail: fitnessKeys.sessionDetail,
  fitnessMastery: fitnessKeys.mastery,
  fitnessLeaderboard: fitnessKeys.leaderboard,
  fitnessProgressionProfile: fitnessKeys.progressionProfile,
  fitnessRankingProfile: fitnessKeys.rankingProfile,
  fitnessSeasonStanding: fitnessKeys.seasonStanding,
  fitnessMilestones: fitnessKeys.milestones,
  fitnessIntegritySummary: fitnessKeys.integritySummary,
  fitnessPoseSession: fitnessKeys.poseSession,
  gymLayoutEquipment: gymLayoutKeys.equipment,
  gymLayoutArchivedEquipment: gymLayoutKeys.archivedEquipment,
  gymLayoutFloorPlanMedia: gymLayoutKeys.floorPlanMedia,
};
