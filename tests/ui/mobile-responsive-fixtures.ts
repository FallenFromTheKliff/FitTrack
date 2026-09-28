import type { Page, Route } from "@playwright/test";

export const MOBILE_RESPONSIVE_BASE_URL =
  process.env.PLAYWRIGHT_MOBILE_BASE_URL ?? "http://127.0.0.1:8081";
export const FIXED_NOW = Date.parse("2026-09-08T04:00:00.000Z");
export const TODAY = "2026-09-08";

export const MEMBER_ID = "11111111-1111-4111-8111-111111111111";
export const COACH_ID = "22222222-2222-4222-8222-222222222222";
export const ACTIVE_PLAN_ID = "33333333-3333-4333-8333-333333333333";
export const CHAT_SESSION_ID = "44444444-4444-4444-8444-444444444444";
export const FACILITY_REGION_NAME = "Founders Strength Studio with Long Coaching Name";
export const FACILITY_EQUIPMENT_NAME = "Cable Station with Long Responsive Equipment Name";
export const WORKOUT_SESSION_ID = "73737373-7373-4737-8737-737373737373";
export const WORKOUT_LOG_ID = "74747474-7474-4747-8747-747474747474";

export type FixtureState = {
  consoleErrors: string[];
  pageErrors: string[];
  requestFailures: string[];
  mutations: Array<{ method: string; path: string; body: unknown }>;
  observedRequests: string[];
  unhandled: string[];
};

export type ResponsiveRole = "USER" | "COACH" | "ANON";

export type MemberResponsiveFixtureOptions = {
  facilityGallery?: string[];
  operatingHours?: Array<{
    closes_at: string;
    day_of_week: number;
    is_closed: boolean;
    label: string | null;
    opens_at: string;
  }>;
  feedbackHistoryCount?: number;
  feedbackPostDelayMs?: number;
  progressionSuggestionError?: boolean;
};

export type MemberRouteCase = {
  name: string;
  path: string;
  marker: string;
  markerKind?: "text" | "testId";
  bottomControl: string;
  bottomControlKind?: "button" | "textbox";
  expectedScroll: boolean;
};

export type CoachRouteCase = {
  name: string;
  path: string;
  marker: string;
  bottomControl: string;
  expectedScroll: boolean;
};

export const COACH_CLIENT_NAME =
  "Jordan Responsive Client With A Very Long Name";

export const COACH_ROUTE_MANIFEST: readonly CoachRouteCase[] = [
  {
    name: "coach-home",
    path: "/home",
    marker: "TODAY'S BOOKINGS",
    bottomControl: COACH_CLIENT_NAME,
    expectedScroll: true,
  },
  {
    name: "coach-appointments",
    path: "/bookings?coachView=appointments",
    marker: COACH_CLIENT_NAME,
    bottomControl: COACH_CLIENT_NAME,
    expectedScroll: true,
  },
  {
    name: "coach-clients",
    path: "/bookings?coachView=clients",
    marker: COACH_CLIENT_NAME,
    bottomControl: COACH_CLIENT_NAME,
    expectedScroll: true,
  },
  {
    name: "coach-earnings",
    path: "/bookings?coachView=earnings",
    marker: "EARNINGS SUMMARY",
    bottomControl: COACH_CLIENT_NAME,
    expectedScroll: true,
  },
];

export const COACH_SHARED_ROUTE_MANIFEST: readonly CoachRouteCase[] = [
  {
    name: "coach-chathistory",
    path: "/chathistory",
    marker: "Progress check-in",
    bottomControl: "Open quick actions menu",
    expectedScroll: true,
  },
  {
    name: "coach-chatbot",
    path: `/chatbot?sessionId=${CHAT_SESSION_ID}`,
    marker: "Progress check-in",
    bottomControl: "Type a message",
    expectedScroll: true,
  },
  {
    name: "coach-profile",
    path: "/profile",
    marker: "COACH SUMMARY",
    bottomControl: "Add availability slot",
    expectedScroll: true,
  },
  {
    name: "coach-settings",
    path: "/settings",
    marker: "PREFERENCES",
    bottomControl: "Help Center",
    expectedScroll: true,
  },
];

export type AuthRouteCase = {
  name: string;
  path: string;
  marker: string;
  bottomControl: string;
  expectedScroll: boolean;
};

export const AUTH_ROUTE_MANIFEST: readonly AuthRouteCase[] = [
  {
    name: "login",
    path: "/login",
    marker: "FitTrack",
    bottomControl: "Sign In",
    expectedScroll: true,
  },
  {
    name: "register",
    path: "/register",
    marker: "Create Account",
    bottomControl: "Create Account",
    expectedScroll: true,
  },
];

export const MEMBER_ROUTE_MANIFEST: readonly MemberRouteCase[] = [
  {
    name: "profile",
    path: "/profile",
    marker: "profile-screen",
    markerKind: "testId",
    bottomControl: "REQUEST ACCOUNT TERMINATION",
    expectedScroll: true,
  },
  {
    name: "settings",
    path: "/settings",
    marker: "PREFERENCES",
    bottomControl: "Help Center",
    expectedScroll: true,
  },
  {
    name: "chathistory",
    path: "/chathistory",
    marker: "Progress check-in",
    bottomControl: "Open quick actions menu",
    expectedScroll: true,
  },
  {
    name: "home",
    path: "/home",
    marker: "SCHEDULE FOR TODAY",
    bottomControl: "Open quick actions menu",
    expectedScroll: true,
  },
  {
    name: "nutrition",
    path: "/nutrition",
    marker: "TODAY'S CALORIES",
    bottomControl: "Open quick actions menu",
    expectedScroll: true,
  },
  {
    name: "mastery",
    path: "/mastery",
    marker: "mastery-screen",
    markerKind: "testId",
    bottomControl: "Open quick actions menu",
    expectedScroll: true,
  },
  {
    name: "workout",
    path: "/workout",
    marker: "Today's workout",
    bottomControl: "Open workout session history",
    expectedScroll: true,
  },
  {
    name: "workout-plans",
    path: "/workout-plans",
    marker: "Workout plans",
    bottomControl: "Create Personal Plan",
    expectedScroll: true,
  },
  {
    name: "chatbot",
    path: `/chatbot?sessionId=${CHAT_SESSION_ID}`,
    marker: "Progress check-in",
    bottomControl: "Type a message",
    bottomControlKind: "textbox",
    expectedScroll: true,
  },
  {
    name: "bookings",
    path: "/bookings",
    marker: FACILITY_REGION_NAME,
    bottomControl: "Open quick actions menu",
    expectedScroll: true,
  },
  {
    name: "assessments",
    path: "/assessments",
    marker: "Coach assessment",
    bottomControl: "Next page",
    expectedScroll: true,
  },
  {
    name: "facilities",
    path: "/facilities",
    marker: FACILITY_REGION_NAME,
    bottomControl: "Open quick actions menu",
    expectedScroll: true,
  },
];

export function newFixtureState(): FixtureState {
  return {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    mutations: [],
    observedRequests: [],
    unhandled: [],
  };
}

function apiResponse(data: unknown) {
  return JSON.stringify({ data });
}

function pageResponse(data: unknown[], url: URL, defaultLimit = 100) {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const limit = Math.max(1, Number(url.searchParams.get("limit") ?? String(defaultLimit)));
  const start = (page - 1) * limit;
  const records = data.slice(start, start + limit);
  return JSON.stringify({
    data: records,
    meta: {
      page,
      limit,
      total: data.length,
      total_pages: Math.ceil(data.length / limit),
    },
  });
}

async function fulfill(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    body: apiResponse(data),
    contentType: "application/json",
    status,
  });
}

async function fulfillPage(route: Route, data: unknown[], url: URL) {
  await route.fulfill({
    body: pageResponse(data, url),
    contentType: "application/json",
    status: 200,
  });
}

