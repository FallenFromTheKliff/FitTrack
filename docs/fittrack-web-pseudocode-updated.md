# FitTrack Web - Current Pseudocode

Updated against the current Next.js web app, shared client packages, and dev-stack scripts.

---

## Runtime And Data Source

```text
IF running local web stack:
  pnpm dev:stack:web starts API, web, and mobile Expo web
  pnpm dev:stack:web:ai also starts AI

API:
  reads DATABASE_URL from root .env
  connects to postgresql://postgres:postgres@localhost:5433/fittrackdb
  owns all database reads and writes

Web:
  runs Next.js on port 8080
  resolves NEXT_PUBLIC_API_URL or defaults to http://127.0.0.1:3001/v1
  stores auth tokens in localStorage through createTokenStore
  calls backend through @fittrack/api-client and @fittrack/query
```

The browser clients do not connect to PostgreSQL directly. They call the local API, and the API talks to Docker PostgreSQL.

---

## Root Composition

```text
RootLayout:
  load global CSS
  mount RootLayoutClient
  mount Providers

Providers:
  QueryClientProvider
  ThemeProvider
  AuthProvider
  shared app contexts used by admin pages

RootLayoutClient:
  detect auth, locked, and payment routes
  render public pages without admin chrome
  render protected pages through admin layout
```

---

## Web Auth And Role Gate

### Portal roles allowed to log into web

- `ADMIN`
- `STAFF`
- `USER`
- `COACH`

### Page fallback rules

```text
IF unauthenticated:
  redirect to /login

IF role is not one of ADMIN, STAFF, USER, COACH:
  redirect to /login

IF role cannot access current page:
  redirect to role fallback

fallback:
  ADMIN -> /analytics
  STAFF -> /members
  USER -> /member/home
  COACH -> /profile
```

### Page access map

```text
ADMIN:
  /analytics
  /members
  /schedule
  /exercise-lab
  /gamification
  /gym-actions
  /memberships-promos
  /facilities
  /inventory
  /ai
  /settings
  /profile

STAFF:
  /members
  /schedule
  /exercise-lab
  /gym-actions
  /memberships-promos
  /inventory
  /settings
  /profile

USER:
  /member/home
  /member/facilities
  /member/bookings
  /member/nutrition
  /member/mastery
  /member/ai
  /member/profile
  /member/settings

COACH:
  /profile
```

Current note: the `/member/*` web routes exist as gated route shells, but their page files currently return `null`. The implemented member experience is still the Expo mobile app and Expo web app.

---

## Web Shell

```text
DashboardLayout:
  derive pageKey from pathname
  check AuthContext and portal-access rules
  choose sidebar nav by role
  render header, notifications, page subtitle, content area, and sign-out controls

Sidebar:
  IF role is USER:
    show member nav sections
  ELSE:
    show management nav sections filtered by canAccessWebPage

Header:
  show page title and subtitle from @fittrack/app-config
  show notification bell
  open notifications panel
```

---

## Shared Web Data Layer

```text
webApiClient:
  baseURL = NEXT_PUBLIC_API_URL or local fallback
  tokenStore = localStorage
  onAuthFailure:
    clear tokens
    redirect to /login

TanStack Query:
  use package query option helpers where available
  invalidate exact query keys after mutations

Shared controllers:
  createAuthController handles login, OTP, token persistence, role rejection
  createMemberController supports account module flows
  createScheduleController supports scheduling flows
  createThemeController persists appearance settings
```

---

## Public And Auth Pages

### Landing

```text
/:
  render FitTrackLandingPage
```

### Login

```text
/login:
  render AdminLoginPage
  submit email/password to auth.login

IF login requires OTP:
  open OTP modal

IF account is locked:
  redirect to /locked

IF login succeeds:
  persist tokens
  load current user
  route by role fallback
```

### Locked

```text
/locked:
  render LockedStatusPage
  allow return to login
```

### Payment Returns

```text
/payments/success
/payments/cancel:
  render PaymentReturnPage
  explain redirect result
  keep backend payment state authoritative
```

### Dev Auth Bridge

```text
/dev/auth-bridge:
  write local auth tokens for development-only handoff
  redirect to requested next path
```

---

## Dashboard Redirect

```text
/dashboard:
  IF ADMIN:
    replace with /analytics
  ELSE:
    replace with /members
```

Layout protection still redirects roles that cannot access the resulting page.

---

## Analytics

```text
/analytics:
  useAnalyticsDashboard
  query business snapshot, member directory, deletion requests, revenue, attendance, drilldown, insight history, latest insight
  mutation: generate AI insight
  render AnalyticsDashboard sections:
    header actions
    KPI snapshot
    revenue and attendance charts
    coach performance
    alerts
    recent activity
```

Primary actions:

- Generate insights
- Export/report actions where exposed by the dashboard
- Filter or drill into analytics sections

---

## Accounts Archive

```text
/members:
  render MembersDashboard through MembersRouteShell
  query admin users and account deletion requests
  maintain selected account, list mode, filters, search, create mode, edit state
  expose directory panel, inspector panel, add-user panel, attendance scan modal
```

