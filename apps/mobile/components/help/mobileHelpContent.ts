import type { TabKey } from "@fittrack/app-config";

export type MobileHelpTerm = {
  label: string;
  value: string;
};

export type MobileHelpContent = {
  description: string;
  steps: string[];
  terms: MobileHelpTerm[];
  title: string;
};

const DEFAULT_HELP: MobileHelpContent = {
  title: "FitTrack",
  description: "Use this screen to review your gym account and continue your current task.",
  steps: [
    "Read the status cards first so you know what needs attention.",
    "Open any card or action button that matches what you want to do next.",
    "Use the notification bell for updates from staff, coaches, bookings, and memberships.",
  ],
  terms: [
    { label: "Status", value: "The current state of the item you are viewing." },
    { label: "Action", value: "A button or menu item that starts the next task." },
  ],
};

const HELP_BY_TAB: Record<TabKey, MobileHelpContent> = {
  home: {
    title: "Home",
    description: "This dashboard summarizes your membership, today activity, and next recommended action.",
    steps: [
      "Check your membership card and account status first.",
      "Review today's booking or workout prompt if one appears.",
      "Open the matching tab when you need to manage bookings, facilities, workouts, or settings.",
    ],
    terms: [
      { label: "Membership card", value: "Your access record for member-only gym features." },
      { label: "Today", value: "Current-day activity, bookings, or reminders that need attention." },
    ],
  },
  facilities: {
    title: "Facilities",
    description: "This screen shows published gym floors, venue zones, and reservable areas.",
    steps: [
      "Choose a floor or scan the map to find a venue.",
      "Tap a venue card or mapped zone to open details.",
      "Use Leave Feedback on a venue detail after visiting or booking the space.",
    ],
    terms: [
      { label: "Venue zone", value: "A mapped gym space with details, capacity, and booking availability." },
      { label: "Reservable", value: "A venue that can be booked from the member flow." },
      { label: "Feedback", value: "A rating and optional comment tied to that venue." },
    ],
  },
  bookings: {
    title: "Bookings",
    description: "This screen manages your venue reservations and coaching appointments.",
    steps: [
      "Search or filter to find a reservation or coaching appointment.",
      "Tap an item to open details, payment state, coach name, and session report.",
      "After a completed coaching session, use Leave Feedback for Coach once.",
    ],
    terms: [
      { label: "Reservation", value: "A booked gym venue or facility slot." },
      { label: "Appointment", value: "A coaching session with payment and schedule status." },
      { label: "Reviewed", value: "A completed coaching session where you already rated the coach." },
    ],
  },
  assessments: {
    title: "Assessments",
    description: "This page collects coach-to-member reports and member-to-coach reviews in one place.",
    steps: [
      "Open recent assessments to read session notes, reports, and coach feedback.",
      "Check member-to-coach review entries to confirm what you submitted.",
      "Return to Bookings if you still need to leave feedback for a completed session.",
    ],
    terms: [
      { label: "Session report", value: "Coach notes and assessment saved after a completed appointment." },
      { label: "Review", value: "Your star rating and optional written feedback for a coach." },
    ],
  },
  nutrition: {
    title: "Nutrition",
    description: "This member tool helps organize nutrition coaching notes and plan-related guidance.",
    steps: [
      "Review the current nutrition card or plan details.",
      "Follow the listed recommendations if your membership access allows it.",
      "Use Settings or feedback if something looks incorrect.",
    ],
    terms: [
      { label: "Plan", value: "A nutrition guidance record connected to your member profile." },
      { label: "Recommendation", value: "Suggested next step from coaching or AI-supported guidance." },
    ],
  },
  mastery: {
    title: "Muscle Mastery",
    description: "This screen tracks progression, mastery states, and review status for workout progress.",
    steps: [
      "Check the current mastery status and any review notes.",
      "Open workout tracking to create new progress evidence.",
      "Wait for staff review when a progression case is flagged.",
    ],
    terms: [
      { label: "Mastery", value: "A progress state for a muscle group or movement goal." },
      { label: "Review case", value: "Progress evidence that needs staff or system review." },
    ],
  },
  workout: {
    title: "Workout",
    description: "This screen tracks live workout sessions, selected exercises, and completion state.",
    steps: [
      "Choose or confirm the exercise you are performing.",
      "Keep your body visible to the camera when live tracking is active.",
      "Finish the session to save workout activity and update your activity level.",
    ],
    terms: [
      { label: "Live session", value: "An active workout run that records movement and timing." },
      { label: "Exercise match", value: "The selected or detected movement connected to the session." },
      { label: "Finish", value: "The action that saves the workout session and activity history." },
    ],
  },
  chathistory: {
    title: "Chat History",
    description: "This screen lists previous Brodigy AI conversations for quick review.",
    steps: [
      "Open a previous conversation to continue or review it.",
      "Start a new chat when you need fresh guidance.",
      "Keep gym, workout, and membership questions inside FitTrack topics.",
    ],
    terms: [
      { label: "Conversation", value: "A saved AI chat thread." },
      { label: "Brodigy AI", value: "FitTrack's gym guidance assistant." },
    ],
  },
  chatbot: {
    title: "Brodigy AI",
    description: "This assistant answers FitTrack, gym, workout, and membership questions.",
    steps: [
      "Ask one clear question at a time.",
      "Use follow-up questions when you need more detail.",
      "For account, payment, or booking changes, use the matching FitTrack screen.",
    ],
    terms: [
      { label: "Grounded answer", value: "A response based on FitTrack-supported gym context." },
      { label: "Follow-up", value: "A next question that keeps the same conversation going." },
    ],
  },
  profile: {
    title: "Profile",
    description: "This screen manages account details, membership status, and member-only access.",
    steps: [
      "Review your account and membership card status.",
      "Use membership actions when you need to buy or repair access.",
      "Open Settings for notifications, privacy, password, and app feedback.",
    ],
    terms: [
      { label: "Access", value: "What your current account and membership status allow." },
      { label: "Verification", value: "Staff review needed before some member features unlock." },
    ],
  },
  settings: {
    title: "Settings",
    description: "This screen controls preferences, notifications, privacy, security, and app feedback.",
    steps: [
      "Open a settings card for the preference you want to change.",
      "Use Send Feedback to report bugs, request features, or send general comments.",
      "Review notification preferences if reminders are missing or too noisy.",
    ],
    terms: [
      { label: "Preference", value: "A setting that changes how FitTrack behaves for you." },
      { label: "App feedback", value: "A bug report, feature request, or general message saved for admin review." },
    ],
  },
};

export function getMobileHelpContent(tab: TabKey): MobileHelpContent {
  return HELP_BY_TAB[tab] ?? DEFAULT_HELP;
}
