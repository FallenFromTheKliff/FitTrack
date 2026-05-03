# FitTrack Mobile - UI / Section / Buttons / Primary Use

This version is aligned to the current mobile codebase. It is written for UI walkthrough and feature understanding first.

---

## ROLE ACCESS MATRIX

### Allowed app roles
- `USER`
- `COACH`

### Not allowed in the mobile member app
- `ADMIN`
- `STAFF`

### Core access rules
- IF auth is still loading -> render nothing
- IF user is not authenticated -> redirect to login
- IF role is not `USER` or `COACH` -> redirect to login

### Global gate rules
- `Frozen account`
  - reduces or blocks actions across member-facing flows
- `Membership card access`
  - unlocks or blocks:
    - BrodigyAI
    - Muscle Mastery
    - Workout
    - premium nutrition actions
    - attendance QR

---

## GLOBAL MOBILE SHELL

### Splash Screen
- Buttons inside:
  - none
- Primary use:
  - hold the app while auth hydration and fonts finish loading

### Header
- Buttons inside:
  - `Menu` -> opens sidebar
  - `Back` -> shown on chatbot screen only; returns to chat history
- Primary use:
  - global top navigation and active-screen framing

### Sidebar
- Buttons inside:
  - navigation items
  - `Logout` -> closes sidebar, then opens logout confirmation
- Primary use:
  - tab navigation and account exit

### Floating Action Button
- Buttons inside:
  - screen-specific quick actions from the active screen
- Primary use:
  - expose the most important shortcuts for the active screen

### Global Logout Confirmation
- Buttons inside:
  - `Sign Out`
  - `Cancel`
- Primary use:
  - safely confirm logout

### Shared Reservation Modal
- Buttons inside:
  - modal-owned booking fields and submit/cancel actions
- Primary use:
  - allow venue reservation from multiple screens

---

## LOGIN SCREEN

### Branding / Hero Section
- Buttons inside:
  - none
- Primary use:
  - identify the app and member portal

### Login Form
- Buttons inside:
  - `Sign In` -> submit login credentials
  - `Forgot Password?` -> open forgot-password modal
- Primary use:
  - authenticate an existing user

### Footer Action
- Buttons inside:
  - `Create Account` -> go to registration
- Primary use:
  - move a new user into signup

### Forgot Password Modal
- Buttons inside:
  - `CANCEL` on the email step
  - `BACK` on later steps
  - `SEND CODE`
  - `VERIFY CODE`
  - `Resend`
  - `RESET PASSWORD`
- Primary use:
  - begin password recovery without leaving login

### Logic notes
- IF login returns a normal error -> show status text
- IF login returns locked-account state -> keep the message visible longer
- IF login requires OTP -> show verification-sent status
- IF login succeeds -> show buffer screen -> commit login -> enter app

---

## REGISTRATION SCREEN

### Back Action
- Buttons inside:
  - `Back` -> return to login
- Primary use:
  - leave registration safely

### Registration Form
- Buttons inside:
  - `Create Account` -> submit registration
- Primary use:
  - create a new mobile member account

### Password Requirements Panel
- Buttons inside:
  - none
- Primary use:
  - explain password rules while the user types

### OTP Modal
- Buttons inside:
  - `VERIFY CODE`
  - `Resend`
  - dismiss / close action
- Primary use:
  - verify the new account before login completes

### Logic notes
- phone input supports PH formats and is normalized before submit
- IF registration succeeds -> open OTP modal
- IF OTP succeeds -> show buffer -> commit login -> enter app

---

## HOME SCREEN

### Greeting Header
- Buttons inside:
  - none
- Primary use:
  - show current user name, current date, and current time

### Stat Cards
- Buttons inside:
  - none
- Primary use:
  - summarize key metrics based on role and access state

### Schedule For Today
- Buttons inside:
  - booking cards -> open booking detail modal
  - `Book Now` -> shown when there is no booking and the user is not a coach
- Primary use:
  - show immediate schedule context

### Live Snapshot
- Buttons inside:
  - none
- Primary use:
  - summarize nutrition, streak, mastery, and access state

### Workout Suggestions / Quick Actions
- Buttons inside:
  - dynamic actions depending on user state, including:
    - `Book Now`
    - `View Bookings`
    - `View Schedule`
    - `Set Nutrition Goal`
    - `Start Workout`
    - `Continue Workout`
    - `Open Facilities`
    - `View Coach Schedule`
    - `Unlock Member Access`
- Primary use:
  - route the user to the best next action