Core flows:

- Browse accounts by role, status, archive state, and termination requests.
- Create `member`, `staff`, `coach`, or `admin` accounts.
- Staff creators can create every role except `admin`.
- Detect duplicate email and phone before review/submit.
- Edit account profile fields.
- Grant, restore, revoke, or review membership-card state.
- Approve or reject membership payments.
- Process attendance by QR/manual token.
- Approve, reject, archive, restore, or cancel termination/account lifecycle flows.

---

## Gym Operations

```text
/schedule:
  render GymOperationsPage
  use URL params for tab and schedule-surface state
  query coach profiles, staff users, venues, appointments, bookings, recurring plan sessions
  run mutations for appointment response, completion, cancellation, balance payment, coach profile, booking creation, recurring plan preview/create/update/cancel
```

Main surfaces:

- Coach appointments
- Venue bookings
- Roster/timeline view
- Coach data management
- Recurring coaching plans
- Payment and balance workflows

Primary actions:

- Create coach booking
- Create venue booking
- Create or edit coach profile
- Save availability
- Respond to appointment
- Complete or cancel appointment
- Preview and confirm recurring plan
- Process cash or PayMongo balances

---

## Exercise Lab

```text
/exercise-lab:
  render ExerciseLabDashboard
  manage exercise catalog, review submissions, and exercise contract editors
```

Primary actions:

- Create exercise
- Edit exercise
- Archive exercise
- Review/publish submissions
- Maintain pose/repetition contract data

---

## Gamification

```text
/gamification:
  render GamificationAdminDashboard
  query overview, seasons, standings, integrity cases
  mutate season, integrity, ranking, and creator-governance states
```

Primary actions:

- Manage season lifecycle
- Resolve integrity cases
- Hide, disqualify, restore, or moderate rankings
- Apply creator governance decisions

---

## Gym Actions

```text
/gym-actions:
  render GymActionsDashboard
  provide operational action surfaces for staff/admin follow-up work
```

This route is part of the management sidebar for `ADMIN` and `STAFF`.

---

## Memberships

```text
/memberships-promos:
  render MembershipsPromosDashboard
  manage membership and promotion-facing admin surfaces
```

This route is available to `ADMIN` and `STAFF`.

---

## Facilities

```text
/facilities:
  useFacilitiesPageController
  render FacilitiesMapPageView
  query venues, archived venues, equipment, floor plan media, inventory equipment
  mutate venue, equipment, image, and floor-plan-media records
```

Main surfaces:

- Venue management table
- Floor toggle
- Floor plan editor
- Konva map canvas
- Equipment panel
- Quick region panel
- Archive modal

Primary actions:

- Add, edit, archive, or restore venue
- Upload venue or floor-plan image
- Assign, move, resize, or remove equipment
- Create quick regions
- Validate floor bounds and overlap before save

---

## Inventory

```text
/inventory:
  useInventoryDashboard
  query retail products, equipment, sales summary, sales analytics, detail records
  mutate product, sale, image upload, equipment, archive, write-off, and restock flows
```

Main surfaces:

- Inventory main panel
- KPI sidebar
- Retail product workflows
- Manual sale workflow
- Equipment workflows
- Sales analytics

Primary actions:

- Add product
- Record sale
- Restock item
- Upload product image
- Archive product
- Add or edit equipment
- Write off or archive equipment

---

## BrodigyAI Admin

```text
/ai:
  useAiPageController
  query sessions, selected session, messages
  mutate send, archive, and restore
  keep sessionId in URL
```

Flow:

```text
IF no session selected:
  route to first active session or sessionId=new

IF send creates a new session:
  replace URL with returned session id

IF backend returns gone/deleted session:
  reset to new session mode
```

---

## Profile

```text
/profile:
  useProfilePage
  render profile settings
  optionally render gym profile section when editable
  use GymProfileSection for gym-level details
```

Primary actions:

- Edit personal profile
- Upload avatar
- Update phone/profile fields
- Change password
- Manage gym details when role allows it

`COACH` currently lands here as their web fallback.

---

## Settings

```text
/settings:
  render GymSettingsPageContent
  mount appearance, notification, security, and gym details sections
```

Primary actions:

- Preview and save appearance settings
- Update notification preferences
- Open profile details
- Change password
- Request account termination when eligible
- Edit gym details where exposed

---

## Current Web Pseudocode Summary

```text
START WEB APP
  load providers
  resolve API base URL
  hydrate auth from localStorage

IF public route:
  render public page
ELSE:
  apply web portal role gate
  apply page role gate
  render shared dashboard layout
  render route module

FOR data:
  route component or hook calls @fittrack/query
  query helper calls @fittrack/api-client
  API validates auth and role
  API reads/writes local Docker PostgreSQL in local dev

FOR mutations:
  submit through api-client
  show local feedback
  invalidate related query keys
  keep URL state in sync for modules that own modes/tabs/details
```