function profileRecord() {
  return {
    email: "responsive-member@fittrack.test",
    email_verified: true,
    has_accepted_privacy: true,
    id: MEMBER_ID,
    membership_card: {
      activated_at: "2026-09-01T00:00:00.000Z",
      purchased_at: "2026-09-01T00:00:00.000Z",
      source: "fixture",
      status: "active",
      verified_at: "2026-09-01T00:00:00.000Z",
    },
    phone_no: "+639171234567",
    profile: {
      activity_level: "moderate",
      date_of_birth: "1994-05-20",
      first_name: "Alexandria",
      gender: "female",
      height_cm: 165,
      last_name: "Responsive-Member-With-A-Long-Name",
      fitness_goal: "maintenance",
      weight_kg: 60,
    },
    role: "USER",
    status: "active",
  };
}

function coachProfileRecord() {
  return {
    email: "responsive-coach@fittrack.test",
    email_verified: true,
    has_accepted_privacy: true,
    id: COACH_ID,
    membership_card: {
      activated_at: "2026-09-01T00:00:00.000Z",
      purchased_at: "2026-09-01T00:00:00.000Z",
      source: "fixture",
      status: "active",
      verified_at: "2026-09-01T00:00:00.000Z",
    },
    phone_no: "+639171234568",
    profile: {
      activity_level: "active",
      date_of_birth: "1988-02-14",
      first_name: "Alexandra",
      gender: "female",
      height_cm: 170,
      last_name: "Coach-With-A-Very-Long-Responsive-Name",
      fitness_goal: "maintenance",
      weight_kg: 68,
    },
    role: "COACH",
    status: "active",
  };
}

function coachApiRecord() {
  return {
    average_rating: "4.9",
    availability_slots: [
      {
        day_of_week: 2,
        end_time: "12:00",
        id: "28282828-2828-4282-8282-282828282828",
        start_time: "08:00",
      },
      {
        day_of_week: 4,
        end_time: "18:00",
        id: "29292929-2929-4292-8292-292929292929",
        start_time: "14:00",
      },
    ],
    booked_dates: ["2026-09-12"],
    bio: "Part-time coach supporting long-term strength and mobility plans.",
    certification: "NSCA-CPT, Mobility Specialist",
    contact_email: "responsive-coach@fittrack.test",
    contact_phone: "+639171234568",
    display_name: "Alexandra Coach With A Very Long Responsive Name",
    hourly_rate: "1200",
    id: COACH_ID,
    is_available_for_booking: true,
    monthly_offer_active: true,
    monthly_offer_description: "A flexible part-time plan for consistent coaching.",
    monthly_rate: "12000",
    monthly_session_count: 8,
    monthly_session_duration_minutes: 60,
    profile: {
      first_name: "Alexandra",
      last_name: "Coach-With-A-Very-Long-Responsive-Name",
      avatar_url: null,
    },
    rating_count: 27,
    recent_reviews: [
      {
        comment: "Clear cues and a steady plan for the next block.",
        created_at: "2026-09-05T03:00:00.000Z",
        id: "30303030-3030-4030-8030-303030303030",
        rating: 5,
        reviewer_name: COACH_CLIENT_NAME,
      },
    ],
    schedule_type: "part_time",
    specialization: "Strength Coaching, Mobility Planning",
    specialties: [
      "Strength Coaching With A Long Specialty Name",
      "Mobility Planning",
    ],
    user: {
      email: "responsive-coach@fittrack.test",
      id: COACH_ID,
      profile: {
        first_name: "Alexandra",
        last_name: "Coach-With-A-Very-Long-Responsive-Name",
        avatar_url: null,
      },
    },
  };
}

function coachClientRelationships() {
  return [
    {
      coach_id: COACH_ID,
      created_at: "2026-08-15T03:00:00.000Z",
      ended_at: null,
      id: "31313131-3131-4131-8131-313131313131",
      member: {
        email: "responsive-member@fittrack.test",
        email_verified: true,
        id: MEMBER_ID,
        last_check_in_at: "2026-09-07T03:00:00.000Z",
        membership_card: { status: "active" },
        phone_no: "+639171234567",
        phone_verified: true,
        profile: {
          activity_level: "moderate",
          date_of_birth: "1994-05-20",
          first_name: "Jordan",
          fitness_goal: "maintenance",
          gender: "female",
          height_cm: 165,
          last_name: "Responsive Client With A Very Long Name",
          membership_type: "premium",
          weight_kg: 60,
        },
        status: "active",
        upcoming_sessions: [
          {
            duration_minutes: 60,
            id: "32323232-3232-4232-8232-323232323232",
            scheduled_at: "2026-09-12T05:00:00.000Z",
            status: "confirmed",
          },
        ],
      },
      member_id: MEMBER_ID,
      notes: "Responsive fixture client relationship with a populated history.",
      started_at: "2026-08-15T03:00:00.000Z",
      status: "active",
      updated_at: "2026-09-08T02:00:00.000Z",
    },
  ];
}

function coachScheduleRecords() {
  const member = {
    email: "responsive-member@fittrack.test",
    id: MEMBER_ID,
    profile: {
      first_name: "Jordan",
      last_name: "Responsive Client With A Very Long Name",
      avatar_url: null,
    },
  };
  return [
    {
      active_payment_id: "payment-coach-today",
      active_payment_provider: "paymongo",
      active_payment_status: "completed",
      assessment_report: "Completed assessment report with mobility and strength follow-up.",
      coach_earnings: "960",
      coach_feedback: "Keep the current cadence and add one recovery walk.",
      coach_id: COACH_ID,
      completed_at: null,
      created_at: "2026-09-07T03:00:00.000Z",
      duration_minutes: 60,
      id: "34343434-3434-4434-8434-343434343434",
      member_notes: "Today's focused strength session.",
      recurring_plan_id: null,
      review: null,
      scheduled_at: "2026-09-08T05:00:00.000Z",
      session_notes: "Today's session notes are ready for the coach queue.",
      status: "confirmed",
      total_amount: "1200",
      updated_at: "2026-09-08T02:00:00.000Z",
      user: member,
      user_id: MEMBER_ID,
    },
    {
      active_payment_id: "payment-coach-future",
      active_payment_provider: "paymongo",
      active_payment_status: "completed",
      assessment_report: null,
      coach_earnings: "960",
      coach_feedback: null,
      coach_id: COACH_ID,
      completed_at: null,
      created_at: "2026-09-08T02:00:00.000Z",
      duration_minutes: 60,
      id: "35353535-3535-4535-8535-353535353535",
      member_notes: "Future confirmed coaching appointment.",
      recurring_plan_id: null,
      review: null,
      scheduled_at: "2026-09-12T05:00:00.000Z",
      session_notes: null,
      status: "confirmed",
      total_amount: "1200",
      updated_at: "2026-09-08T02:00:00.000Z",
      user: member,
      user_id: MEMBER_ID,
    },
    {
      active_payment_id: "payment-coach-completed",
      active_payment_provider: "paymongo",
      active_payment_status: "completed",
      assessment_report: "Assessment report: improve single-leg control while maintaining stable tempo.",
      coach_earnings: "1000",
      coach_feedback: "Coach feedback: consistency is strong; log recovery between sessions.",
      coach_id: COACH_ID,
      completed_at: "2026-09-06T06:00:00.000Z",
      created_at: "2026-09-05T03:00:00.000Z",
      duration_minutes: 60,
      id: "36363636-3636-4636-8636-363636363636",
      member_notes: "Completed session notes covering squat depth and breathing.",
      recurring_plan_id: null,
      review: {
        comment: "Clear coaching and a useful plan for the next training block.",
        created_at: "2026-09-06T07:00:00.000Z",
        id: "37373737-3737-4737-8737-373737373737",
        rating: 5,
        updated_at: "2026-09-06T07:00:00.000Z",
      },
      scheduled_at: "2026-09-06T05:00:00.000Z",
      session_notes: "Completed session notes covering squat depth, breathing, and progression.",
      status: "completed",
      total_amount: "1250",
      updated_at: "2026-09-06T07:00:00.000Z",
      user: member,
      user_id: MEMBER_ID,
    },
  ];
}

