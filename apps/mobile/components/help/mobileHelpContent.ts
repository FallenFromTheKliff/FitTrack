import type { TabKey } from "@fittrack/app-config";

export type MobileHelpTerm = {
  label: string;
  value: string;
};

export type MobileHelpDetailCard = {
  details: string[];
  subtitle: string;
  terms?: MobileHelpTerm[];
  title: string;
};

export type MobileHelpContent = {
  description: string;
  detailCards?: MobileHelpDetailCard[];
  detailIntro?: string;
  detailTitle?: string;
  slides?: Array<{
    body: string;
    title: string;
  }>;
  steps: string[];
  terms: MobileHelpTerm[];
  title: string;
};

const DEFAULT_HELP: MobileHelpContent = {
  title: "FitTrack",
  description: "Use this screen to review your gym account and continue your current task.",
  steps: [
    "Read the status cards first so you know what needs attention.",
    "Tap an information card below when you want more context about a section.",
    "Use the notification bell for updates from staff, coaches, bookings, and memberships.",
  ],
  detailTitle: "Page sections",
  detailIntro:
    "Open one card at a time to learn what the screen is showing and what actions are available.",
  detailCards: [
    {
      title: "Status cards",
      subtitle: "The first place to check what needs attention.",
      details: [
        "Status cards summarize the current state of the screen, such as account access, active work, or items that need a follow-up.",
        "When a card shows an unavailable or locked state, use the visible action on that same screen instead of guessing another route.",
      ],
      terms: [
        {
          label: "Status",
          value: "The current state of the item you are viewing.",
        },
      ],
    },
    {
      title: "Screen actions",
      subtitle: "Buttons and cards that move you to the next task.",
      details: [
        "Action buttons open the matching FitTrack flow for the item on screen.",
        "If a screen only routes somewhere else, the help text explains that route instead of promising an edit inside the current screen.",
      ],
      terms: [
        {
          label: "Action",
          value: "A button, card, or menu item that starts the next task.",
        },
      ],
    },
  ],
  terms: [],
};