### Pinned Goal Banner
- Buttons inside:
  - none
- Primary use:
  - show the single most relevant next focus for the user

### Booking Detail Modal
- Buttons inside:
  - close action
  - modal-owned booking actions
- Primary use:
  - inspect a selected booking from the home schedule

---

## BOOKINGS SCREEN

### Search Row
- Buttons inside:
  - filter icon button -> open or close the filter panel
- Primary use:
  - search bookings and reveal filters

### Filter Panel
- Buttons inside:
  - top chips:
    - `Reservations`
    - `Appointments`
    - `Coach Schedule` for coach users
  - status chips
  - start date button
  - end date button
  - start date reset
  - end date reset
- Primary use:
  - control which booking records are visible

### Date-Grouped Booking List
- Buttons inside:
  - booking cards -> open booking detail modal
- Primary use:
  - show reservations, appointments, or coach schedule grouped by date

### Floating Actions
- Buttons inside:
  - `Make Reservation`
  - `Book a Trainer`
- Primary use:
  - start the two main member booking flows

### Booking Detail Modal
- Buttons inside:
  - dynamic action buttons from the selected booking:
    - `Cancel Reservation`
    - `Pay with PayMongo`
    - `Cancel Appointment`
    - `Confirm`
    - `Decline`
    - `Mark Complete`
  - `Close`
- Primary use:
  - apply status-changing actions to the selected booking

### Appointment Modal
- Buttons inside:
  - coach cards / coach selection actions
  - date picker trigger
  - time picker trigger
  - `Cancel` on first step
  - `Back` on later step
  - `Continue`
  - final appointment-booking action
- Primary use:
  - book a trainer appointment

### Reservation Modal
- Buttons inside:
  - date picker trigger
  - venue cards
  - duration / slot selection controls
  - add note action
  - remove note action
  - `Cancel`
  - final reservation or payment action
- Primary use:
  - create a venue reservation

### Calendar Modals
- Buttons inside:
  - previous month
  - next month
  - view toggles
  - day buttons
  - month buttons
  - year buttons
  - `Cancel`
  - `Clear` when empty values are allowed
  - `Today`
- Primary use:
  - set date-range filters and date choices

### Logic notes
- IF role is `COACH` -> visible section is forced to coach schedule
- IF `openReservation=true` is passed and the user is eligible -> reservation modal opens automatically
- IF PayMongo returns a checkout URL -> mobile opens the external checkout page

---

## FACILITIES SCREEN

### Header Row
- Buttons inside:
  - refresh icon button -> reload facility data
- Primary use:
  - title the page and refresh the latest venue map state

### Floor Toggle
- Buttons inside:
  - floor buttons for each level
- Primary use:
  - switch between available floors

### Floor Snapshot Card
- Buttons inside:
  - none
- Primary use:
  - summarize mapped zones and facility mix on the active floor

### Floor Blueprint / Map Canvas
- Buttons inside:
  - venue/zone tiles -> open details modal
  - empty-floor jump action when another floor has published zones
- Primary use:
  - let the user explore the facility layout spatially

### Legend
- Buttons inside:
  - none
- Primary use:
  - explain icons and zone names on the map

### Floating Actions
- Buttons inside:
  - `Chat with BrodigyAI`
  - `Make Reservation`
- Primary use:
  - connect facility browsing with support and booking

### Venue Details Modal
- Buttons inside:
  - `Close`
  - `Reserve Now` when reservation is allowed
- Primary use:
  - show the selected venue's details

---

## NUTRITION SCREEN

### Calories Summary Card
- Buttons inside:
  - `Set Nutrition Target` when no active target is available
- Primary use:
  - compare today's calories against the active goal

### Macro Breakdown
- Buttons inside:
  - none
- Primary use:
  - compare protein, carbs, and fats to target values

### Coaching Signals
- Buttons inside:
  - none
- Primary use:
  - explain the most important current nutrition guidance

### Recommended Next Bites
- Buttons inside:
  - none
- Primary use:
  - suggest foods that help close remaining nutrition gaps

### Curated Food Catalog
- Buttons inside:
  - none
- Primary use:
  - expose the seeded food list for quick nutrition understanding

### Today's Nutrition Log
- Buttons inside:
  - `Log Meal` when premium nutrition is available and the account is not frozen
- Primary use:
  - review or create meal log entries

### Nutrition Snapshot
- Buttons inside:
  - none
- Primary use:
  - summarize live TDEE/BMR/target backend data

