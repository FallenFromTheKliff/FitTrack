# FitTrack Mobile - Current Pseudocode

Updated against the current Expo Router app, mobile web launcher, auth gate, shared client packages, and local dev-stack scripts.

---

## Runtime And Data Source

```text
Native mobile dev:
  pnpm dev:mobile
  runs apps/mobile/scripts/start-dev.cjs
  starts Expo on port 8081
  exports EXPO_PUBLIC_API_URL=http://127.0.0.1:3001/v1 unless FITTRACK_LOCAL_API_URL overrides it
  primes adb reverse for 3001 and 8081 when a USB Android device is available

Mobile web dev:
  pnpm dev:mobile:web
  runs apps/mobile/scripts/start-web.cjs
  starts Expo web on port 8081
  exports EXPO_PUBLIC_API_URL=http://127.0.0.1:3001/v1 unless FITTRACK_LOCAL_API_URL overrides it

Full local stack:
  pnpm dev:stack:web starts API, web, and mobile Expo web
  pnpm dev:stack:web:ai also starts AI
  pnpm dev:stack and pnpm dev:stack:ai start native mobile after API/web bootstrap

Data source:
  mobile calls the local API
  local API uses root DATABASE_URL
  root DATABASE_URL points at Docker PostgreSQL on localhost:5433/fittrackdb
```

The mobile client does not connect to PostgreSQL directly. It calls the API through `mobileApiClient`.

---

## API Base URL Resolution

```text
DEFAULT_MOBILE_API_BASE_URL = http://127.0.0.1:3001/v1

resolveMobileApiBaseUrl:
  read EXPO_PUBLIC_API_URL
  normalize through resolveApiBaseUrl

IF native:
  inspect Metro bundle hostname from NativeModules.SourceCode.scriptURL
  IF configured API host is local/private:
    replace API hostname with Metro host
    keep port 3001 and path /v1
  ELSE:
    keep configured API URL

IF web:
  inspect window.location.hostname
  IF page host and configured API host are local/private:
    replace API hostname with page host
    keep port 3001 and path /v1
  ELSE:
    keep configured API URL
```

The dev launcher now sets `EXPO_PUBLIC_API_URL` before Expo loads `.env.local`, so a local ignored env file cannot silently send development traffic to the live API.

---

## Root Composition

```text
RootLayout:
  load fonts
  show SplashScreen while fonts and auth hydrate
  mount QueryClientProvider
  mount ThemeProvider
  mount AuthProvider
  mount app routes

AuthProvider:
  uses createAuthController
  uses mobileSessionStore backed by AsyncStorage
  roleGate.allowedRoles = ["USER", "COACH"]
  hydrates deletion-request status for members
  clears tokens on auth failure
```

---

## Mobile Role Gate

### Current allowed mobile roles

- `USER`
- `COACH`

### Current blocked roles

- `ADMIN`
- `STAFF`

Current note: coach-specific mobile views render inside the protected tabs through the same mobile shell as members. ADMIN and STAFF are rejected before protected tabs render.

```text
IF auth is loading:
  render nothing or splash/loading state

IF unauthenticated:
  redirect to /(auth)/login

IF user.role is not USER:
  clear/reject session through role gate
  redirect to /(auth)/login
```

---

## Mobile Shell

```text
TabsLayout:
  require authenticated USER
  define hidden Expo tabs:
    index
    home
    facilities
    bookings
    nutrition
    mastery
    workout
    chathistory
    chatbot
    profile
    settings
  render Header
  render Sidebar modal
  render FitFAB and FitFABMenu from FABStateContext
  render shared ReservationModal when requested
  render logout confirmation modal

Header:
  show menu button
  show active tab title/subtitle from @fittrack/app-config
  show back button only on chatbot screen

Sidebar:
  show profile card
  show member navigation:
    Home
    Bookings
    Facilities
    Nutrition
    Muscle Mastery
    Workout
    BrodigyAI
    Settings
  expose Sign Out
```

---

## Shared Mobile Data Layer

```text
mobileApiClient:
  baseURL = MOBILE_API_BASE_URL
  tokenStore = AsyncStorage plus in-memory cache
  onAuthFailure:
    clear tokens
    notify AuthContext

TanStack Query:
  configured through apps/mobile/lib/queryClient.tsx
  uses @fittrack/query option helpers where available
  invalidates shared query keys after mutations

Shared controllers:
  createAuthController handles login, registration, OTP, token persistence, and role rejection
  shared API domains provide auth, users, bookings, venues, nutrition, membership, fitness, AI, files, and notifications
```

---

## Auth Screens

### Login

```text
/(auth)/login:
  collect email and password
  call AuthContext.login

IF login returns ACCOUNT_LOCKED:
  show locked-account status

IF login requires OTP:
  show OTP status/modal path

IF login succeeds:
  show BufferScreen
  commit login
  router.replace("/(tabs)/home")

Create Account:
  router.push("/(auth)/register")
```

### Register

```text
/(auth)/register:
  collect first name, last name, email, phone, password
  normalize supported Philippine phone numbers
  validate password requirements
  call AuthContext.register

IF registration succeeds:
  open OTP modal

IF OTP succeeds:
  route back to login or commit the verified flow depending on modal path
```

---

## Home

```text
/(tabs)/home:
  query venues
  query bookings
  query active nutrition target
  query nutrition summary
  query mastery snapshot
  query leaderboard/session data
  compute schedule, live snapshot, and next actions
```

Primary surfaces:

- Greeting header with date/time.
- Stat cards based on membership and activity.
- Today schedule and booking detail modal.
- Nutrition, mastery, streak, and access snapshot.
- Dynamic quick actions into bookings, nutrition, workout, facilities, coach schedule, or profile.