const HELP_BY_TAB: Record<TabKey, MobileHelpContent> = {
  home: {
    title: "Home",
    description:
      "Home is the friendly front desk for FitTrack: it gives you a quick read on membership access, today's plan, and the best next place to tap.",
    steps: [
      "Start with the top cards to see whether your account, activity, or ranking needs attention.",
      "Check today's schedule and live snapshot before jumping into a workout, meal, or booking.",
      "Tap a card below to learn what each Home section means and where its actions send you.",
      "Use the Home FAB for fast jumps to Start Workout, Book Slot, Gym Map, or Track Progress.",
    ],
    detailTitle: "Home sections",
    detailIntro:
      "These cards explain the Home dashboard without adding actions that are not present on the screen.",
    detailCards: [
      {
        title: "Today at a glance",
        subtitle: "Top cards for bookings, activity, rank, EXP, or member access.",
        details: [
          "The top summary cards are your quick scan before doing anything else. They can show Today Bookings, 7 Day Activity, Gym Rank, and Total EXP when member data is available.",
          "If member access is not ready, the same area can show fallback access states instead of ranking or EXP details.",
          "Use these numbers as direction: open Bookings for schedule details, Muscle Mastery for ranking and EXP, or Profile when access needs attention.",
        ],
        terms: [
          {
            label: "Today Bookings",
            value: "Bookings or sessions scheduled for the current day.",
          },
          {
            label: "Total EXP",
            value: "Progression experience surfaced from the mastery system.",
          },
          {
            label: "Member access",
            value: "Whether your account can use member-only FitTrack features.",
          },
        ],
      },
      {
        title: "Pinned goal",
        subtitle: "The banner that names your best next account, nutrition, workout, or schedule move.",
        details: [
          "Pinned Goal changes with your access, nutrition target, streak, bookings, and mastery state.",
          "Use it as Home's strongest suggestion before choosing a quick action.",
          "If it mentions access, Profile owns the fix; if it mentions training, nutrition, or bookings, follow the matching screen action.",
        ],
        terms: [
          {
            label: "Pinned Goal",
            value: "The Home banner that points to the most useful next step from your current data.",
          },
        ],
      },
      {
        title: "Schedule for today",
        subtitle: "A short list of visible bookings for the current day.",
        details: [
          "Today's visible booking cards can be tapped to open booking details.",
          "Home shows a short preview instead of the full booking manager. When more than four items exist, use Bookings to review the overflow.",
          "Home does not directly edit bookings; it routes you toward the screen or detail modal that owns the booking action.",
        ],
        terms: [
          {
            label: "Booking detail",
            value: "The modal or screen state with the selected reservation or appointment information.",
          },
        ],
      },
      {
        title: "Live snapshot",
        subtitle: "Nutrition, workout momentum, Muscle Mastery, or locked rows.",
        details: [
          "The live snapshot summarizes current member-facing progress from other FitTrack systems.",
          "Nutrition Target points toward your food goal state, Workout Momentum reflects training activity, and Muscle Mastery highlights progression data when available.",
          "If membership access is locked, this area can switch to access guidance so you know why the live rows are unavailable.",
        ],
        terms: [
          {
            label: "Nutrition Target",
            value: "The active nutrition goal status pulled into Home.",
          },
          {
            label: "Workout Momentum",
            value: "A training activity summary used to nudge your next workout step.",
          },
        ],
      },
      {
        title: "Next action cards",
        subtitle: "Shortcuts such as Book Now, View Schedule, Start Workout, or Set Nutrition Goal.",
        details: [
          "Next action cards only show actions the current account state can use.",
          "Book Now or View Schedule moves you toward bookings, Start or Continue Workout moves you into training, Set Nutrition Goal opens nutrition setup, and Unlock Member Access points back to account access work.",
          "Use the card that matches your immediate task, then return Home later for the updated snapshot.",
        ],
        terms: [
          {
            label: "Quick action",
            value: "A Home shortcut into the screen that owns the next workflow.",
          },
        ],
      },
      {
        title: "FAB - Start Workout",
        subtitle: "Fast jump from Home into live training.",
        details: [
          "Start Workout opens Workout so eligible members can initialize the camera and begin live tracking.",
          "Use this when the next thing you want is an actual training session rather than reviewing stats.",
        ],
        terms: [
          {
            label: "Workout",
            value: "The screen that owns camera setup, exercise tracking, reps, and finish/save behavior.",
          },
        ],
      },
      {
        title: "FAB - Book Slot",
        subtitle: "Fast jump into the reservation flow.",
        details: [
          "Book Slot opens Bookings with the reservation flow ready for a venue slot.",
          "Use this when you already know you want to reserve gym space instead of browsing the Home schedule preview.",
        ],
        terms: [
          {
            label: "Reservation",
            value: "A venue or facility time slot managed from Bookings.",
          },
        ],
      },
      {
        title: "FAB - Gym Map",
        subtitle: "Fast jump to facility navigation.",
        details: [
          "Gym Map opens Facilities so you can find equipment, mapped zones, venue details, and orientation guidance.",
          "Use this when you are physically navigating the gym or deciding where a booking or workout should happen.",
        ],
        terms: [
          {
            label: "Facilities",
            value: "The screen that owns the map, floor levels, legend, and venue detail modal.",
          },
        ],
      },
      {
        title: "FAB - Track Progress",
        subtitle: "Fast jump to nutrition and target review.",
        details: [
          "Track Progress opens Nutrition for target and progress review.",
          "Use this when you want to check calories, macros, meal logs, or recommended next bites after looking at Home.",
        ],
        terms: [
          {
            label: "Nutrition",
            value: "The screen that owns calorie targets, macro progress, and meal logging.",
          },
        ],
      },
    ],
    terms: [],
  },
  facilities: {
    title: "Facilities",
    description:
      "Facilities is your gym map: it shows published floors, mapped zones, reservable spaces, and the venue details currently available to members.",
    steps: [
      "Pick a level or scan the blueprint to find the area you want.",
      "Tap a mapped zone or venue card to open its current details.",
      "Use the Legend first to match visible markers to venues, then read Orientation Path below it for the suggested circulation lane.",
      "Use the Facilities FAB for Chat with BrodigyAI or Make Reservation when you need guidance or a booking flow.",
    ],
    detailTitle: "Facilities sections",
    detailIntro:
      "These cards follow the map and venue experience shown on Facilities.",
    detailCards: [
      {
        title: "Floor map",
        subtitle: "Level buttons, blueprint orientation, zones, and counts.",
        details: [
          "Level buttons switch the blueprint between published gym floors, and the refresh icon reloads venue data without leaving the map.",
          "Mapped zones show where gym areas are located on the selected floor. The map keeps live venue zones in front of the blueprint so tappable spaces stay clear.",
          "Use the floor map first when you are deciding where to train, where a service area is, or which level has the venue you need.",
        ],
        terms: [
          {
            label: "Level",
            value: "A published gym floor that can have its own mapped zones.",
          },
          {
            label: "Reservable count",
            value: "How many venues on the selected level are marked as reservable.",
          },
          {
            label: "Support area",
            value: "A mapped non-reservation area such as a service or utility zone.",
          },
        ],
      },
      {
        title: "Venue zones",
        subtitle: "Details for mapped areas on the facility blueprint.",
        details: [
          "Tapping a mapped zone opens venue details for that area; the selected zone stays tied to the active floor.",
          "Details can include description, hours, status, capacity when reservable, live equipment, images, and feedback.",
          "Use this detail view to confirm whether the space fits your plan before moving into a reservation or feedback flow.",
        ],
        terms: [
          {
            label: "Venue zone",
            value: "A mapped gym space with details, equipment, status, and optional booking availability.",
          },
          {
            label: "Capacity",
            value: "The people or usage limit shown when the venue supports it.",
          },
        ],
      },
      {
        title: "Legend and Orientation Path",
        subtitle: "Marker labels first, then the suggested circulation lane.",
        details: [
          "The Legend mirrors the currently published zones on the selected floor, so it changes with the map.",
          "Orientation Path now sits below Legend. It explains the active floor's route label, suggested movement flow, mapped-zone count, reservable count, and shared-support count.",
          "Read Legend first when you need to match a marker to a venue, then read Orientation Path when you want help understanding how to move through that floor.",
          "If a floor has no visible zones, Facilities can point you toward another floor that has mapped areas.",
        ],
        terms: [
          {
            label: "Legend",
            value: "The label list for the zones currently visible on the selected map.",
          },
          {
            label: "Orientation Path",
            value: "The below-Legend card that explains movement flow and floor counts after you understand the markers.",
          },
        ],
      },
      {
        title: "FAB - Chat with BrodigyAI",
        subtitle: "Ask for facility guidance from the map context.",
        details: [
          "Chat with BrodigyAI opens a gym guidance conversation from Facilities context.",
          "Use it when you need help choosing a zone, understanding equipment placement, or deciding where to train next.",
          "This action does not change the map; it moves you into the chat flow with Facilities as the starting context.",
        ],
        terms: [
          {
            label: "BrodigyAI",
            value: "FitTrack's gym guidance assistant.",
          },
        ],
      },
      {
        title: "FAB - Make Reservation",
        subtitle: "Start the booking flow from Facilities.",
        details: [
          "Make Reservation opens the reservation flow instead of editing the map itself.",
          "Use this when you have found a space or floor and are ready to reserve a venue slot.",
          "Venue details on this screen do not always include a direct Reserve Now button, so use this FAB action when you want to book a space.",
        ],
        terms: [
          {
            label: "Reservation",
            value: "A booked gym venue or facility slot managed by the booking flow.",
          },
        ],
      },
    ],
    terms: [],
  },
  bookings: {
    title: "Bookings",
    description:
      "Bookings is where venue reservations and coaching appointments live, from finding the right item to opening details, payment state, cancellation, or feedback.",
    steps: [
      "Use search, view chips, status chips, and dates to narrow the list.",
      "Tap a reservation or appointment card to open its details and available actions.",
      "Use the cards below to understand which controls apply to reservations, appointments, and new bookings.",
      "Use the Bookings FAB for Make Reservation or Book a Trainer when your account can create new bookings.",
    ],
    detailTitle: "Bookings sections",
    detailIntro:
      "These cards explain the filters, item types, detail actions, and creation buttons on Bookings.",
    detailCards: [
      {
        title: "Find bookings",
        subtitle: "Search, View chips, status chips, and date filters.",
        details: [
          "Search helps find a reservation or appointment by visible booking information.",
          "View chips switch between Reservations and Appointments so venue slots and coaching sessions are easier to scan.",
          "Status chips and start/end date filters narrow the list by booking state and schedule window.",
        ],
        terms: [
          {
            label: "View chip",
            value: "A filter button for switching the list between reservation and appointment views.",
          },
          {
            label: "Status chip",
            value: "A filter button for showing bookings in a matching state.",
          },
        ],
      },
      {
        title: "Reservation vs appointment",
        subtitle: "Venue slots and trainer sessions show different information.",
        details: [
          "Reservation cards represent booked gym venues or facility slots. They focus on venue, time, and reservation status.",
          "Appointment cards represent one-on-one coaching sessions. They include coach context plus payment and schedule status.",
          "Use the card type to decide whether your next step belongs to facility booking or coach appointment management.",
        ],
        terms: [
          {
            label: "Reservation",
            value: "A booked gym venue or facility slot.",
          },
          {
            label: "Appointment",
            value: "A coaching session with schedule and payment status.",
          },
        ],
      },
      {
        title: "Details and actions",
        subtitle: "What can happen after you tap a booking card.",
        details: [
          "Tapping a card opens the details for that reservation or appointment.",
          "Reservations may allow Cancel Reservation. Appointments may allow PayMongo Downpayment, PayMongo Full Payment, Cash Downpayment, Cash Full Payment, Cancel Appointment, or Leave Feedback when the coaching session is completed and unreviewed.",
          "PayMongo starts an online checkout when that option is available, while Cash submits a payment request for staff handling.",
          "Completed, unreviewed coaching appointments can show Leave Feedback. That modal asks for a star rating and optional comment before submitting the coach review.",
          "The UI submits these actions through confirmation and request flows, so follow the on-screen result after tapping.",
        ],
        terms: [
          {
            label: "Payment stage",
            value: "Whether the booking is asking for a downpayment, full payment, or a remaining balance step.",
          },
          {
            label: "PayMongo",
            value: "The online checkout path shown when FitTrack can start digital payment for that booking.",
          },
          {
            label: "Cash payment request",
            value: "A submitted cash payment action that staff still needs to handle or verify.",
          },
          {
            label: "Coach feedback",
            value: "Your star rating and optional comment for a completed coaching appointment.",
          },
          {
            label: "Reviewed",
            value: "A completed coaching session where coach feedback has already been submitted.",
          },
          {
            label: "Confirm modal",
            value: "The final prompt before a cancellation or other guarded action is submitted.",
          },
        ],
      },
      {
        title: "FAB - Make Reservation",
        subtitle: "Start a new venue reservation.",
        details: [
          "Make Reservation appears for eligible member accounts that are not frozen.",
          "It starts the venue reservation flow for booking gym spaces and facility slots.",
          "If this action is not visible, check account access, role, or frozen state rather than assuming the booking list is broken.",
        ],
        terms: [
          {
            label: "Venue reservation",
            value: "A booking flow for reservable gym spaces.",
          },
        ],
      },
      {
        title: "FAB - Book a Trainer",
        subtitle: "Start a coaching appointment request.",
        details: [
          "Book a Trainer appears for eligible member accounts that are not frozen.",
          "It starts the coach appointment flow, where coach availability and appointment details are handled.",
          "Use it when your next task is a one-on-one coaching session instead of a venue reservation.",
        ],
        terms: [
          {
            label: "Trainer appointment",
            value: "A coaching session request with schedule and payment state.",
          },
        ],
      },
    ],
    terms: [],
  },
  assessments: {
    title: "Assessments",
    description:
      "Assessments is a read-only coaching record that gathers session notes, coach reports, coach replies, and ratings tied to completed coaching activity.",
    steps: [
      "Search by coach name or use filters to choose the type of coaching record you want.",
      "Read assessment cards to review dates, status, and timeline entries.",
      "Use Bookings if you still need to leave feedback for a completed session.",
      "Tap a help card below when a filter, timeline label, loading state, or empty state needs a plain-English explanation.",
    ],
    detailTitle: "Assessments sections",
    detailIntro:
      "These cards explain the coaching history shown here and what remains owned by Bookings.",
    detailCards: [
      {
        title: "Coaching record",
        subtitle: "Session notes, coach assessments, replies, and member ratings.",
        details: [
          "Assessments collects coaching history in one place after coaching activity has produced notes, reports, replies, or ratings.",
          "This screen is read-only, so it is for reviewing coaching records rather than creating new coach feedback.",
          "Use it when you want to look back at what a coach recorded, what you rated, or what follow-up was attached to a session.",
        ],
        terms: [
          {
            label: "Session report",
            value: "Coach notes and assessment saved after a coaching appointment.",
          },
          {
            label: "Review",
            value: "Your star rating and optional written feedback for a coach.",
          },
        ],
      },
      {
        title: "Search and filters",
        subtitle: "Coach-name search plus record-type filters.",
        details: [
          "Search narrows the list by coach name.",
          "The filter options include All, Coach assessments, Coach replies, and My coach ratings.",
          "Use filters when you only want one kind of entry instead of scanning the full timeline.",
        ],
        terms: [
          {
            label: "Coach assessment",
            value: "A coach-authored report or note attached to a completed session.",
          },
          {
            label: "My coach ratings",
            value: "Feedback entries you submitted for coaches.",
          },
        ],
      },
      {
        title: "Assessment cards",
        subtitle: "Coach, schedule, appointment status, and timeline entries.",
        details: [
          "Each assessment card shows the coach name, scheduled date and time, appointment status, and one or more timeline entries.",
          "Timeline labels help distinguish notes, reports, replies, and ratings.",
          "Use the card context to understand which appointment produced the record before acting elsewhere.",
        ],
        terms: [
          {
            label: "Timeline entry",
            value: "A note, report, reply, or rating displayed under one coaching appointment.",
          },
        ],
      },
      {
        title: "Empty and loading states",
        subtitle: "Why the list may have nothing to show yet.",
        details: [
          "Completed coaching sessions with notes, reports, replies, or ratings can appear here once they are available.",
          "If the screen is empty, it may mean there are no matching records for the current search or filter.",
          "Feedback creation remains in Bookings, so return there when a completed session still needs a member review.",
        ],
        terms: [
          {
            label: "Empty state",
            value: "The message shown when no records match the current data, search, or filters.",
          },
        ],
      },
    ],
    terms: [],
  },
  nutrition: {
    title: "Nutrition",
    description:
      "Nutrition is your food-side dashboard for today: it compares what you have logged against your live calorie and macro target, then points you toward the next useful meal choice.",
    steps: [
      "Start with Today's Calories to see whether you still have calories remaining or have moved over target.",
      "Use Target Status, Macro Breakdown, and Today's Nutrition Log to understand what changed and what needs attention next.",
      "Tap a help card below for a plain-English guide to each Nutrition section.",
      "Use the Nutrition FAB for target setup, target recalculation, or BrodigyAI/access actions when those options appear.",
      "Use Set Nutrition Target or Recalculate Target when your body metrics, activity level, or goal changes.",
      "Use Log Meal when premium nutrition logging is available so today's totals can update from what you actually ate.",
    ],
    detailTitle: "Nutrition sections",
    detailIntro:
      "These cards follow the Nutrition screen from top to bottom. Open one when a number, signal, or action needs a quick explanation.",
    detailCards: [
      {
        title: "Maintenance",
        subtitle: "The Maintain goal used when you want a steady calorie target.",
        details: [
          "Maintenance is the Maintain option inside Set Nutrition Target or Recalculate Nutrition Target. It tells the backend TDEE module to build a live macro target around holding steady rather than intentionally bulking or cutting.",
          "The setup modal also uses date of birth, weight in kilograms, height in centimeters, gender, and activity level. Saving sends those values to the profile and recalculates the active nutrition target immediately.",
          "You can increase the resulting maintenance calories by saving a higher activity level, a higher body weight, or a different goal that asks for more fuel. You can decrease it by saving a lower activity level, updated body metrics, or a goal that calls for less fuel.",
          "Maintenance changes the targets shown across Nutrition: Today's Calories, Target Status, Macro Breakdown, Today's Nutrition Log, and Recommended Next Bites all read from the active backend target.",
          "Meal logs do not change the maintenance target itself; they change today's logged totals so the screen can compare intake against that target.",
        ],
        terms: [
          {
            label: "Maintain",
            value: "A fitness goal option that asks FitTrack to calculate a steadier target.",
          },
          {
            label: "TDEE",
            value: "Total daily energy estimate used as the base for the calorie target.",
          },
          {
            label: "Activity level",
            value: "Sedentary, Light, Moderate, Active, or Very Active; this changes the recalculated target.",
          },
        ],
      },
      {
        title: "Target Status",
        subtitle: "Daily Target, Recent Adherence, and Target History.",
        details: [
          "Daily Target shows whether your active goal is ready. It can show In range, Over target, or Needs setup depending on whether a target exists and whether today's logged calories are above the target.",
          "Recent Adherence compares today's logged calories against today's calorie target and displays the percentage logged so far.",
          "Target History shows when the backend last calculated your TDEE, how many saved calculations are on record, and the calorie change compared with the previous active calculation when one exists.",
          "You can change Target Status by setting or recalculating your nutrition target, or by logging meals that move today's calories closer to or past the target.",
          "If no target exists, Nutrition can still show baseline intake, but macro comparisons and stronger coaching need a saved nutrition goal first.",
        ],
        terms: [
          {
            label: "In range",
            value: "Today's calories are not over the active target.",
          },
          {
            label: "Over target",
            value: "Logged calories have passed today's active calorie target.",
          },
          {
            label: "Adherence",
            value: "The percent of today's target calories already logged.",
          },
        ],
      },
      {
        title: "Macro Breakdown",
        subtitle: "Protein, carbs, fats, progress bars, and remaining grams.",
        details: [
          "Macro Breakdown compares logged grams against target grams for Protein, Carbs, and Fats.",
          "Protein is the muscle-repair and satiety macro. Increase logged protein by saving meals with more protein grams; the protein target itself changes when you recalculate your nutrition goal.",
          "Carbs are the main training-fuel macro on this screen. Increase logged carbs by logging carb-heavy meals; the carbs target changes with your active goal and recalculated TDEE/macros.",
          "Fats help fill the calorie target with more energy-dense food. Increase logged fat through meal logs with fat grams; the fat target changes when the active macro target changes.",
          "The remaining text tells you how many grams are still open or how many grams are over target. The screen does not provide plus/minus macro buttons; it reflects the target you set and the meals you log.",
        ],
        terms: [
          {
            label: "Protein",
            value: "Logged protein grams compared with the active protein target.",
          },
          {
            label: "Carbs",
            value: "Logged carbohydrate grams compared with the active carb target.",
          },
          {
            label: "Fats",
            value: "Logged fat grams compared with the active fat target.",
          },
        ],
      },
      {
        title: "Today's Nutrition Log",
        subtitle: "Previous meals, saved meals, premium access states, and new logs.",
        details: [
          "Today's Nutrition Log now sits directly below Macro Breakdown so saved meals stay close to the macro bars they affect.",
          "The section lists meals saved for the current date when premium nutrition logging is available.",
          "Each saved meal row shows meal name, food item, calories, protein, carbs, fat, quantity, and unit.",
          "Tapping Log Meal first opens a meal chooser with search at the top. Pick a previous meal to prefill the form for today, or use New Log Meal at the bottom above Cancel to start from a blank entry. The meal form has a Back button so you can return to the chooser without closing the flow.",
          "Saving a log sends it to the live backend, closes the modal on success, and refreshes nutrition queries so today's calories, macro bars, and recommendations can update.",
        ],
        terms: [
          {
            label: "Previous meal",
            value: "A recent saved log you can reuse as a starting point for today's entry.",
          },
          {
            label: "Meal type",
            value: "Breakfast, Lunch, Dinner, Snack, Pre-workout, or Post-workout.",
          },
          {
            label: "Quantity",
            value: "How much of the selected unit you ate, such as 1 serving or 170 g.",
          },
        ],
      },
      {
        title: "Recommended Next Bites",
        subtitle: "Three saved meals sorted around today's missing macros.",
        details: [
          "Recommended Next Bites now reads from saved meal logs returned by the backend instead of a built-in static list.",
          "When an active target exists, FitTrack scores recent meals against the macros you are still missing. If protein is the biggest gap, protein-focused saved meals rise; if carbs or fats are open, matching meals can move up.",
          "When no target is active, the shelf falls back to recent saved meals so the section stays tied to your actual log history.",
          "Each card shows the food name, saved date, calories, protein, carbs, fat, quantity, unit, and a trailing focus label such as PROTEIN, CARB REFILL, FAT SUPPORT, or BALANCED.",
          "Use these as starter ideas, then log or reuse a meal if you want Today's Calories, Macro Breakdown, and Recommended Next Bites to reflect what you actually ate.",
        ],
        terms: [
          {
            label: "LIVE MEAL PICKS",
            value: "Saved meal logs sorted against missing macros when a target exists.",
          },
          {
            label: "Saved meal",
            value: "A backend meal log that can appear in recommendations or the previous-meal chooser.",
          },
          {
            label: "Focus label",
            value: "The card label that explains which macro need the food best supports.",
          },
        ],
      },
      {
        title: "FAB - Launch BrodigyAI Mini-Chat",
        subtitle: "Open nutrition-focused chat guidance when member-card access is active.",
        details: [
          "Launch BrodigyAI Mini-Chat appears for member accounts with active member-card access.",
          "It opens BrodigyAI from Nutrition context so today's live totals can guide the conversation.",
          "Use it when you want coaching language around what your Nutrition screen is already showing.",
        ],
        terms: [
          {
            label: "Mini-Chat",
            value: "A BrodigyAI chat started from Nutrition context.",
          },
        ],
      },
      {
        title: "FAB - BrodigyAI Unlock Pending",
        subtitle: "Shown when chat access is waiting on membership-card verification.",
        details: [
          "BrodigyAI Unlock Pending appears when staff still needs to verify your membership card.",
          "The action explains that chat opens after verification is complete.",
          "Use Profile if you need to inspect or repair the membership-card state behind this lock.",
        ],
        terms: [
          {
            label: "Pending verification",
            value: "A membership-card state waiting for staff review.",
          },
        ],
      },
      {
        title: "FAB - Repair BrodigyAI Access",
        subtitle: "Shown when revoked access blocks nutrition chat.",
        details: [
          "Repair BrodigyAI Access appears when member-card access is revoked.",
          "It routes to Profile so you can restore member-card access before using chat.",
          "Nutrition targets and logs can still explain food progress, but chat follows the access policy shown by the FAB.",
        ],
        terms: [
          {
            label: "Revoked",
            value: "An access state where member-only chat is blocked until repaired.",
          },
        ],
      },
      {
        title: "FAB - Unlock BrodigyAI Chat",
        subtitle: "Shown when a membership card must be bought or restored first.",
        details: [
          "Unlock BrodigyAI Chat appears when Nutrition can show the locked chat route but member-card access is not active.",
          "It sends you to Profile, where membership-card purchase or restoration actions live.",
          "Use this when you want Nutrition chat help but the app is telling you access comes first.",
        ],
        terms: [
          {
            label: "Member-card access",
            value: "The membership state required before BrodigyAI chat can open for member-only contexts.",
          },
        ],
      },
      {
        title: "FAB - Create Nutrition Goal",
        subtitle: "Start the target setup flow when no active goal exists.",
        details: [
          "Create Nutrition Goal appears when Nutrition does not have an active target yet.",
          "It opens the goal setup flow that uses body metrics, activity level, and goal choice to calculate calorie and macro targets.",
          "Use it before relying on macro comparisons, adherence, or recommendation scoring.",
        ],
        terms: [
          {
            label: "Nutrition Goal",
            value: "The saved target that drives calories, macros, status, and recommendations.",
          },
        ],
      },
      {
        title: "FAB - Recalculate Nutrition Target",
        subtitle: "Update an existing target after your metrics or intent changes.",
        details: [
          "Recalculate Nutrition Target appears when an active nutrition goal already exists.",
          "It reopens the target calculation flow so updated weight, height, activity level, or goal choice can change the active target.",
          "Use it when the numbers on Nutrition no longer match your current training or body-status intent.",
        ],
        terms: [
          {
            label: "Recalculate",
            value: "Refresh the active calorie and macro target from updated setup data.",
          },
        ],
      },
    ],
    terms: [],
  },
  mastery: {
    title: "Muscle Mastery",
    description:
      "New to the gym side of FitTrack? Muscle Mastery is your progress map: it turns your tracked workouts into EXP, muscle tiers, achievements, and season standing so you can see what is growing and what to train next.",
    steps: [
      "Start with Summary to read the Snapshot, top muscle, active season, and Quick Links.",
      "Tap the Mastery Views tabs to switch between Summary, Milestones, Muscle EXP, and Leaderboard.",
      "Tap a help card below to expand one detailed guide at a time for the matching Muscle Mastery section.",
      "Use Open Workout, Open Nutrition, or Ask BrodigyAI when the data suggests a next training, food, or guidance step.",
      "If a Progress Status review notice appears, some gains may stay pending until the integrity review closes.",
    ],
    detailTitle: "Mastery views",
    detailIntro:
      "These cards match the Muscle Mastery tabs. Tap one when you want a plain-English guide to the numbers on screen.",
    detailCards: [
      {
        title: "Summary",
        subtitle: "Snapshot, top muscle, Progress Status, and Quick Links.",
        details: [
          "Snapshot reads from your progression profile, season standing, and muscle EXP records. Total EXP is your confirmed progression total, or the sum of muscle EXP when the profile total is not available.",
          "Current Streak shows the streak count on your progression profile. It rises when eligible progress continues and resets according to the progression rules owned by the backend.",
          "Season Points and Season Rank come from the active season standing. Rank can show a number, Unranked, Hidden, Under review, or No active season depending on standing, privacy, and integrity status.",
          "The top muscle card is the muscle group with the most EXP. Its subtitle shows EXP and total volume in kilograms, while the tier label shows the current backend rank display for that muscle.",
          "Quick Links are action shortcuts: Open Workout creates new tracked progress evidence, Open Nutrition helps align food goals with training focus, and Ask BrodigyAI opens a new chat from Muscle Mastery context.",
        ],
        terms: [
          {
            label: "Total EXP",
            value: "Confirmed progression EXP used by mastery, milestones, and season standing.",
          },
          {
            label: "Season Rank",
            value: "Your active season placement unless privacy, hidden standing, or review status masks it.",
          },
          {
            label: "Top muscle",
            value: "The muscle group currently leading your Muscle EXP records.",
          },
        ],
      },
      {
        title: "Milestones",
        subtitle: "Achievement-style goals with progress, unlocks, claims, and rewards.",
        details: [
          "Milestones are achievements published by the progression system. Muscle Mastery only shows visible milestones, including locked, in-progress, unlocked, and claimed progress returned for your account.",
          "Each card shows the achievement title, description or trigger type, category, current progress value, target value, percent bar, and status.",
          "In-progress milestones move toward their target as backend-confirmed progression events count for that achievement. Hidden milestones stay out of the member view.",
          "When a milestone reaches its target, it becomes Unlocked and the Claim button appears. Claiming marks it as Claimed, fires the local celebration, and refreshes the progression caches.",
          "Milestones feed Muscle Mastery's gamification loop by turning repeated training progress into visible achievements, claim moments, and season momentum instead of only raw numbers.",
        ],
        terms: [
          {
            label: "In progress",
            value: "The achievement is still counting progress toward its target.",
          },
          {
            label: "Unlocked",
            value: "The target has been reached and the achievement can be claimed.",
          },
          {
            label: "Claimed",
            value: "The unlocked achievement has already been collected on this account.",
          },
        ],
      },
      {
        title: "Muscle EXP",
        subtitle: "All muscle groups, EXP totals, volume, tiers, search, and rank filters.",
        details: [
          "Muscle EXP lists the muscle mastery records returned for your member account, sorted from highest EXP to lowest EXP.",
          "Each muscle group card shows EXP, total volume in kilograms, and its current tier. The visible tiers are Bronze, Silver, Gold, Platinum, and Adamantite.",
          "EXP and volume increase when eligible tracked workout progression is processed for the muscle group. The backend owns the exact EXP and tier thresholds, so the app displays the confirmed rankDisplay rather than guessing formulas.",
          "When enough confirmed EXP lands for a muscle group, its tier can rise. Use the rank chips to filter by tier and the search field to find a specific muscle group.",
          "You can use this view to set training and nutrition intent: bring up lagging muscles with workouts, protect leading muscles with recovery, and use Nutrition when a goal needs food support.",
        ],
        terms: [
          {
            label: "EXP",
            value: "Confirmed points for a muscle group from processed progression activity.",
          },
          {
            label: "Total volume",
            value: "The total kilograms recorded for that muscle group's progression record.",
          },
          {
            label: "Tier",
            value: "The backend rank display for the muscle group, from Bronze through Adamantite.",
          },
        ],
      },
      {
        title: "Leaderboard",
        subtitle: "Season ranks, total EXP, participation, and ranking privacy.",
        details: [
          "Leaderboard lists visible member rankings for the active progression season. Each row shows display name, rank number, total EXP, and whether the row is you or another gym member.",
          "Your own placement depends on active membership access, progression data, active season standing, ranking governance, and the ranking visibility stored on your profile.",
          "Ranking privacy is optional. Public can show your profile name, Anonymous keeps you ranked while masking identity, and Private hides your visible ranking from member-facing leaderboards while keeping progression history.",
          "If your visibility is Private, Muscle Mastery hides the leaderboard list and explains that progression still counts in history. Hidden standing or review status can also keep a rank from being displayed.",
          "To participate visibly, keep membership access active, earn confirmed progression EXP, and leave ranking visibility as Public or Anonymous from Profile ranking privacy.",
        ],
        terms: [
          {
            label: "Total EXP",
            value: "The leaderboard value used to compare ranked members for the current view.",
          },
          {
            label: "Private",
            value: "A visibility choice that hides member-facing standing while preserving progression history.",
          },
          {
            label: "Anonymous",
            value: "A visibility choice that keeps leaderboard participation while masking identity.",
          },
        ],
      },
    ],
    terms: [],
  },
  workout: {
    title: "Workout",
    description:
      "Workout is the live training screen: it manages member access, camera tracking, exercise selection, subject lock, and the final save step for a tracked set.",
    steps: [
      "Confirm your access state and exercise reference before starting a tracked set.",
      "Keep your body visible to the camera and use lock controls when live tracking is active.",
      "Read Connected Plan and Live Pose Feedback below the camera when you need to understand what the tracker is using and what form cues it is giving.",
      "Tap a card below when tracking, exercise references, or finishing the session needs explanation.",
    ],
    detailTitle: "Workout sections",
    detailIntro:
      "These cards follow the workout flow from access checks through live tracking and session save.",
    detailCards: [
      {
        title: "Membership access",
        subtitle: "Why Workout may show a locked or recovery state.",
        details: [
          "Workout checks member access before live tracking becomes available.",
          "Locked states can appear for pending verification, revoked access, or no membership card.",
          "When access is blocked, use the visible Open Membership Details or Profile action instead of trying to start camera tracking.",
        ],
        terms: [
          {
            label: "Membership card",
            value: "Your member access record for gym-only features.",
          },
          {
            label: "Revoked",
            value: "An access state where member features are no longer available.",
          },
        ],
      },
      {
        title: "Real-time exercise tracking",
        subtitle: "Camera preview, Initialize Camera, timer, kcal, reps, and controls.",
        details: [
          "Initialize Camera prepares the live camera preview for tracking.",
          "The tracking view can show front/back camera toggle, timer, estimated calories, reps, and session controls.",
          "Equipment labels such as Dumbbell detected or Dumbbell declared explain what load context the tracker is using when available.",
          "Start, stop, pause, and resume affect the current live workout run. Keep the camera view clear so the tracker can read movement.",
        ],
        terms: [
          {
            label: "Live session",
            value: "An active workout run that records movement, time, and set evidence.",
          },
          {
            label: "Reps",
            value: "Detected repetitions for the current tracked exercise.",
          },
        ],
      },
      {
        title: "Subject lock",
        subtitle: "Lock on me, Unlock target, and visible body alignment.",
        details: [
          "Lock on me helps the tracker focus on the visible person in frame.",
          "You can tap Lock on me, or use the visible gesture-hold prompt when live landmarks are clear enough.",
          "Gesture hold shows progress toward an automatic subject lock; Unlock target releases either a manual or gesture-based lock.",
          "Unlock target releases that focus when you need to reset the camera or body position.",
          "Counting can pause or become unavailable when the lock is unstable or the body is not visible enough for reliable tracking.",
        ],
        terms: [
          {
            label: "Subject lock",
            value: "The tracker focus on the person being counted in the camera preview.",
          },
          {
            label: "Alignment",
            value: "How clearly your body is positioned for movement tracking.",
          },
        ],
      },
      {
        title: "Exercise references",
        subtitle: "Reference catalog, auto-detection, and creating from a session.",
        details: [
          "Exercise References opens the available movement catalog for tracked workouts.",
          "You can select a reference, use auto-detection when supported, or create an exercise reference from a session.",
          "If the catalog is empty, tracked set saving and EXP sync can be blocked because the workout needs a valid exercise reference.",
        ],
        terms: [
          {
            label: "Exercise match",
            value: "The selected or detected movement connected to the live set.",
          },
          {
            label: "EXP sync",
            value: "Progression updates that depend on saved, valid workout evidence.",
          },
        ],
      },
      {
        title: "Connected plan",
        subtitle: "The live plan, selected exercise, and session status under the camera.",
        details: [
          "Connected Plan tells you whether a workout plan, selected exercise reference, or auto-detection is driving the current session.",
          "Use it before recording so you know what movement FitTrack is trying to count.",
          "If no plan or catalog is loaded, Exercise References is the next place to check.",
        ],
        terms: [
          {
            label: "Selected exercise",
            value: "The movement reference FitTrack is using for counting and saving the set.",
          },
          {
            label: "Auto-detection",
            value: "The tracker trying to match movement when a manual reference is not fixed yet.",
          },
        ],
      },
      {
        title: "Live pose feedback",
        subtitle: "Form and tracking cues shown below the workout stats.",
        details: [
          "Live Pose Feedback lists the current cues from the pose tracker or fallback guidance.",
          "Use these cues to adjust body position, visibility, and movement quality while recording.",
          "If feedback is generic, the camera or exercise reference may not be fully locked in yet.",
        ],
        terms: [
          {
            label: "Pose feedback",
            value: "Real-time form or visibility guidance from the workout tracking view.",
          },
        ],
      },
      {
        title: "Finish workout",
        subtitle: "Saving one live workout set or choosing Keep Going.",
        details: [
          "Finish opens the completion modal for the active workout.",
          "Confirming Finish saves one live workout set from the current session data.",
          "Keep Going cancels the finish action and returns you to the workout instead of saving that set immediately.",
        ],
        terms: [
          {
            label: "Finish",
            value: "The action that saves the current live workout set.",
          },
        ],
      },
    ],
    terms: [],
  },
  chathistory: {
    title: "Chat History",
    description:
      "Chat History keeps your BrodigyAI conversations organized, including active chats, deleted sessions, search, date filtering, and restore/delete actions.",
    steps: [
      "Confirm member access first if the history list is locked.",
      "Use search, date filters, and status chips to find the conversation you need.",
      "Use the Chat History FAB for New Chat or Delete Conversation; Delete Conversation is hidden while viewing Deleted Chats.",
      "Tap a card below to understand the list, new chat button, delete mode, and restore behavior.",
    ],
    detailTitle: "Chat History sections",
    detailIntro:
      "These cards explain how saved BrodigyAI chats are found, grouped, deleted, and restored.",
    detailCards: [
      {
        title: "Membership access",
        subtitle: "Why chat history can be gated for non-member access.",
        details: [
          "Chat history is member-gated when the account does not have the required access.",
          "The visible recovery action is Open Profile, where member access can be reviewed.",
          "When access is locked, the list stays unavailable instead of showing stale or private chat data.",
        ],
        terms: [
          {
            label: "Access gate",
            value: "A locked state that protects member-only features until access is allowed.",
          },
        ],
      },
      {
        title: "Search and filters",
        subtitle: "Conversation search, date range, and Active/All/Deleted chips.",
        details: [
          "Search narrows conversations by visible conversation information.",
          "The date range picker helps limit results to a specific time window.",
          "Active, All, and Deleted filter chips change which saved sessions appear in the list.",
        ],
        terms: [
          {
            label: "Deleted filter",
            value: "A list view that shows conversations moved to Deleted Chats.",
          },
        ],
      },
      {
        title: "Conversation list",
        subtitle: "Grouped cards with title, context, last active time, and deleted state.",
        details: [
          "Conversations are grouped by date so older and newer chat activity is easier to scan.",
          "Each card can show the conversation title, context label, last active time, and a Deleted marker when applicable.",
          "Tap an active conversation to review or continue it in BrodigyAI.",
        ],
        terms: [
          {
            label: "Conversation",
            value: "A saved BrodigyAI chat thread.",
          },
          {
            label: "Context label",
            value: "A short label describing the area or topic tied to the chat.",
          },
        ],
      },
      {
        title: "Deleted chats and restore",
        subtitle: "Selection mode, Deleted Chats, and restoring rows.",
        details: [
          "Delete Conversation enters selection mode so active chats can be moved to Deleted Chats.",
          "Deleted rows are marked and can be found through the Deleted filter.",
          "A deleted conversation can be restored from the deleted list when the restore action is available.",
        ],
        terms: [
          {
            label: "Selection mode",
            value: "A temporary state for choosing one or more conversations to delete.",
          },
        ],
      },
      {
        title: "FAB - New Chat",
        subtitle: "Start a fresh BrodigyAI session.",
        details: [
          "New Chat opens a fresh BrodigyAI conversation.",
          "Use it when your next question should not inherit an older chat's context.",
          "For account, payment, or booking changes, ask for guidance if helpful, then use the matching FitTrack screen.",
        ],
        terms: [
          {
            label: "BrodigyAI",
            value: "FitTrack's gym guidance assistant.",
          },
        ],
      },
      {
        title: "FAB - Delete Conversation",
        subtitle: "Enter selection mode for active conversations.",
        details: [
          "Delete Conversation appears when the FAB is visible and you are not already viewing Deleted Chats.",
          "It enters selection mode so active chats can be moved to Deleted Chats.",
          "The action is hidden in the Deleted filter because that view focuses on deleted rows and restore behavior instead.",
        ],
        terms: [
          {
            label: "Deleted filter",
            value: "The Chat History view where deleted sessions can be reviewed and restored.",
          },
        ],
      },
    ],
    terms: [],
  },
  chatbot: {
    title: "Brodigy AI",
    description:
      "BrodigyAI is FitTrack's chat assistant for gym guidance, screen context, workouts, and member questions that belong inside the app.",
    steps: [
      "Check the chat state first, especially if the session is locked, frozen, or deleted.",
      "Ask one clear FitTrack or gym-related question at a time.",
      "Tap the cards below when the composer, message states, or deleted-session behavior needs explanation.",
    ],
    detailTitle: "BrodigyAI sections",
    detailIntro:
      "These cards explain the chat states and visible controls without overstating what the assistant can change for you.",
    detailCards: [
      {
        title: "Membership access",
        subtitle: "Locked chat states before member access is allowed.",
        details: [
          "A locked chat displays the membership-card gate when access is not available.",
          "No normal chat action is shown until the account is allowed to use the assistant.",
          "Use the visible access route rather than typing into a disabled composer.",
        ],
        terms: [
          {
            label: "Membership gate",
            value: "The locked chat state shown until member access is available.",
          },
        ],
      },
      {
        title: "Conversation messages",
        subtitle: "Session title, status text, AI bubbles, user bubbles, and typing dots.",
        details: [
          "The conversation header shows the active session title when one is available.",
          "Status and error text explain when the assistant is loading, blocked, or unable to complete a request.",
          "Messages appear as AI bubbles and user bubbles, with pending typing dots while a response is being prepared.",
        ],
        terms: [
          {
            label: "AI bubble",
            value: "A BrodigyAI response message displayed in the conversation.",
          },
          {
            label: "User bubble",
            value: "A message you sent to the assistant.",
          },
        ],
      },
      {
        title: "Deleted sessions",
        subtitle: "Read-only sessions that must be restored from history before sending.",
        details: [
          "Deleted chat sessions are read-only inside the chat screen.",
          "You cannot continue a deleted session until it is restored from Chat History.",
          "This keeps deleted-session behavior consistent between the chat screen and the history list.",
        ],
        terms: [
          {
            label: "Read-only",
            value: "A state where messages can be reviewed but new messages cannot be sent.",
          },
        ],
      },
      {
        title: "Message composer",
        subtitle: "Input states and the ArrowUp send button.",
        details: [
          "The message input placeholder changes depending on whether the session is frozen, locked, deleted, or ready.",
          "The ArrowUp button sends only when the composer is allowed to send.",
          "For account, payment, or booking changes, ask for guidance if helpful, then use the FitTrack screen that owns the action.",
        ],
        terms: [
          {
            label: "Composer",
            value: "The message input area at the bottom of the chat.",
          },
          {
            label: "Can send",
            value: "The internal ready state that enables the send action.",
          },
        ],
      },
    ],
    terms: [],
  },
  profile: {
    title: "Profile",
    description:
      "Profile collects your account identity, member access, fitness summary, ranking privacy, coach profile details, and account lifecycle actions.",
    steps: [
      "Start at the profile header to confirm the account you are viewing.",
      "Use member or coach sections based on your role and current access.",
      "Open the cards below to understand profile actions, ranking privacy, and account termination.",
    ],
    detailTitle: "Profile sections",
    detailIntro:
      "These cards explain the profile sections that appear for members and coaches.",
    detailCards: [
      {
        title: "Profile header",
        subtitle: "Avatar, name, email, and account meta.",
        details: [
          "The header confirms the profile identity with avatar, name, and email.",
          "It can also show account meta such as member-since information.",
          "Use this area first when checking that you are working with the expected FitTrack account.",
        ],
        terms: [
          {
            label: "Account meta",
            value: "Small profile facts such as member-since or account details.",
          },
        ],
      },
      {
        title: "Fitness Summary or Fitness Progress",
        subtitle: "Unlocked mastery stats, or the locked member-access gate.",
        details: [
          "For members, the fitness summary can show mastery stats, Current Badge, Gym Standing, Health Snapshot, Open Muscle Mastery, and Open Workout.",
          "When member access is locked, this section appears as Fitness Progress and explains why stats, badges, and achievements are unavailable.",
          "Use the visible member-access route when the locked version appears instead of expecting the mastery shortcuts to be available.",
          "Use Open Muscle Mastery for EXP and achievements, and Open Workout for live training.",
        ],
        terms: [
          {
            label: "Current Badge",
            value: "A member-facing progression badge from the fitness summary.",
          },
          {
            label: "Gym Standing",
            value: "The visible ranking or standing summary when available.",
          },
        ],
      },
      {
        title: "Ranking privacy",
        subtitle: "Public, Anonymous, and Private leaderboard visibility.",
        details: [
          "Ranking privacy controls how your progression appears to other members.",
          "Public can show your profile identity, Anonymous keeps participation while masking identity, and Private hides member-facing leaderboard standing.",
          "Profile asks for confirmation before applying ranking visibility changes.",
        ],
        terms: [
          {
            label: "Public",
            value: "Ranking visibility that can show your profile identity.",
          },
          {
            label: "Anonymous",
            value: "Ranking visibility that keeps participation while masking identity.",
          },
          {
            label: "Private",
            value: "Ranking visibility that hides member-facing leaderboard standing.",
          },
        ],
      },
      {
        title: "Account and membership",
        subtitle: "Edit Profile, Member Access, QR, and card purchase.",
        details: [
          "Profile actions can include Edit Profile, Member Access, Attendance QR, and Membership Card Purchase.",
          "Use Member Access or Membership Card Purchase when access is missing or needs repair.",
        ],
        terms: [
          {
            label: "Attendance QR",
            value: "The QR action used for gym attendance workflows when available.",
          },
        ],
      },
      {
        title: "Coach profile",
        subtitle: "Hourly rate, active slots, availability status, and editable slots.",
        details: [
          "Coach accounts can show Hourly Rate, Active Slots, Edit Coach Profile, and Availability Status.",
          "Availability slots can be edited when they are not admin-locked.",
          "Use this section to understand coach scheduling and profile information without mixing it with member-only fitness summary actions.",
        ],
        terms: [
          {
            label: "Active Slots",
            value: "The coach availability slots currently counted as active.",
          },
          {
            label: "Admin-locked",
            value: "A coach availability state that cannot be edited from the profile screen.",
          },
        ],
      },
      {
        title: "Account termination",
        subtitle: "Request or cancel account termination.",
        details: [
          "Member accounts can show Request Account Termination when no termination request is active.",
          "If a request already exists, the visible action can become Cancel Termination Request.",
          "Use the confirmation flow carefully because this action affects the account lifecycle rather than a single workout or booking.",
        ],
        terms: [
          {
            label: "Termination request",
            value: "A member account request to start or cancel account termination handling.",
          },
        ],
      },
    ],
    terms: [],
  },
  settings: {
    title: "Settings",
    description:
      "Settings controls how FitTrack behaves for you: appearance, notifications, security, privacy, support, feedback, and terms live here.",
    steps: [
      "Open the settings card that matches the preference or support task you want.",
      "Watch for unsaved-change banners or confirmation text before leaving a modal.",
      "Use the expandable cards below to understand what each settings area can actually do.",
    ],
    detailTitle: "Settings sections",
    detailIntro:
      "These cards explain each settings panel from the live mobile settings implementation.",
    detailCards: [
      {
        title: "Preferences",
        subtitle: "Notification and Appearance cards.",
        details: [
          "Preferences is the top-level settings area for changing how the app feels and how alerts behave.",
          "The Notifications card opens notification preference controls.",
          "The Appearance card opens theme, font, and animation controls.",
        ],
        terms: [
          {
            label: "Preference",
            value: "A setting that changes how FitTrack behaves for your account.",
          },
        ],
      },
      {
        title: "Appearance",
        subtitle: "Theme, font, animations, unsaved changes, Cancel, and Save.",
        details: [
          "Appearance lets you adjust theme, font, and animation preferences.",
          "When changes are not saved yet, the panel shows an unsaved-changes banner.",
          "Cancel leaves without applying new edits, while Save applies the selected appearance preferences.",
        ],
        terms: [
          {
            label: "Theme",
            value: "The selected visual mode for the app.",
          },
          {
            label: "Unsaved changes",
            value: "Edits that have not been applied through Save yet.",
          },
        ],
      },
      {
        title: "Notifications",
        subtitle: "Live alert groups controlled by preference toggles.",
        details: [
          "Notifications shows alert groups from live notification preference data.",
          "Each visible group can be toggled based on what the backend says is configurable.",
          "Use this panel when reminders are missing, noisy, or need to be adjusted for your account.",
        ],
        terms: [
          {
            label: "Alert group",
            value: "A notification category that can be enabled or disabled when available.",
          },
        ],
      },
      {
        title: "Security",
        subtitle: "Change Password requirements and post-change logout.",
        details: [
          "Change Password requires current password, new password, and confirmation.",
          "The requirement checklist shows whether the new password satisfies the visible rules before submission.",
          "After a successful password change, the flow confirms that logout follows the change.",
        ],
        terms: [
          {
            label: "Requirement checklist",
            value: "The visible password rules used to confirm the new password is acceptable.",
          },
        ],
      },
      {
        title: "Privacy",
        subtitle: "Trainer activity visibility, usage analytics, and Request Export.",
        details: [
          "Privacy shows toggles for trainer activity visibility and usage analytics.",
          "Request Export is visible in this panel, but the help text does not promise an export result beyond the shown action.",
          "Use privacy controls when you want to adjust what can be surfaced or measured for your account.",
        ],
        terms: [
          {
            label: "Usage analytics",
            value: "A privacy preference for whether app usage data can be collected for analytics.",
          },
          {
            label: "Request Export",
            value: "The visible privacy action for requesting account data export handling.",
          },
        ],
      },
      {
        title: "Support",
        subtitle: "Help Center, feedback form, and Terms.",
        details: [
          "Help Center shows FAQs for common support questions.",
          "The feedback form supports Bug Report, Feature Request, and General Feedback, includes a message limit, and uses Send Feedback to submit.",
          "Terms shows policy cards for the app's rules and usage expectations.",
        ],
        terms: [
          {
            label: "App feedback",
            value: "A bug report, feature request, or general message sent through Settings.",
          },
          {
            label: "Terms",
            value: "Policy cards that explain app rules and usage expectations.",
          },
        ],
      },
    ],
    terms: [],
  },
};

export function getMobileHelpContent(tab: TabKey): MobileHelpContent {
  return HELP_BY_TAB[tab] ?? DEFAULT_HELP;
}