### Floating Actions
- Buttons inside:
  - `Create Nutrition Goal` or `Recalculate Nutrition Target`
  - `Launch BrodigyAI Mini-Chat`
  - profile redirect action instead of AI when member-card access is locked
- Primary use:
  - expose the strongest nutrition-related next steps

### Goals Modal
- Buttons inside:
  - calorie date picker trigger
  - gender choice buttons
  - activity-level choice buttons
  - fitness-goal choice buttons
  - `Cancel`
  - `Save Target`
- Primary use:
  - create or update nutrition targets

### Nutrition Log Modal
- Buttons inside:
  - meal-picker triggers
  - unit-picker triggers
  - calorie date picker trigger
  - picker modal `Done`
  - `Cancel`
  - `Save Log`
- Primary use:
  - add a meal log entry

### Logic notes
- IF premium nutrition is locked -> meal-log area shows a premium gate instead of interactive logging
- the shared FAB system can signal this page to open the goals modal automatically

---

## MUSCLE MASTERY SCREEN

### Hero Card
- Buttons inside:
  - none
- Primary use:
  - summarize season status, current streak, and top mastery context

### Quick Links
- Buttons inside:
  - `Open Workout`
  - `Open Nutrition`
  - `Ask BrodigyAI`
- Primary use:
  - send the user to the most relevant connected modules

### Access Gate
- Buttons inside:
  - `Open Membership Details` when access is locked
- Primary use:
  - explain why mastery is unavailable and route the user to profile

### Loading / Error / Empty States
- Buttons inside:
  - `Retry`
  - `Start First Workout`
- Primary use:
  - recover from failed loads or start progression if there is no data yet

### Progress Status
- Buttons inside:
  - none
- Primary use:
  - surface integrity review states when present

### Snapshot
- Buttons inside:
  - none
- Primary use:
  - show top-level mastery, streak, and season metrics

### Season and Privacy
- Buttons inside:
  - `Public`
  - `Anonymous`
  - `Private`
- Primary use:
  - control how the user appears in leaderboards

### Milestone Progress
- Buttons inside:
  - none
- Primary use:
  - show active milestone progress

### Recent Unlocks
- Buttons inside:
  - none
- Primary use:
  - show the latest unlocked or claimed milestones

### Top Muscle Groups
- Buttons inside:
  - none
- Primary use:
  - rank muscle groups by EXP and total tracked work

### Gym Leaderboard
- Buttons inside:
  - none
- Primary use:
  - show current gym ranking standings when visibility allows

### Achievement Highlights
- Buttons inside:
  - none
- Primary use:
  - show milestone-backed achievement cards

---

## WORKOUT SCREEN

### Membership Gate
- Buttons inside:
  - `Open Membership Details`
- Primary use:
  - block non-member workout access and route the user to profile

### Live Workout Surface
- Buttons inside:
  - `Initialize Camera`
  - `Toggle Camera Facing`
  - `Start Recording`
  - `Pause`
  - `Resume`
  - `Stop`
  - `Open Exercise References`
  - `Use Auto Detection`
  - `Toggle Subject Lock`
  - exercise reference selection actions
  - exercise confirmation actions
- Primary use:
  - run live tracked workout sessions using camera and pose analysis

### Exercise Selection / Confirmation Modal Layer
- Buttons inside:
  - `Use plan exercise`
  - candidate exercise chips
  - exercise list actions
  - `Use` for custom label
  - `Keep Paused`
  - `Auto Detect`
  - `Close`
- Primary use:
  - stabilize the tracked exercise label for rep counting and set logging

### Finish Confirmation
- Buttons inside:
  - finish confirm action
  - finish cancel action
- Primary use:
  - safely finalize and save the current workout

### Logic notes
- before recording, the screen makes sure camera access, pose runtime, and workout session state exist
- on finish, it finalizes pose data, logs the set, completes the workout session, and resets runtime state

---

## CHAT HISTORY SCREEN

### Search Row
- Buttons inside:
  - filter button
- Primary use:
  - search chat history and reveal filters

### Filter Panel
- Buttons inside:
  - start date selector
  - end date selector
  - status chips:
    - `Active`
    - `All`
    - `Deleted`
- Primary use:
  - narrow which sessions are shown

### Session List
- Buttons inside:
  - active session cards -> open that conversation
  - deleted session `Restore` button
- Primary use:
  - browse saved BrodigyAI sessions grouped by date

### Floating Actions
- Buttons inside:
  - `New Chat`
  - `Delete Conversation` when not in deleted filter
- Primary use:
  - start a new chat or enter archive-selection mode