---

## Bookings

```text
/(tabs)/bookings:
  maintain search, section, status, and date filters
  debounce search input
  query reservations
  query appointments
  query coach schedule data where needed
  group records by date
```

Primary flows:

- Filter reservations, appointments, and eligible coach schedule.
- Open booking detail modal.
- Create reservation through ReservationModal.
- Book a trainer through AppointmentModal.
- Cancel reservation.
- Cancel appointment.
- Confirm, decline, or mark appointment complete where action is exposed.
- Open PayMongo checkout when backend returns a checkout URL.

---

## Facilities

```text
/(tabs)/facilities:
  query venues through venuesQueryOptions
  group mapped venues by floor
  allow refresh through queryClient/refetch
  open venue detail modal from map tile
```

Primary flows:

- Switch floors.
- Inspect floor snapshot and map tiles.
- Open venue details.
- Start reservation if venue is reservable.
- Jump to BrodigyAI with facilities context.

---

## Nutrition

```text
/(tabs)/nutrition:
  query active nutrition target
  query daily summary
  query nutrition logs
  query nutrition history
  compute premium access and frozen-account gates
```

Primary flows:

- View calories, macros, coaching signals, recommendations, catalog, logs, and backend nutrition snapshot.
- Create or recalculate target through GoalsModal.
- Log meal through NutritionLogModal when access allows it.
- Launch BrodigyAI with nutrition context.
- Route to profile when membership access is locked.

---

## Muscle Mastery

```text
/(tabs)/mastery:
  render MuscleMasteryScreenContent
  require membership-card access for full content
  show loading, error, empty, and gated states
```

Primary flows:

- View season, streak, EXP, standing, milestone, unlock, muscle group, leaderboard, and achievement summaries.
- Change leaderboard visibility.
- Jump to Workout, Nutrition, BrodigyAI, or Profile depending on access state.

---

## Workout

```text
/(tabs)/workout:
  require USER role
  require active membership-card access
  render WorkoutLiveScreen when allowed
```

Primary flows:

- Initialize camera.
- Toggle camera facing.
- Start, pause, resume, and stop recording.
- Use auto detection or manual exercise selection.
- Toggle subject lock.
- Confirm exercise label.
- Finalize pose data, log set, complete session, and reset runtime.

Native-specific pieces:

- NativeVisionPoseCamera
- browser/native pose analyzer helpers
- poseRepEngine
- workout modals for exercise selection, confirmation, and review

---

## BrodigyAI History

```text
/(tabs)/chathistory:
  query AI chat sessions
  maintain search, status, date filters, and delete-selection mode
  archive and restore sessions through mutations
```

Primary flows:

- Search and filter sessions.
- Open active conversation.
- Restore deleted conversation.
- Start new chat.
- Select and archive conversations.

Access gate:

```text
IF membership-card access is locked:
  show membership gate
  route action to profile
```

---

## BrodigyAI Chat

```text
/(tabs)/chatbot:
  read sessionId and from params
  render ChatbotScreenContent
  send messages through AI domain

IF sessionId is "new":
  draft conversation mode

IF backend returns a real session id:
  replace route with returned session id

IF from=nutrition:
  use nutrition context
```

Sending is blocked when account state or membership access disallows it.

---

## Profile

```text
/(tabs)/profile:
  render ProfileHeader
  render MemberProfileSections for current USER
  render ProfileModals
```

Primary member flows:

- View avatar, identity, member-since data, plan, payment history, and fitness summary.
- Edit profile through EditProfileModal.
- Upload avatar.
- Update phone/profile fields.
- Show attendance QR.
- Copy QR value.
- Pay online or pay cash for membership card.
- Request or cancel account termination.
- Open Muscle Mastery or Workout from fitness summary.

Current note: `CoachProfileSections` and `CoachAvailabilitySection` exist, but the mobile gate blocks coach sessions before this route is reachable.

---

## Settings

```text
/(tabs)/settings:
  render SettingsSections
  open SettingsModalContent for selected panel
```

Panels:

- Notifications
- Appearance
- Change Password
- Privacy Settings
- Help Center
- Terms & Conditions

Primary flows:

- Update notification preferences.
- Change appearance settings.
- Change password.
- Review privacy/support/legal content.

---

## Global Modals And Cross-Screen State

```text
FABStateContext:
  owns current FAB menu
  owns sidebar open state
  owns shared reservation modal open state
  broadcasts booking refresh after reservation success
  tracks camera-active state to suppress sidebar/FAB conflicts

Shared modals:
  ConfirmModal
  CalendarModal
  TimeSlotModal
  NoticeModal
  ReservationModal
  AppointmentModal
  BookingDetailModal
  GoalsModal
  NutritionLogModal
  OTPModal
  ForgotPasswordModal
  AttendanceQrModal
  EditProfileModal
  Workout exercise modals
```

---

## Current Mobile Pseudocode Summary

```text
START MOBILE APP
  launcher exports local EXPO_PUBLIC_API_URL
  RootLayout loads fonts, query, theme, auth
  AuthProvider hydrates tokens from AsyncStorage
  AuthProvider loads current user from local API

IF public auth route:
  render login/register
ELSE:
  require authenticated USER
  render mobile shell
  render selected tab screen

FOR data:
  screen calls TanStack Query or mutation
  query helper calls mobileApiClient
  mobileApiClient calls local API
  local API reads/writes Docker PostgreSQL

FOR access:
  role gate blocks non-USER roles
  membership card gate blocks premium member features
  frozen/pending termination states reduce sensitive actions
```
