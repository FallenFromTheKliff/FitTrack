type BookingScope = "all" | "pending";

const adminKeys = {
  members: () => ["admin", "members"] as const,
  deletionRequests: () => ["admin", "deletion-requests"] as const,
  bookings: () => ["admin", "bookings"] as const,
  activeBookings: () => ["admin", "bookings", "active"] as const
};

const staffKeys = {
  dashboardStats: () => ["staff", "dashboard", "stats"] as const,
  bookings: (scope?: BookingScope) => scope ? ["staff", "bookings", scope] as const : ["staff", "bookings"] as const,
  bookingDetail: (bookingId?: string) => bookingId ? ["staff", "bookings", bookingId] as const : ["staff", "bookings", "detail"] as const,
  users: () => ["staff", "users"] as const,
  userDetail: (userId?: string) => userId ? ["staff", "users", userId] as const : ["staff", "users", "detail"] as const,
  coaches: () => ["staff", "coaches"] as const,
  coachDetail: (coachId?: string) => coachId ? ["staff", "coaches", coachId] as const : ["staff", "coaches", "detail"] as const
};

const memberKeys = {
  venues: (userId?: string) => userId ? ["venues", userId] as const : ["venues"] as const,
  venueDetail: (venueId?: string | number) => venueId != null ? ["venues", "detail", String(venueId)] as const : ["venues", "detail"] as const,
  venueAvailability: (venueId?: string | number, date?: string) =>
    venueId != null
      ? date
        ? ["venue-availability", String(venueId), date] as const
        : ["venue-availability", String(venueId)] as const
      : ["venue-availability"] as const,
  bookings: (userId?: string) => userId ? ["bookings", userId] as const : ["bookings"] as const,
  bookingDetail: (bookingId?: string) => bookingId ? ["bookings", "detail", bookingId] as const : ["bookings", "detail"] as const,
  appointments: (userId?: string) => userId ? ["appointments", userId] as const : ["appointments"] as const,
  appointmentDetail: (appointmentId?: string) => appointmentId ? ["appointments", "detail", appointmentId] as const : ["appointments", "detail"] as const,
  profileDeletionStatus: (userId?: string) => ["profile-deletion-status", userId ?? "guest"] as const
};

const coachKeys = {
  list: () => ["coaches"] as const,
  detail: (coachId?: string) => coachId ? ["coaches", coachId] as const : ["coaches", "detail"] as const,
  schedule: (userId?: string) => userId ? ["coach", "schedule", userId] as const : ["coach", "schedule"] as const,
  selfProfile: (userId?: string) => userId ? ["coach", "profile", userId] as const : ["coach", "profile"] as const,
  availability: (coachId?: string) => coachId ? ["coach-availability", coachId] as const : ["coach-availability"] as const,
  ownAvailability: (userId?: string) => userId ? ["coach", "availability", userId] as const : ["coach", "availability"] as const
};

export const queryKeys = {
  authUser: () => ["auth", "user"] as const,
  adminMembers: adminKeys.members,
  adminDeletionRequests: adminKeys.deletionRequests,
  adminBookings: adminKeys.bookings,
  adminActiveBookings: adminKeys.activeBookings,
  staffDashboardStats: staffKeys.dashboardStats,
  staffBookings: staffKeys.bookings,
  staffBookingDetail: staffKeys.bookingDetail,
  staffUsers: staffKeys.users,
  staffUserDetail: staffKeys.userDetail,
  staffCoaches: staffKeys.coaches,
  staffCoachDetail: staffKeys.coachDetail,
  venues: memberKeys.venues,
  venueDetail: memberKeys.venueDetail,
  venueAvailability: memberKeys.venueAvailability,
  bookings: memberKeys.bookings,
  bookingDetail: memberKeys.bookingDetail,
  appointments: memberKeys.appointments,
  appointmentDetail: memberKeys.appointmentDetail,
  profileDeletionStatus: memberKeys.profileDeletionStatus,
  coaches: coachKeys.list,
  coachDetail: coachKeys.detail,
  coachSchedule: coachKeys.schedule,
  coachSelfProfile: coachKeys.selfProfile,
  coachAvailability: coachKeys.availability,
  coachOwnAvailability: coachKeys.ownAvailability
};