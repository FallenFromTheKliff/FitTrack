# FitTrack Web - UI / Section / Buttons / Primary Use

This version is aligned to the current web codebase. It is written for UI walkthrough and feature understanding first.

---

## ROLE ACCESS MATRIX

### Allowed web roles
- `ADMIN`
- `STAFF`

### Admin can access
- Dashboard redirect
- Analytics
- Account Module
- Gym Operations
- Exercise Lab
- Gamification
- Brodigy AI
- Facilities
- Inventory
- Profile
- Settings

### Staff can access
- Dashboard redirect
- Account Module
- Gym Operations
- Exercise Lab
- Brodigy AI
- Inventory
- Profile
- Settings

### Staff cannot access
- Analytics
- Facilities
- Gamification

### Core access rules
- IF auth is loading -> render nothing
- IF unauthenticated -> redirect to login
- IF role is not `ADMIN` or `STAFF` -> redirect to login
- IF role cannot access the page -> redirect to dashboard

---

## GLOBAL WEB SHELL

### Sidebar
- Buttons inside:
  - module navigation items
  - collapse toggle
- Primary use:
  - move between web modules

### Header Bell / Notifications Entry
- Buttons inside:
  - notification bell
- Primary use:
  - open inbox notifications and expose unread count

### Notifications Panel
- Buttons inside:
  - `MARK ALL`
  - `DELETE ALL`
  - per-item `MARK READ`
  - per-item `DELETE`
  - close button
- Primary use:
  - let the operator review and manage notifications quickly

### Notification logic notes
- IF there are no notifications -> show empty state
- `MARK ALL` is disabled when unread count is zero or the panel is busy
- `DELETE ALL` confirms first, then clears all notifications

---

## LOGIN PAGE

### Login Form
- Buttons inside:
  - `SIGN IN`
  - `Forgot Password?`
- Primary use:
  - authenticate admin and staff users

### Forgot Password Modal
- Buttons inside:
  - `CANCEL` on email step
  - `BACK` on later steps
  - `SEND CODE`
  - `VERIFY CODE`
  - `Resend Code`
  - `RESET PASSWORD`
- Primary use:
  - recover account access from the login flow

### OTP Modal
- Buttons inside:
  - `VERIFY CODE`
  - `Resend Code`
  - close button
- Primary use:
  - complete OTP-gated authentication or reset verification

### Logic notes
- IF login returns `ACCOUNT_LOCKED` -> redirect to locked page
- IF login requires OTP -> open OTP modal
- IF login succeeds -> show buffer -> commit login -> enter portal

---

## LOCKED PAGE

### Lockout State Card
- Buttons inside:
  - `Back to Login`
- Primary use:
  - explain account lockout and route the user back to login

---

## PAYMENT RETURN PAGES

### Success Return
- Buttons inside:
  - `Open Web Portal Login`
- Primary use:
  - explain the result of a success-looking payment redirect

### Cancel Return
- Buttons inside:
  - `Open Web Portal Login`
- Primary use:
  - explain the result of a cancelled payment redirect

### Logic notes
- browser return is not the final payment truth
- backend-confirmed payment state remains authoritative

---

## ANALYTICS PAGE

### Top Action Section
- Buttons inside:
  - `GENERATE INSIGHTS`
  - `EXPORT PDF`
- Primary use:
  - generate AI analytics copy and export the analytics report

### Daily Insights
- Buttons inside:
  - section-owned insight actions
- Primary use:
  - show narrative daily intelligence

### Performance KPIs
- Buttons inside:
  - none directly
- Primary use:
  - show headline metrics

### Revenue
- Buttons inside:
  - period/view filters where present
- Primary use:
  - show revenue trend and totals

### Attendance
- Buttons inside:
  - attendance filter controls
  - chart point interactions
- Primary use:
  - show attendance trend and drilldown detail

### System Alerts
- Buttons inside:
  - alert action buttons
- Primary use:
  - route the operator into inventory or facilities follow-up actions

### Recent Activity
- Buttons inside:
  - activity filter controls
- Primary use:
  - show recent backend activity across the business

### Logic notes
- active member counts exclude archived and pending-termination members
- export uses the backend PDF route, not a fake frontend-only print flow

---

## ACCOUNT MODULE

### Top Controls
- Buttons inside:
  - mode switch into create flow
  - search
  - role filters
  - status tabs including `Termination Requests`
- Primary use:
  - control which accounts are visible and whether the operator is creating or browsing

### Directory List
- Buttons inside:
  - account cards or rows -> open details
- Primary use:
  - browse active, archived, or pending-termination accounts

### Account Details
- Buttons inside:
  - `Edit details`
  - `Check in`
  - `Message`
  - `Grant Member Card` or `Restore Member Card`
  - `Revoke card`
  - `Deny request`
  - `Approve request`
  - `Archive Account`
  - `Restore Account`
  - payment-review actions:
    - `Approve`
    - `Reject`