function coachVenueWorkRecords() {
  return [
    {
      amenity: {
        capacity: 12,
        hourly_rate: "1400",
        id: "38383838-3838-4838-8838-383838383838",
        name: "Founders Strength Studio With A Very Long Venue Name",
      },
      amenity_id: "38383838-3838-4838-8838-383838383838",
      coach: {
        certification: "NSCA-CPT",
        contact_email: "responsive-coach@fittrack.test",
        display_name: "Alexandra Coach With A Very Long Responsive Name",
        hourly_rate: "1200",
        id: COACH_ID,
        is_available_for_booking: true,
        specialization: "Strength Coaching, Mobility Planning",
      },
      coach_amount: "1100",
      coach_id: COACH_ID,
      created_at: "2026-09-04T03:00:00.000Z",
      ends_at: "2026-09-07T06:00:00.000Z",
      id: "39393939-3939-4939-8939-393939393939",
      notes: "Completed venue coaching work with a populated member record.",
      product_kind: "venue_coach_addon",
      starts_at: "2026-09-07T05:00:00.000Z",
      status: "completed",
      total_amount: "1400",
      user: {
        email: "responsive-member@fittrack.test",
        id: MEMBER_ID,
        profile: {
          first_name: "Jordan",
          last_name: "Responsive Client With A Very Long Name",
        },
      },
      user_id: MEMBER_ID,
    },
  ];
}

function coachClientPlan() {
  const plan = activePlan();
  return {
    ...plan,
    coach_id: COACH_ID,
    id: ACTIVE_PLAN_ID,
    is_template: false,
    source: "coach_assigned",
    title: "Jordan's Long Responsive Coach Assigned Program",
    user_id: MEMBER_ID,
  };
}

function activePlan() {
  const exercise = {
    category: "strength",
    duration_seconds: null,
    exercise_id: "55555555-5555-4555-8555-555555555555",
    exercise_name: "Long Name Goblet Squat",
    id: "66666666-6666-4666-8666-666666666666",
    muscle_group: "quadriceps",
    notes: "Controlled tempo",
    order_index: 0,
    reps: 10,
    rest_seconds: 60,
    sets: 3,
    weight_kg_target: "18",
  };
  return {
    coach_id: null,
    created_at: "2026-09-01T00:00:00.000Z",
    days_per_week: 3,
    duration_weeks: 8,
    goal: "strength",
    id: ACTIVE_PLAN_ID,
    is_active: true,
    is_template: false,
    schedule_days: [
      {
        day_of_week: 2,
        exercises: [exercise],
        focus_label: "Full body strength",
        id: "77777777-7777-4777-8777-777777777777",
        is_rest_day: false,
        notes: null,
        week_number: 1,
      },
    ],
    source: "member",
    title: "Alexandria's 8 Week Strength Plan",
    updated_at: "2026-09-08T02:00:00.000Z",
    user_id: MEMBER_ID,
  };
}

function workoutPlansSummary() {
  const summary = { ...activePlan() };
  Reflect.deleteProperty(summary, "schedule_days");
  return {
    ...summary,
    source: "self_created",
    title: "Alexandria's Long Responsive Strength Plan",
  };
}

function workoutExerciseRecord() {
  return {
    aliases: [],
    category: "strength",
    created_at: "2026-08-01T00:00:00.000Z",
    description: "A controlled compound lift for the responsive workout fixture.",
    hand_shape_profile: null,
    id: "55555555-5555-4555-8555-555555555555",
    image_url: null,
    instructions: "Brace your core, move through a controlled range, and keep your knees aligned.",
    is_active: true,
    movement_contract_identity: {
      exercise_id: "55555555-5555-4555-8555-555555555555",
      family_key: "squat",
      revision: 1,
      source: "family",
      tracking_mode: "inherit",
    },
    movement_family: null,
    movement_profile: null,
    movement_profile_override: null,
    muscle_group: "Quadriceps",
    muscle_targets: [],
    name: "Long Name Goblet Squat",
    tracking_mode: "inherit",
    updated_at: "2026-09-08T02:00:00.000Z",
    video_url: null,
  };
}

function workoutSessionSummary() {
  return {
    cancelled_at: null,
    completed_at: null,
    created_at: "2026-09-08T02:00:00.000Z",
    duration_seconds: null,
    exercise_log_count: 1,
    id: WORKOUT_SESSION_ID,
    last_activity_at: "2026-09-08T03:00:00.000Z",
    plan: {
      goal: "strength",
      id: ACTIVE_PLAN_ID,
      source: "member",
      title: "Alexandria's 8 Week Strength Plan",
    },
    plan_id: ACTIVE_PLAN_ID,
    started_at: "2026-09-08T02:00:00.000Z",
    status: "in_progress",
    total_volume_kg: "18",
    updated_at: "2026-09-08T03:00:00.000Z",
    user_id: MEMBER_ID,
  };
}

function workoutSessionDetail() {
  return {
    ...workoutSessionSummary(),
    exercise_logs: [
      {
        created_at: "2026-09-08T02:30:00.000Z",
        duration_seconds: null,
        exercise_id: "55555555-5555-4555-8555-555555555555",
        exercise_name: "Long Name Goblet Squat",
        id: WORKOUT_LOG_ID,
        plan_exercise_id: "66666666-6666-4666-8666-666666666666",
        pose_session: null,
        reps_ai_counted: null,
        reps_completed: 10,
        session_id: WORKOUT_SESSION_ID,
        set_number: 1,
        updated_at: "2026-09-08T02:30:00.000Z",
        user_id: MEMBER_ID,
        weight_kg: "18",
      },
    ],
  };
}

function workoutProgressionSuggestions() {
  return [
    {
      action: "increase_load",
      confidence: "high",
      exercise_id: "55555555-5555-4555-8555-555555555555",
      exercise_name: "Long Name Goblet Squat",
      plan_exercise_id: "66666666-6666-4666-8666-666666666666",
      rationale: "Your recent completed sets were consistent, so a small load increase is ready for the next session.",
      source_revision: "history-rule-v2",
      suggested_reps: 10,
      suggested_weight_kg: 20,
    },
  ];
}

function notificationRecords() {
  return Array.from({ length: 7 }, (_, index) => ({
    body: `Your ${index % 2 ? "appointment" : "booking"} update is ready to review.`,
    channel: "in_app",
    created_at: `2026-09-08T0${index + 1}:00:00.000Z`,
    data: { source: "responsive-fixture", index },
    error: null,
    id: `88888888-8888-4888-8888-88888888888${index + 1}`,
    read_at: index > 1 ? "2026-09-08T03:00:00.000Z" : null,
    sent_at: `2026-09-08T0${index + 1}:00:00.000Z`,
    status: "sent",
    title: index % 2 ? "Appointment confirmed" : "Booking reminder",
    type: index % 2 ? "appointment_confirmed" : "booking_reminder",
    updated_at: `2026-09-08T0${index + 1}:00:00.000Z`,
  }));
}

function membershipPlan() {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    currency: "PHP",
    description: "Full gym access with coach and AI features.",
    duration_days: 30,
    features: { ai: true, coaching: true },
    id: "99999999-9999-4999-8999-999999999999",
    is_active: true,
    name: "Fitness Access",
    price: "1800",
    sort_order: 1,
    updated_at: "2026-08-01T00:00:00.000Z",
  };
}