### Delete Selection Footer
- Buttons inside:
  - `Cancel`
  - `Delete (count)`
- Primary use:
  - finish or leave delete mode

### Confirm Modals
- Buttons inside:
  - delete confirmation actions
  - restore confirmation actions
- Primary use:
  - confirm archive and restore operations

### Logic notes
- IF member-card access is locked -> the page shows a membership gate
- delete mode archives conversations instead of hard-deleting them

---

## CHATBOT SCREEN

### Session Title / Status Area
- Buttons inside:
  - none
- Primary use:
  - show current conversation title and inline status/error text

### Message Feed
- Buttons inside:
  - none directly
- Primary use:
  - show AI and user messages, including pending send state

### Composer Bar
- Buttons inside:
  - send arrow button
- Primary use:
  - send a new message into the current or new chat session

### Locked / Deleted / Pending States
- Buttons inside:
  - none directly on the route wrapper
- Primary use:
  - block sending when the account is frozen, member access is locked, or the session is deleted

### Logic notes
- IF `sessionId` is `new` -> this is a draft conversation
- IF `from=nutrition` -> the AI context switches to nutrition
- IF the backend returns a new session id -> the screen replaces the route with the real session

---

## PROFILE SCREEN

### Profile Header
- Buttons inside:
  - none
- Primary use:
  - show avatar, name, email, and member-since metadata

### Member - Fitness Summary
- Buttons inside:
  - `Retry Fitness Summary` when query fails
  - `Open Muscle Mastery`
  - `Open Workout`
- Primary use:
  - summarize badge, standing, and health state

### Member - Account Section
- Buttons inside:
  - `Edit Profile`
  - `Attendance QR`
  - `Pay Online`
  - `Pay in Cash`
- Primary use:
  - manage profile info, attendance access, and membership-card purchase

### Member - Loaded Plan / Payment History
- Buttons inside:
  - none
- Primary use:
  - display membership plan and payment summary

### Member - Termination Action
- Buttons inside:
  - `Request Account Termination`
  - `Cancel Termination Request`
- Primary use:
  - manage deletion-request lifecycle

### Coach Summary
- Buttons inside:
  - none
- Primary use:
  - summarize hourly rate and active slots

### Coach Profile
- Buttons inside:
  - `Edit Coach Profile`
- Primary use:
  - open coach profile editing

### Coach Availability
- Buttons inside:
  - availability cards -> open slot editor
  - `Add Availability Slot`
  - weekday buttons
  - `Start Time`
  - `End Time`
  - `Cancel`
  - `Delete` for existing slots
  - `Save` or `Update`
- Primary use:
  - create, edit, or delete coach availability slots

### Termination Confirmations
- Buttons inside:
  - `Request Termination`
  - `Cancel`
  - `Cancel Request`
  - `Go Back`
- Primary use:
  - confirm deletion-request actions

### Attendance QR Modal
- Buttons inside:
  - `Copy QR Value`
  - refresh-status action
  - `Close`
- Primary use:
  - show the current attendance QR and allow safe refresh/copy behavior

### Availability Delete Confirmation
- Buttons inside:
  - `Delete`
  - `Keep Slot`
- Primary use:
  - confirm slot removal

### Edit Profile Modal
- Buttons inside:
  - `Personal`
  - `Fitness`
  - avatar image picker action
  - date-of-birth picker trigger
  - `Cancel`
  - `Save`
- Primary use:
  - update member or coach profile details

### Time Slot Modal
- Buttons inside:
  - time-slot buttons
  - `Cancel`
- Primary use:
  - set start/end times for coach availability

### Logic notes
- IF membership-card purchase returns a checkout URL -> mobile opens the external payment page
- IF termination is requested -> mobile account state becomes pending/frozen

---

## SETTINGS SCREEN

### Preferences Section
- Buttons inside:
  - `Notifications`
  - `Appearance`
- Primary use:
  - open the two main preference panels

### Security Section
- Buttons inside:
  - `Change Password`
  - `Privacy Settings`
- Primary use:
  - open security-related controls

### Support Section
- Buttons inside:
  - `Help Center`
  - `Terms & Conditions`
- Primary use:
  - open support and policy content

### Settings Modal
- Buttons inside:
  - close action
  - panel-owned controls in the selected panel
- Primary use:
  - host the selected settings panel

### Panel Mapping
- `Notifications` -> notification preference panel
- `Appearance` -> appearance panel
- `Change Password` -> password panel
- `Privacy Settings` -> privacy panel
- `Help Center` -> help panel
- `Terms & Conditions` -> terms panel