- Primary use:
  - manage the selected account lifecycle and access state

### Attendance Scan Modal
- Buttons inside:
  - scan flow actions
  - manual token fallback actions
  - `SUBMIT QR`
  - close action
- Primary use:
  - process attendance through QR or manual token entry

### Create Account Flow
- Buttons inside:
  - role selection buttons
  - `Generate password`
  - `Cancel`
  - `Create account`
  - `Back to accounts`
  - `Back to editing`
  - `Back to edit`
- Primary use:
  - create member, staff, or admin accounts

### Account Confirm / Review Modals
- Buttons inside:
  - confirm account update action
  - cancel account update action
  - member-card confirm action
  - revoke-card confirm action
  - approve-termination confirm action
  - archive-account confirm action
  - restore-account confirm action
- Primary use:
  - confirm sensitive account and payment-review actions

### Staff-specific behavior
- staff can see member accounts only
- staff can create staff and member accounts only

### Logic notes
- `Termination Requests` isolates pending requests
- create flow checks duplicate email and phone before final creation

---

## GYM OPERATIONS PAGE

### Top Tab / View Controls
- Buttons inside:
  - main tab controls
  - schedule-view controls
- Primary use:
  - switch between schedule surfaces and coach-management surfaces

### Coach Schedule
- Buttons inside:
  - appointment cards -> open review
  - search/filter controls
- Primary use:
  - review and manage coach appointments

### Venue Bookings
- Buttons inside:
  - booking cards -> open booking detail
  - venue/status filter controls
- Primary use:
  - manage venue-booking requests

### Appointment Action Modal
- Buttons inside:
  - `BACK`
  - `REJECT APPOINTMENT`
  - `CANCEL APPOINTMENT`
  - `MARK COMPLETE`
  - close button
- Primary use:
  - confirm appointment actions and capture reason text where needed

### Venue Booking Review Modal
- Buttons inside:
  - `Approve`
  - `Reject`
  - `Request New Slot`
- Primary use:
  - process venue booking requests

### Manage Coaches
- Buttons inside:
  - `Edit Profile`
  - `Save Availability`
  - `Hide from Booking`
  - `Open in Schedule`
- Primary use:
  - manage coach profile and bookability settings

### Coach Availability Modal
- Buttons inside:
  - modal-owned save/cancel actions
  - slot editing controls
  - close button
- Primary use:
  - edit coach availability

### Recurring Coaching Plans
- Buttons inside:
  - preview action
  - confirm action
  - single-session edit actions
  - future-series update actions
  - cancel-plan action
- Primary use:
  - create and manage recurring coaching plans and child sessions

### Calendar Modal
- Buttons inside:
  - view toggles
  - day buttons
  - month buttons
  - year buttons
  - `Clear`
  - `Today`
  - close button
- Primary use:
  - supply date selection inside scheduling and profile flows

### Logic notes
- schedule tab/view state is mirrored with URL params
- recurring plan confirm is blocked when preview state is missing or unresolved conflicts remain

---

## EXERCISE LAB PAGE

### Mode / Filter Controls
- Buttons inside:
  - mode-switch controls
  - search
  - refresh
- Primary use:
  - switch between library, review, and milestone work

### Library Section
- Buttons inside:
  - `Create Exercise`
  - `Edit Exercise`
  - `Archive`
- Primary use:
  - manage the canonical exercise library

### Review Section
- Buttons inside:
  - publish/review actions
- Primary use:
  - moderate exercise submissions

### Milestones Section
- Buttons inside:
  - milestone moderation actions where present
- Primary use:
  - review milestone-related content flows

### Sheets / Drawers
- Buttons inside:
  - save
  - cancel
  - publish
- Primary use:
  - complete exercise creation and moderation actions

---

## GAMIFICATION PAGE

### Active Season Governance
- Buttons inside:
  - season status actions
- Primary use:
  - manage season lifecycle state

### Integrity Cases
- Buttons inside:
  - valid/invalid/resolve actions
- Primary use:
  - review progression integrity issues

### Ranking Governance
- Buttons inside:
  - hide
  - disqualify
  - restore
- Primary use:
  - control ranking visibility and enforcement

### Creator Governance
- Buttons inside:
  - creator state actions with rationale
- Primary use:
  - manage creator governance state

---

## BRODIGY AI PAGE

### History Panel
- Buttons inside:
  - status filters:
    - `Active Chats`
    - `All Chats`
    - `Deleted Chats`
  - session selection actions
  - delete action
  - `Restore Chat`
- Primary use:
  - browse and manage AI sessions

### Chat Panel
- Buttons inside:
  - `Send`
- Primary use:
  - converse within the selected or new chat session

### Logic notes
- IF no session is selected -> redirect to first active or `new`
- IF send returns a different session id -> replace URL to that session
- IF send fails with `410` -> reset to new session mode
- auto-start prompt flow exists when query params request it

---

## FACILITIES PAGE