function activeSubscription() {
  const plan = membershipPlan();
  return {
    cancellation_reason: null,
    cancelled_at: null,
    created_at: "2026-09-01T00:00:00.000Z",
    expires_at: "2026-10-01T00:00:00.000Z",
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    payment_id: null,
    plan,
    plan_id: plan.id,
    starts_at: "2026-09-01T00:00:00.000Z",
    status: "active",
    updated_at: "2026-09-01T00:00:00.000Z",
    user_id: MEMBER_ID,
    warned_1d_at: null,
    warned_3d_at: null,
    warned_7d_at: null,
  };
}

function leaderboard() {
  return [
    { avatar_url: null, display_name: "Alexandria Responsive", rank_position: 4, total_xp: 8400, user_id: MEMBER_ID },
    { avatar_url: null, display_name: "Jordan Athlete", rank_position: 1, total_xp: 14000, user_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" },
  ];
}

function aiSessions() {
  return Array.from({ length: 8 }, (_, index) => ({
    context_type: index % 2 ? "nutrition" : "general",
    created_at: `2026-09-0${Math.min(8, index + 1)}T01:00:00.000Z`,
    id: index === 0 ? CHAT_SESSION_ID : `eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee${index}`,
    is_active: index !== 6,
    last_activity_at: `2026-09-0${Math.min(8, index + 1)}T02:00:00.000Z`,
    title: index === 0 ? "Progress check-in" : `Nutrition and training thread ${index + 1}`,
    updated_at: `2026-09-0${Math.min(8, index + 1)}T02:00:00.000Z`,
    user_id: MEMBER_ID,
  }));
}

function aiSessionsForRole(role: ResponsiveRole) {
  return aiSessions().map((session) => ({
    ...session,
    user_id: role === "COACH" ? COACH_ID : MEMBER_ID,
  }));
}

function aiMessages(sessionId: string) {
  return [
    {
      action_triggered: null,
      content: "I completed my upper body session and want to keep the momentum.",
      created_at: "2026-09-08T01:00:00.000Z",
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      role: "user",
      session_id: sessionId,
      updated_at: "2026-09-08T01:00:00.000Z",
    },
    {
      action_triggered: null,
      content: "Nice work. Keep your next session steady and leave room for recovery.",
      created_at: "2026-09-08T01:01:00.000Z",
      id: "12121212-1212-4121-8121-121212121212",
      role: "assistant",
      session_id: sessionId,
      updated_at: "2026-09-08T01:01:00.000Z",
    },
  ];
}

function preferences() {
  return {
    ai_session_archived_email: true,
    appointment_cancelled_email: true,
    appointment_completed_email: true,
    appointment_confirmed_email: true,
    coach_appointment_reminder_email: true,
    booking_cancelled_email: true,
    booking_confirmed_email: true,
    booking_no_show_email: true,
    venue_booking_reminder_email: true,
    payment_confirmed_email: true,
    payment_failed_email: true,
    rank_up_email: true,
    subscription_expired_email: true,
    subscription_expiring_email: true,
    system_email: true,
  };
}

function homeVenueRecords() {
  const venues = [
    {
      capacity: 18,
      description: "A bright, reservable strength studio for coached training.",
      display_order: 1,
      floor_id: "floor-1",
      grid_column: 4,
      grid_height: 4,
      grid_row: 1,
      grid_width: 5,
      hourly_rate: "1200",
      icon_key: "gym-area",
      id: "55555555-5555-4555-8555-555555555555",
      image_crop_zoom: 1,
      image_fit: "cover",
      image_focal_x: 0.5,
      image_focal_y: 0.5,
      image_url: null,
      is_active: true,
      is_mapped: true,
      is_reservable: true,
      minimum_hours: 1,
      name: "Founders Strength Studio with Long Coaching Name",
      requires_subscription: false,
      status: "available",
      type: "other",
    },
    {
      capacity: 12,
      description: "A reservable court beside the main training floor.",
      display_order: 2,
      floor_id: "floor-1",
      grid_column: 9,
      grid_height: 4,
      grid_row: 1,
      grid_width: 6,
      hourly_rate: "1200",
      icon_key: "basketball",
      id: "66666666-6666-4666-8666-666666666666",
      image_crop_zoom: 1,
      image_fit: "cover",
      image_focal_x: 0.5,
      image_focal_y: 0.5,
      image_url: null,
      is_active: true,
      is_mapped: true,
      is_reservable: true,
      minimum_hours: 1,
      name: "North Basketball Court and Conditioning Zone",
      requires_subscription: false,
      status: "available",
      type: "basketball_court",
    },
  ];
  return venues;
}

function homeBookingRecords() {
  const venue = homeVenueRecords()[0];
  const records = [
    {
      amenity: { capacity: venue.capacity, hourly_rate: venue.hourly_rate, id: venue.id, name: venue.name },
      amenity_id: venue.id,
      created_at: "2026-09-07T08:00:00.000Z",
      ends_at: "2026-09-08T07:00:00.000Z",
      id: "77777777-7777-4777-8777-777777777777",
      notes: "Today strength booking with a long reservation purpose for responsive layout review.",
      starts_at: "2026-09-08T06:00:00.000Z",
      status: "confirmed",
      total_amount: "1200",
      user: {
        email: "responsive-member@fittrack.test",
        id: MEMBER_ID,
        profile: { first_name: "Alexandria", last_name: "Responsive-Member-With-A-Long-Name" },
      },
      user_id: MEMBER_ID,
    },
    {
      amenity: { capacity: 12, hourly_rate: "1200", id: "66666666-6666-4666-8666-666666666666", name: "North Basketball Court and Conditioning Zone" },
      amenity_id: "66666666-6666-4666-8666-666666666666",
      created_at: "2026-09-06T08:00:00.000Z",
      ends_at: "2026-09-07T07:00:00.000Z",
      id: "88888888-8888-4888-8888-888888888888",
      notes: "Completed court booking",
      starts_at: "2026-09-07T06:00:00.000Z",
      status: "completed",
      total_amount: "1200",
      user_id: MEMBER_ID,
    },
    {
      amenity: { capacity: venue.capacity, hourly_rate: venue.hourly_rate, id: venue.id, name: venue.name },
      amenity_id: venue.id,
      created_at: "2026-09-08T08:00:00.000Z",
      ends_at: "2026-09-09T07:00:00.000Z",
      id: "99999999-9999-4999-8999-999999999999",
      notes: "Future studio reservation",
      starts_at: "2026-09-09T06:00:00.000Z",
      status: "confirmed",
      total_amount: "1200",
      user_id: MEMBER_ID,
    },
  ];
  return records;
}

function homeSessions() {
  return [
    {
      cancelled_at: null,
      completed_at: "2026-09-07T03:00:00.000Z",
      created_at: "2026-09-07T02:00:00.000Z",
      duration_seconds: 3600,
      exercise_log_count: 3,
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      last_activity_at: "2026-09-07T03:00:00.000Z",
      plan: { goal: "strength", id: ACTIVE_PLAN_ID, source: "member", title: "Alexandria's 8 Week Strength Plan" },
      plan_id: ACTIVE_PLAN_ID,
      started_at: "2026-09-07T02:00:00.000Z",
      status: "completed",
      total_volume_kg: "420",
      updated_at: "2026-09-07T03:00:00.000Z",
      user_id: MEMBER_ID,
    },
    {
      cancelled_at: null,
      completed_at: "2026-09-04T03:00:00.000Z",
      created_at: "2026-09-04T02:00:00.000Z",
      duration_seconds: 3000,
      exercise_log_count: 2,
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      last_activity_at: "2026-09-04T03:00:00.000Z",
      plan: { goal: "strength", id: ACTIVE_PLAN_ID, source: "member", title: "Alexandria's 8 Week Strength Plan" },
      plan_id: ACTIVE_PLAN_ID,
      started_at: "2026-09-04T02:10:00.000Z",
      status: "completed",
      total_volume_kg: "280",
      updated_at: "2026-09-04T03:00:00.000Z",
      user_id: MEMBER_ID,
    },
  ];
}

function memberAppointmentRecords() {
  const completed = [
    {
      assessmentReport: "Coach assessment with a detailed mobility and strength follow-up for the member.",
      coachFeedback: "Keep the current cadence and add one recovery walk before the next session.",
      coachName: "Coach Jordan with a Long Responsive Name",
      id: "51515151-5151-4515-8515-515151515151",
      review: {
        comment: "Clear coaching and a useful plan for the next training block.",
        id: "61616161-6161-4616-8616-616161616161",
        rating: 5,
      },
      scheduledAt: "2026-09-07T03:00:00.000Z",
      sessionNotes: "Completed session notes covering squat depth, breathing, and the next progression.",
    },
    {
      assessmentReport: "Assessment report: improve single-leg control while maintaining stable tempo.",
      coachName: "Coach Alexandria Assessment Review",
      id: "52525252-5252-4525-8525-525252525252",
      scheduledAt: "2026-09-06T03:00:00.000Z",
      sessionNotes: "Session notes: member completed all planned sets with controlled form.",
    },
    {
      coachFeedback: "Coach reply: your consistency is strong; keep logging recovery between sessions.",
      coachName: "Coach Samira Member Reply",
      id: "53535353-5353-4535-8535-535353535353",
      review: {
        comment: "The session was focused and easy to follow.",
        id: "62626262-6262-4626-8626-626262626262",
        rating: 4,
      },
      scheduledAt: "2026-09-05T03:00:00.000Z",
    },
    {
      assessmentReport: "A completed assessment report with a long summary for responsive card layout review.",
      coachName: "Coach Taylor Long Assessment Name",
      id: "54545454-5454-4545-8545-545454545454",
      scheduledAt: "2026-09-04T03:00:00.000Z",
    },
    {
      coachName: "Coach Morgan Ratings Follow-up",
      id: "55555555-5555-4555-8555-555555555555",
      review: {
        comment: "Great pacing and helpful cues throughout the appointment.",
        id: "63636363-6363-4636-8636-636363636363",
        rating: 5,
      },
      scheduledAt: "2026-09-03T03:00:00.000Z",
    },
  ];
  const future = {
    coachName: "Coach Future Confirmed Appointment",
    id: "56565656-5656-4565-8565-565656565656",
    scheduledAt: "2026-09-12T03:00:00.000Z",
    status: "confirmed",
  };
  return [
    ...completed.map((record) => ({
      active_payment_id: `payment-${record.id}`,
      active_payment_provider: "paymongo",
      active_payment_status: "completed",
      assessment_report: record.assessmentReport ?? null,
      coach: { display_name: record.coachName, hourly_rate: "1200" },
      coach_feedback: record.coachFeedback ?? null,
      coach_id: COACH_ID,
      duration_minutes: 60,
      id: record.id,
      member_notes: `Fixture appointment notes for ${record.coachName}.`,
      review: record.review
        ? {
            comment: record.review.comment,
            created_at: "2026-09-07T04:00:00.000Z",
            id: record.review.id,
            rating: record.review.rating,
            updated_at: "2026-09-07T04:00:00.000Z",
          }
        : null,
      scheduled_at: record.scheduledAt,
      session_notes: record.sessionNotes ?? null,
      status: "completed",
      total_amount: "1200",
    })),
    {
      active_payment_id: `payment-${future.id}`,
      active_payment_provider: "paymongo",
      active_payment_status: "completed",
      coach: { display_name: future.coachName, hourly_rate: "1200" },
      coach_id: COACH_ID,
      duration_minutes: 60,
      id: future.id,
      member_notes: "Future confirmed coach appointment for date-filter coverage.",
      scheduled_at: future.scheduledAt,
      status: future.status,
      total_amount: "1200",
    },
  ];
}

export const FACILITY_IMAGE_ONE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
export const FACILITY_IMAGE_TWO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p7sAAAAASUVORK5CYII=";

function gymLayoutSnapshot(options: MemberResponsiveFixtureOptions = {}) {
  const gallery = options.facilityGallery ?? [FACILITY_IMAGE_ONE, FACILITY_IMAGE_TWO];
  const operatingHours = options.operatingHours ?? [
    { day_of_week: 0, opens_at: "08:00", closes_at: "18:00", is_closed: false, label: "Sunday hours" },
    { day_of_week: 1, opens_at: "06:00", closes_at: "22:00", is_closed: false, label: "Weekday hours" },
    { day_of_week: 2, opens_at: "06:00", closes_at: "22:00", is_closed: false, label: "Weekday hours" },
    { day_of_week: 3, opens_at: "06:00", closes_at: "22:00", is_closed: false, label: "Weekday hours" },
    { day_of_week: 4, opens_at: "06:00", closes_at: "22:00", is_closed: false, label: "Weekday hours" },
    { day_of_week: 5, opens_at: "06:00", closes_at: "22:00", is_closed: false, label: "Weekday hours" },
    { day_of_week: 6, opens_at: "00:00", closes_at: "00:00", is_closed: true, label: null },
  ];
  const footprintCells = [
    { column: 1, row: 1 },
    { column: 2, row: 1 },
    { column: 3, row: 1 },
    { column: 4, row: 1 },
    { column: 5, row: 1 },
    { column: 6, row: 1 },
    { column: 7, row: 1 },
    { column: 8, row: 1 },
    { column: 1, row: 2 },
    { column: 2, row: 2 },
    { column: 3, row: 2 },
    { column: 4, row: 2 },
    { column: 5, row: 2 },
    { column: 6, row: 2 },
    { column: 7, row: 2 },
    { column: 8, row: 2 },
    { column: 1, row: 3 },
    { column: 2, row: 3 },
    { column: 3, row: 3 },
    { column: 4, row: 3 },
    { column: 5, row: 3 },
    { column: 6, row: 3 },
    { column: 7, row: 3 },
    { column: 8, row: 3 },
    { column: 1, row: 4 },
    { column: 2, row: 4 },
    { column: 3, row: 4 },
    { column: 4, row: 4 },
    { column: 5, row: 4 },
    { column: 6, row: 4 },
    { column: 7, row: 4 },
    { column: 8, row: 4 },
  ];
  const cells = {
    entry_cells: [{ column: 1, row: 2 }],
    exit_cells: [{ column: 8, row: 3 }],
    footprint_cells: footprintCells,
    path_cells: [{ column: 2, row: 2 }, { column: 3, row: 2 }, { column: 4, row: 2 }],
  };
  return {
    generated_at: "2026-09-08T04:00:00.000Z",
    operating_hours: operatingHours,
    floors: [
      {
        ...cells,
        equipment: [
          {
            created_at: "2026-08-01T00:00:00.000Z",
            floor_id: "floor-1",
            grid_column: 6,
            grid_height: 1,
            grid_row: 3,
            grid_width: 2,
            icon_key: "dumbbell",
            id: "64646464-6464-4646-8646-646464646464",
            image_url: null,
            inventory_item_id: "65656565-6565-4656-8656-656565656565",
            is_active: true,
            name: FACILITY_EQUIPMENT_NAME,
            position_x: 5,
            position_y: 2,
            placed_quantity: 1,
            remaining_placeable_quantity: 1,
            status: "available",
            type: "strength",
            updated_at: "2026-09-08T04:00:00.000Z",
            venue_id: null,
          },
        ],
        floor_id: "floor-1",
        grid_columns: 8,
        grid_rows: 4,
        image_url: null,
        regions: [
          {
            booking_block_reason: null,
            capacity: 18,
            description: "A reservable strength studio with a long description for mobile details layout review.",
            floor_id: "floor-1",
            grid_column: 2,
            grid_height: 1,
            grid_row: 3,
            grid_width: 3,
            hourly_rate: 1200,
            icon_key: "gym-area",
            id: "67676767-6767-4676-8676-676767676767",
            image_url: gallery[0] ?? null,
            image_urls: gallery,
            is_bookable: true,
            is_reservable: true,
            minimum_hours: 1,
            name: FACILITY_REGION_NAME,
            region_kind: "venue",
            source_venue_id: "68686868-6868-4686-8686-686868686868",
            status: "available",
          },
        ],
      },
      { ...cells, equipment: [], floor_id: "floor-2", grid_columns: 8, grid_rows: 4, image_url: null, regions: [] },
      { ...cells, equipment: [], floor_id: "floor-3", grid_columns: 8, grid_rows: 4, image_url: null, regions: [] },
    ],
  };
}

function nutritionTdee() {
  return {
    macros: {
      carbs_g: 250,
      created_at: "2026-09-08T00:00:00.000Z",
      fat_g: 67,
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      is_active: true,
      protein_g: 125,
      target_calories: 2000,
      tdee_profile_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      updated_at: "2026-09-08T00:00:00.000Z",
      user_id: MEMBER_ID,
    },
    tdee: {
      activity_level: "moderate",
      age: 32,
      bmr_calories: 1400,
      calculated_at: "2026-09-08T00:00:00.000Z",
      created_at: "2026-09-08T00:00:00.000Z",
      fitness_goal: "maintenance",
      gender: "female",
      height_cm: 165,
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      is_active: true,
      tdee_calories: 2000,
      updated_at: "2026-09-08T00:00:00.000Z",
      user_id: MEMBER_ID,
      weight_kg: 60,
    },
  };
}

function nutritionHistory() {
  const active = nutritionTdee().tdee;
  return [active, { ...active, calculated_at: "2026-08-08T00:00:00.000Z", created_at: "2026-08-08T00:00:00.000Z", id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", is_active: false, tdee_calories: 1950, updated_at: "2026-08-08T00:00:00.000Z" }];
}

function nutritionSummary(url: URL) {
  return {
    coaching: [{ id: "ffffffff-ffff-4fff-8fff-ffffffffffff", message: "A steady meal rhythm supports your target and recovery plan.", priority: "info", reason_codes: [], source: "nutrition_summary", title: "Keep the rhythm" }],
    date: url.searchParams.get("date") ?? TODAY,
    logged: { calories: 1030, carbs_g: 130, fat_g: 35, protein_g: 70 },
    macro_target_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    remaining: { calories: 970, carbs_g: 120, fat_g: 32, protein_g: 55 },
    target: { calories: 2000, carbs_g: 250, fat_g: 67, protein_g: 125 },
  };
}

function nutritionLogs() {
  return Array.from({ length: 8 }, (_, index) => ({
    calories: 120 + index * 35,
    carbs_g: 14 + index * 3,
    created_at: `2026-09-08T${String(index + 1).padStart(2, "0")}:00:00.000Z`,
    fat_g: 5 + index,
    food_item: index === 7 ? "Apple with peanut butter and a deliberately long food label" : ["Greek yogurt and berries", "Whole grain toast", "Chicken rice bowl", "Avocado salad", "Salmon and vegetables", "Roasted potatoes", "Protein smoothie"][index],
    icon: { asset_key: null, key: "utensils", kind: "library" },
    id: `12121212-1212-4121-8121-12121212121${index}`,
    log_date: TODAY,
    macro_target_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    meal_name: ["Breakfast", "Breakfast", "Lunch", "Lunch", "Dinner", "Dinner", "Snacks", "Snacks"][index],
    protein_g: 10 + index * 2,
    quantity: 1,
    unit: "serving",
    updated_at: `2026-09-08T${String(index + 1).padStart(2, "0")}:00:00.000Z`,
    user_id: MEMBER_ID,
  }));
}

function masteryDefinitions() {
  return [
    { aliases: [], body_region: "upper", created_at: "2026-01-01T00:00:00.000Z", icon_asset_key: null, icon_key: "dumbbell", icon_kind: "library", id: "13131313-1313-4131-8131-131313131313", is_active: true, is_system: true, key: "shoulders", name: "Shoulders", sort_order: 1, updated_at: "2026-01-01T00:00:00.000Z" },
    { aliases: [], body_region: "upper", created_at: "2026-01-01T00:00:00.000Z", icon_asset_key: null, icon_key: "dumbbell", icon_kind: "library", id: "14141414-1414-4141-8141-141414141414", is_active: true, is_system: true, key: "back", name: "Back", sort_order: 2, updated_at: "2026-01-01T00:00:00.000Z" },
    { aliases: [], body_region: "lower", created_at: "2026-01-01T00:00:00.000Z", icon_asset_key: null, icon_key: "dumbbell", icon_kind: "library", id: "15151515-1515-4151-8151-151515151515", is_active: true, is_system: true, key: "legs", name: "Legs", sort_order: 3, updated_at: "2026-01-01T00:00:00.000Z" },
  ];
}

function masteryProgress() {
  return [
    { created_at: "2026-08-01T00:00:00.000Z", id: "16161616-1616-4161-8161-161616161616", last_ranked_at: "2026-09-08T02:00:00.000Z", muscle_group: "Shoulders", rank: "gold", rank_display: "Gold", total_volume_kg: "1680.5", updated_at: "2026-09-08T02:00:00.000Z", user_id: MEMBER_ID, xp_points: 4800 },
    { created_at: "2026-08-01T00:00:00.000Z", id: "17171717-1717-4171-8171-171717171717", last_ranked_at: "2026-09-08T02:00:00.000Z", muscle_group: "Back", rank: "silver", rank_display: "Silver", total_volume_kg: "1420.25", updated_at: "2026-09-08T02:00:00.000Z", user_id: MEMBER_ID, xp_points: 3600 },
    { created_at: "2026-08-01T00:00:00.000Z", id: "18181818-1818-4181-8181-181818181818", last_ranked_at: "2026-09-08T02:00:00.000Z", muscle_group: "Legs", rank: "gold", rank_display: "Gold", total_volume_kg: "2150", updated_at: "2026-09-08T02:00:00.000Z", user_id: MEMBER_ID, xp_points: 3200 },
  ];
}

function activeMasterySeason() {
  return { ends_at: "2026-09-30T23:59:59.000Z", id: "19191919-1919-4191-8191-191919191919", starts_at: "2026-08-01T00:00:00.000Z", status: "active", title: "Autumn Strength Season" };
}

function masteryMilestones() {
  return [
    { category: "training", claimed_at: "2026-09-07T09:00:00.000Z", condition_payload: { target: 1 }, description: "Confirmed progression toward your first tracked workout.", evidence_requirement: "none", icon_asset_key: null, icon_key: "trophy", icon_kind: "library", is_hidden: false, latest_evidence_submission: null, key: "first-workout", milestone_definition_id: "20202020-2020-4202-8202-202020202020", progress_percent: 100, progress_value: 1, reward_payload: { xp: 100 }, status: "claimed", target_value: 1, title: "First tracked workout", trigger_type: "summary_threshold", unlocked_at: "2026-09-07T08:00:00.000Z", updated_at: "2026-09-08T02:00:00.000Z", verification_policy: "auto" },
    { category: "training", claimed_at: null, condition_payload: { target: 10 }, description: "Build consistent progress across your training week.", evidence_requirement: "none", icon_asset_key: null, icon_key: "dumbbell", icon_kind: "library", is_hidden: false, latest_evidence_submission: null, key: "weekly-rhythm", milestone_definition_id: "21212121-2121-4121-8121-212121212121", progress_percent: 60, progress_value: 6, reward_payload: { xp: 175 }, status: "in_progress", target_value: 10, title: "Build a weekly rhythm", trigger_type: "summary_threshold", unlocked_at: null, updated_at: "2026-09-08T02:00:00.000Z", verification_policy: "auto" },
    { category: "training", claimed_at: null, condition_payload: { target: 20 }, description: "Keep your strength volume moving through the current season.", evidence_requirement: "none", icon_asset_key: null, icon_key: "trophy", icon_kind: "library", is_hidden: false, latest_evidence_submission: null, key: "volume-builder", milestone_definition_id: "22222222-2222-4222-8222-222222222222", progress_percent: 40, progress_value: 8, reward_payload: { xp: 250 }, status: "in_progress", target_value: 20, title: "Volume builder", trigger_type: "summary_threshold", unlocked_at: null, updated_at: "2026-09-08T02:00:00.000Z", verification_policy: "auto" },
    { category: "training", claimed_at: null, condition_payload: { target: 4 }, description: "Unlocked progress reward ready to claim.", evidence_requirement: "none", icon_asset_key: null, icon_key: "trophy", icon_kind: "library", is_hidden: false, latest_evidence_submission: null, key: "season-starter", milestone_definition_id: "23232323-2323-4232-8232-232323232323", progress_percent: 100, progress_value: 4, reward_payload: { xp: 300 }, status: "unlocked", target_value: 4, title: "Season starter", trigger_type: "summary_threshold", unlocked_at: "2026-09-07T08:00:00.000Z", updated_at: "2026-09-08T02:00:00.000Z", verification_policy: "auto" },
  ];
}

function masterySeasonHistory() {
  return [{ closed_at: "2026-08-01T00:00:00.000Z", ends_at: "2026-07-31T23:59:59.000Z", season_id: "26262626-2626-4262-8262-262626262626", starts_at: "2026-06-01T00:00:00.000Z", title: "Summer Foundations", top_performers: [{ display_name: "Jordan Athlete", rank_position: 1, season_points: 3850, user_id: "24242424-2424-4242-8242-242424242424" }, { display_name: "Alexandria Responsive", rank_position: 2, season_points: 3520, user_id: MEMBER_ID }] }];
}

export async function installMemberResponsiveFixtures(
  page: Page,
  state: FixtureState,
  role: ResponsiveRole = "USER",
  options: MemberResponsiveFixtureOptions = {},
) {
  page.on("console", (message) => {
    if (message.type() === "error") state.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => state.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    state.requestFailures.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes("/v1/")) {
      state.observedRequests.push(`${request.method()} ${url.pathname}${url.search}`);
    }
  });

  await page.clock.install();
  await page.clock.setFixedTime(FIXED_NOW);

  const feedbackByVenue = new Map<string, Array<{
    amenity: { id: string; name: string; type: string };
    comment: string | null;
    created_at: string;
    id: string;
    rating: number;
    submitted_by: { id: string; name: string; role: string };
    updated_at: string;
  }>>();
  const feedbackHistoryCount = Math.max(0, options.feedbackHistoryCount ?? 0);
  if (feedbackHistoryCount > 0) {
    feedbackByVenue.set(
      "68686868-6868-4686-8686-686868686868",
      Array.from({ length: feedbackHistoryCount }, (_, index) => ({
        amenity: {
          id: "68686868-6868-4686-8686-686868686868",
          name: FACILITY_REGION_NAME,
          type: "other",
        },
        comment: index === feedbackHistoryCount - 1 ? null : `Feedback history comment ${index + 1}.`,
        created_at: `2026-09-${String(Math.max(1, 8 - index)).padStart(2, "0")}T04:00:00.000Z`,
        id: `history-feedback-${index + 1}`,
        rating: (index % 5) + 1,
        submitted_by: {
          id: `history-member-${index + 1}`,
          name: `Feedback Member ${index + 1}`,
          role: "USER",
        },
        updated_at: "2026-09-08T04:00:00.000Z",
      })),
    );
  }

  await page.addInitScript(
    ({ accessToken, memberId, refreshToken, role: fixtureRole }) => {
      window.sessionStorage.removeItem("fittrack_mobile_auth_status");
      if (fixtureRole === "ANON") {
        window.localStorage.removeItem("fittrack_access_token");
        window.localStorage.removeItem("fittrack_refresh_token");
        return;
      }
      window.localStorage.setItem("fittrack_access_token", accessToken);
      window.localStorage.setItem("fittrack_refresh_token", refreshToken);
      window.localStorage.setItem(`fittrack:auto-help-dismissed:${memberId}:all`, "1");
      window.localStorage.setItem(
        `fittrack_mobile_theme_${memberId}`,
        JSON.stringify({ animationLevel: "none", role: fixtureRole }),
      );
    },
    {
      memberId: role === "COACH" ? COACH_ID : MEMBER_ID,
      accessToken:
        role === "COACH"
          ? "mobile-responsive-coach-access-token"
          : "mobile-responsive-member-access-token",
      refreshToken:
        role === "COACH"
          ? "mobile-responsive-coach-refresh-token"
          : "mobile-responsive-member-refresh-token",
      role,
    },
  );

  await page.route("**/v1/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;
    let body: unknown;
    try {
      body = request.postDataJSON() ?? {};
    } catch {
      body = {};
    }
    if (method !== "GET") state.mutations.push({ body, method, path });

    if (method === "OPTIONS") {
      await route.fulfill({ status: 204 });
      return;
    }
    const feedbackHistoryMatch = path.match(
      /^\/v1\/bookings\/amenities\/([^/]+)\/feedback\/history$/,
    );
    if (feedbackHistoryMatch && method === "GET") {
      const entries = feedbackByVenue.get(feedbackHistoryMatch[1]) ?? [];
      const pageNumber = Math.max(1, Number(url.searchParams.get("page") ?? 1));
      const limit = Math.max(1, Number(url.searchParams.get("limit") ?? 10));
      return fulfill(route, {
        average_rating:
          entries.length > 0
            ? entries.reduce((total, entry) => total + entry.rating, 0) / entries.length
            : null,
        has_more: pageNumber * limit < entries.length,
        items: entries.slice((pageNumber - 1) * limit, pageNumber * limit),
        limit,
        page: pageNumber,
        total: entries.length,
      });
    }
    const feedbackMatch = path.match(/^\/v1\/bookings\/amenities\/([^/]+)\/feedback$/);
    if (feedbackMatch && method === "GET") {
      return fulfill(route, feedbackByVenue.get(feedbackMatch[1]) ?? []);
    }
    if (feedbackMatch && method === "POST") {
      if (options.feedbackPostDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.feedbackPostDelayMs));
      }
      const venueId = feedbackMatch[1];
      const payload = body as { comment?: string; rating?: number };
      const row = {
        amenity: { id: venueId, name: FACILITY_REGION_NAME, type: "other" },
        comment: payload.comment ?? null,
        created_at: "2026-09-08T04:00:00.000Z",
        id: `feedback-${(feedbackByVenue.get(venueId)?.length ?? 0) + 1}`,
        rating: payload.rating ?? 5,
        submitted_by: { id: MEMBER_ID, name: "Alexandria Responsive", role: "USER" },
        updated_at: "2026-09-08T04:00:00.000Z",
      };
      feedbackByVenue.set(venueId, [row, ...(feedbackByVenue.get(venueId) ?? [])]);
      return fulfill(route, row);
    }
    if (method !== "GET") {
      state.unhandled.push(`${method} ${path}${url.search}`);
      await route.abort("blockedbyclient");
      return;
    }

    if (path === "/v1/users/me") {
      if (role === "ANON") {
        await route.fulfill({
          body: JSON.stringify({ message: "Unauthorized" }),
          contentType: "application/json",
          status: 401,
        });
        return;
      }
      return fulfill(route, role === "COACH" ? coachProfileRecord() : profileRecord());
    }
    if (role === "COACH" && path === "/v1/coaching/coaches/me") {
      return fulfill(route, coachApiRecord());
    }
    if (role === "COACH" && path === "/v1/coaching/coaches") {
      return fulfill(route, [coachApiRecord()]);
    }
    if (role === "COACH" && path === "/v1/coaching/specialties") {
      return fulfillPage(
        route,
        [
          {
            id: "40404040-4040-4040-8040-404040404040",
            label: "Strength Coaching With A Long Specialty Name",
          },
          {
            id: "41414141-4141-4141-8141-414141414141",
            label: "Mobility Planning",
          },
          {
            id: "42424242-4242-4242-8242-424242424242",
            label: "Movement Screening",
          },
        ],
        url,
      );
    }
    if (role === "COACH" && path === "/v1/coaching/clients") {
      return fulfillPage(route, coachClientRelationships(), url);
    }
    if (role === "COACH" && path === "/v1/coaching/appointments/coach") {
      return fulfill(route, coachScheduleRecords());
    }
    if (role === "COACH" && path === "/v1/bookings/coach-work") {
      return fulfillPage(route, coachVenueWorkRecords(), url);
    }
    if (path === "/v1/users/deletion-request") return fulfill(route, { status: null });
    if (path === "/v1/users/me/attendance-qr") {
      return fulfill(route, {
        ready: true,
        qrValue: "FITTRACK-RESPONSIVE-MEMBER-QR",
        expiresAt: "2026-09-08T04:05:00.000Z",
        refreshAvailableAt: "2026-09-08T04:01:00.000Z",
        reason: null,
      });
    }
    if (path === "/v1/notifications/my") {
      return fulfillPage(route, notificationRecords(), url);
    }
    if (path === "/v1/notifications/unread-count") return fulfill(route, { count: 2 });
    if (path === "/v1/notifications/preferences") return fulfill(route, preferences());
    if (path === "/v1/membership/catalog-settings") {
      return fulfill(route, { membership_card_price: "400", updated_at: "2026-08-01T00:00:00.000Z" });
    }
    if (path === "/v1/membership/plans") return fulfillPage(route, [membershipPlan()], url);
    if (path === "/v1/membership/my-subscription") return fulfill(route, activeSubscription());
    if (path === "/v1/membership/free-day-pass-eligibility") {
      return fulfill(route, { eligible: false, expires_at: null, granted_at: null, reason: "Active membership", redeemed_at: null, revoked_at: null });
    }
    if (path === "/v1/payments/my") return fulfillPage(route, [], url);
    if (path === "/v1/bookings/recurring-coaching-plans") return fulfillPage(route, [], url);
    if (path === "/v1/bookings/amenities") return fulfill(route, homeVenueRecords());
    if (path === "/v1/bookings/amenity/my") return fulfill(route, homeBookingRecords());
    if (path === "/v1/coaching/appointments/my") {
      return fulfillPage(route, memberAppointmentRecords(), url);
    }
    if (path === "/v1/gym-layout/snapshot") return fulfill(route, gymLayoutSnapshot(options));
    if (path === "/v1/gym-layout/equipment") {
      return fulfill(
        route,
        gymLayoutSnapshot().floors.flatMap((floor) => floor.equipment),
      );
    }
    if (role === "USER" && path === "/v1/fitness/sessions") {
      return fulfillPage(
        route,
        page.url().includes("/workout") ? [workoutSessionSummary()] : homeSessions(),
        url,
      );
    }
    if (role === "USER" && path === `/v1/fitness/sessions/${WORKOUT_SESSION_ID}`) {
      return fulfill(route, workoutSessionDetail());
    }
    if (path === "/v1/nutrition/tdee") return fulfill(route, nutritionTdee());
    if (path === "/v1/nutrition/tdee/history") return fulfillPage(route, nutritionHistory(), url);
    if (path === "/v1/nutrition/daily-summary") return fulfill(route, nutritionSummary(url));
    if (path === "/v1/nutrition/logs") return fulfillPage(route, nutritionLogs(), url);
    if (path === "/v1/fitness/mastery") return fulfill(route, masteryProgress());
    if (path === "/v1/fitness/leaderboard") return fulfillPage(route, leaderboard(), url);
    if (path === "/v1/fitness/member/muscle-definitions") return fulfill(route, masteryDefinitions());
    if (path === "/v1/fitness/progression-profile") {
      return fulfill(route, {
        active_season: activeMasterySeason(),
        created_at: "2026-08-01T00:00:00.000Z",
        current_season_points: 2800,
        current_streak: 6,
        integrity_risk_level: "low",
        last_progressed_at: "2026-09-08T02:00:00.000Z",
        longest_streak: 14,
        ranking_governance_status: "normal",
        ranking_visibility: "public",
        total_xp: 14000,
        updated_at: "2026-09-08T02:00:00.000Z",
        user_id: MEMBER_ID,
      });
    }
    if (path === "/v1/fitness/season-standing") {
      const season = activeMasterySeason();
      return fulfill(route, {
        is_disqualified: false,
        is_hidden: false,
        last_earned_at: "2026-09-08T02:00:00.000Z",
        rank_position: 4,
        season,
        season_points: 2800,
        user_id: MEMBER_ID,
      });
    }
    if (path === "/v1/fitness/milestones") return fulfill(route, masteryMilestones());
    if (path === "/v1/fitness/integrity-summary") {
      return fulfill(route, { last_flagged_at: null, last_resolved_at: null, open_case_count: 0, recent_cases: [], risk_level: "low", user_id: MEMBER_ID });
    }
    if (path === "/v1/fitness/season-history") return fulfill(route, masterySeasonHistory());
    if (path === "/v1/fitness/muscle-leaderboard") return fulfillPage(route, [], url);
    if (path === "/v1/fitness/ranking-profile") {
      return fulfill(route, { display_alias: null, governance_status: "normal", updated_at: "2026-09-08T02:00:00.000Z", user_id: MEMBER_ID, visibility: "public" });
    }
    if (path === "/v1/fitness/exercises") {
      return fulfillPage(route, [workoutExerciseRecord()], url);
    }
    if (path === "/v1/fitness/exercises/55555555-5555-4555-8555-555555555555") {
      return fulfill(route, workoutExerciseRecord());
    }
    if (role === "USER" && path === "/v1/fitness/plans") {
      return fulfillPage(
        route,
        page.url().includes("/workout-plans")
          ? [workoutPlansSummary()]
          : [activePlan()],
        url,
      );
    }
    if (path === `/v1/fitness/plans/client/${MEMBER_ID}` && role === "COACH") {
      return fulfillPage(route, [coachClientPlan()], url);
    }
    if (path === `/v1/fitness/plans/${ACTIVE_PLAN_ID}`) {
      return fulfill(
        route,
        role === "COACH" && page.url().includes("coachView=clients")
          ? coachClientPlan()
          : activePlan(),
      );
    }
    if (role === "USER" && path === `/v1/fitness/plans/${ACTIVE_PLAN_ID}/progression-suggestions`) {
      if (options.progressionSuggestionError) {
        return fulfill(route, { message: "Progression service unavailable" }, 503);
      }
      return fulfill(route, workoutProgressionSuggestions());
    }
    if (role !== "ANON" && path === "/v1/ai/chat/sessions") return fulfillPage(route, aiSessionsForRole(role), url);
    if (role !== "ANON" && path === `/v1/ai/chat/sessions/${CHAT_SESSION_ID}`) return fulfill(route, aiSessionsForRole(role)[0]);
    if (role !== "ANON" && path.startsWith("/v1/ai/chat/sessions/") && path.endsWith("/messages")) {
      return fulfillPage(route, aiMessages(path.split("/")[5] ?? CHAT_SESSION_ID), url);
    }

    state.unhandled.push(`${method} ${path}${url.search}`);
    await route.abort("blockedbyclient");
  });
}

export function assertFixtureClosed(state: FixtureState) {
  if (
    state.unhandled.length ||
    state.requestFailures.length ||
    state.pageErrors.length ||
    state.consoleErrors.length
  ) {
    throw new Error(
      JSON.stringify(
        {
          unhandled: state.unhandled,
          requestFailures: state.requestFailures,
          pageErrors: state.pageErrors,
          consoleErrors: state.consoleErrors,
        },
        null,
        2,
      ),
    );
  }
}