### Top Tabs
- Buttons inside:
  - `floor`
  - `venues`
- Primary use:
  - switch between floor-layout editing and venue management

### Venue Management
- Buttons inside:
  - `Add Venue`
  - `Edit Venue`
  - `Archive Venue`
  - `Restore Venue`
  - venue image upload/edit actions
- Primary use:
  - manage venue records and venue media

### Floor Plan Management
- Buttons inside:
  - floor switch controls
  - edit mode toggle
  - assign equipment action
  - remove equipment action
  - clear floor action
  - floor-plan image upload action
  - quick region creation actions
  - canvas move/nudge/resize interactions
- Primary use:
  - maintain the persisted facility layout and floor image contract

### Venue / Region / Archive Modal Layer
- Buttons inside:
  - `SAVE VENUE`
  - `DELETE VENUE`
  - `MOVE LEFT`
  - `MOVE RIGHT`
  - `MOVE UP`
  - `MOVE DOWN`
  - `WIDER`
  - `NARROWER`
  - `TALLER`
  - `SHORTER`
  - `REPOSITION`
  - archive restore actions
  - close buttons
- Primary use:
  - edit venue position, geometry, archive state, and media inside facilities flows

### Logic notes
- venue save validates bounds, capacity, floor, and overlap before create/update
- archive flow can warn when active reservations exist

---

## INVENTORY PAGE

### Top Toolbar
- Buttons inside:
  - search
  - `Refresh`
  - filter toggle
  - `Add Product`
  - `Record Sale`
  - `Add Equipment`
- Primary use:
  - launch the main retail and equipment workflows

### Retail Section
- Buttons inside:
  - product detail open
  - restock open
  - edit/archive actions inside retail flows
- Primary use:
  - manage retail items and stock levels

### Record Sale Modal
- Buttons inside:
  - `ADD ANOTHER ITEM`
  - remove line item action
  - `CONFIRM SALE`
  - close/cancel action
- Primary use:
  - create manual sales with live product pricing

### Retail Detail / Restock Modal Layer
- Buttons inside:
  - `UPLOAD PRODUCT IMAGE`
  - `UPLOAD NEW IMAGE`
  - `RECORD SALE`
  - `RESTOCK ITEM`
  - restock submit action
  - retail archive confirm action
  - close/cancel actions
- Primary use:
  - complete retail details, image, restock, and archive flows

### Equipment Section
- Buttons inside:
  - add equipment
  - edit equipment
  - write-off action
  - archive equipment
  - equipment detail open
- Primary use:
  - manage non-retail equipment inventory

### Equipment Detail / Archive Modal Layer
- Buttons inside:
  - equipment archive confirm action
  - image upload/edit actions
  - close/cancel actions
- Primary use:
  - manage equipment detail and archive flows

### Inventory Analytics
- Buttons inside:
  - metric filters
  - period filters
- Primary use:
  - summarize sales performance and top items

### Logic notes
- URL params can auto-open tabs, modals, and detail targets
- manual sales use shared sales tables and decrement stock

---

## PROFILE PAGE

### Personal Profile Section
- Buttons inside:
  - `Edit Profile`
  - `Save Changes`
  - `Cancel`
  - date-of-birth picker
  - avatar/image change action
- Primary use:
  - manage the current portal user's personal profile

### Security / Account Actions
- Buttons inside:
  - `Change Password`
  - `Request Account Termination`
- Primary use:
  - expose sensitive account actions

### Change Password Modal
- Buttons inside:
  - current-password visibility toggle
  - new-password visibility toggle
  - confirm-password visibility toggle
  - `SAVE CHANGES`
  - close button
  - post-success confirm modal `SIGN OUT`
- Primary use:
  - change the current user's password, then force secure re-login

### Gym Profile Section (Admin)
- Buttons inside:
  - `Edit Gym Details`
  - `Cancel`
  - `SAVE GYM DETAILS`
- Primary use:
  - manage gym name, contact data, location, and opening/closing hours

### Logic notes
- profile save may upload avatar first, then update profile data, then update phone if changed

---

## SETTINGS PAGE

### Appearance Section
- Buttons inside:
  - theme buttons
  - font buttons
  - animation toggle
  - `CANCEL`
  - `SAVE`
- Primary use:
  - preview and persist appearance settings

### Notification Preferences
- Buttons inside:
  - toggles for:
    - membership alerts
    - booking updates
    - coaching sessions
    - payment notices
    - progress highlights
    - system messages
- Primary use:
  - update backend notification preference groups

### Security & Account
- Buttons inside:
  - `Change Password`
  - `Open Profile Details`
  - `Request Account Termination` for non-admins
- Primary use:
  - route the operator into password, profile, and account-exit actions

### Termination Confirmation Modal
- Buttons inside:
  - confirm action
  - cancel action
- Primary use:
  - confirm self-termination for eligible non-admin users

### Logic notes
- appearance changes preview immediately before save
- admin cannot self-terminate from this settings section

