# FitTrack Activity Diagram Prompts

This file contains compiled prompts for generating UML Activity Diagrams based on the latest FitTrack system architecture.

Use these prompts one at a time in an AI diagram generator. Each prompt is separated by diagram so the output stays readable and does not become one large diagram.

## General Instruction For All Diagrams

```text
Create a UML Activity Diagram using swimlanes. Use swimlanes based on responsibility, not only screen names.

Use these rules:
- User action goes in the actor/user swimlane.
- Interface display and request sending go in the Web Application or Mobile Application swimlane.
- Validation, permission checking, role checking, calculations, and business logic go in the Backend/System swimlane.
- Saving, retrieving, and updating persistent records go in the Database swimlane.
- Use External Service swimlanes only when needed, such as Brodigy AI Service, AI/Pose Detection Service, or Notification Service.
- Keep the diagram readable.
- Do not include every button click.
- Show important decisions, permission checks, data retrieval, data updates, confirmations, and end states.
```

## Prompt 01: Overall FitTrack System Activity Diagram

```text
Create a UML Activity Diagram titled "FitTrack Overall System Activity Diagram".

The FitTrack system has both Web Application and Mobile Application platforms.
The actors are Coach, Staff, Admin, Member, and Non-member.

Use these swimlanes:
1. User
2. Web/Mobile Application
3. Backend/System
4. Database

Flow:
Start when a user opens FitTrack.
The user accesses either the Web Application or the Mobile Application.
The application displays login/register.
The user submits credentials or registration details.
The application sends the request to the backend.
The backend validates the account using the database.

Decision: account valid?
If no, the application displays an error message and returns to login/register.
If yes, the backend identifies the user's role and platform access.

Decision: role and platform.
- Coach goes to Coach Web Dashboard.
- Staff goes to Staff Web Dashboard.
- Admin goes to Admin Web Dashboard.
- Member using web goes to Member Web Dashboard.
- Member using mobile goes to Member Mobile Dashboard.
- Non-member using web goes to Non-member Web Dashboard.
- Non-member using mobile goes to Non-member Mobile Dashboard.

The application displays only the modules allowed for that user.
The user selects a module.
The backend checks module permission.

Decision: permission allowed?
If no, the application displays access denied and returns to the dashboard.
If yes, the backend retrieves or updates data in the database.
The application displays the result.

Decision: continue using system?
If yes, return to module selection.
If no, the user logs out and the activity ends.

Do not list every submodule in this overview diagram. Use grouped dashboard labels only.
```

## Prompt 02: Coach Web Application Activity Diagram

```text
Create a UML Activity Diagram titled "Coach Web Application Activity Diagram".

Actor: Coach.
Platform: Web Application.

Use these swimlanes:
1. Coach
2. Web Application
3. Backend/System
4. Database
5. Brodigy AI Service

Coach modules:
- Account: Authentication, Coach Profile
- Client Management: Dashboard, Clients Overview, Sessions Tracking and Scheduling
- Performance: Coach Earnings
- Intelligence: Brodigy AI

Flow:
Start when the coach opens the web application.
The web application displays login.
The coach submits credentials.
The backend validates the coach account using the database.

Decision: account valid?
If no, display login error and return to login.
If yes, display Coach Web Dashboard.

The coach selects a module.

Decision: selected module.

1. Account:
The coach views or updates coach profile.
The backend saves or retrieves profile data from the database.
The web application displays the updated profile.

2. Client Management:
The coach opens dashboard or clients overview.
The backend retrieves assigned client records.
The web application displays client records.
The coach views client details or manages session tracking and scheduling.
The backend saves schedule or session updates in the database.
The web application displays confirmation.

3. Performance:
The coach opens coach earnings.
The backend retrieves earnings data from the database.
The web application displays earnings summary.

4. Brodigy AI:
The coach opens Brodigy AI.
The coach submits a question or request.
The backend retrieves relevant context if needed.
The backend sends the request to Brodigy AI Service.
Brodigy AI Service returns a response.
The web application displays the AI response.

Decision: continue using Coach Web Dashboard?
If yes, return to module selection.
If no, the coach logs out and the activity ends.
```

## Prompt 03: Staff Web Application Activity Diagram

```text
Create a UML Activity Diagram titled "Staff Web Application Activity Diagram".

Actor: Staff.
Platform: Web Application.

Use these swimlanes:
1. Staff
2. Web Application
3. Backend/System
4. Database
5. Brodigy AI Service

Staff modules:
- Access and Records: Authentication and Access Control, User Management
- Gym Operations: Amenity Booking Management, Trainer Appointment Management, Manual Payment and Receipt Verification
- Inventory: Retail and Equipment Inventory
- System Logs: Gym Action Log
- Exercise Lab: Exercise Creation and Management
- Membership: Membership Creation and Management
- Intelligence: Brodigy AI

Flow:
Start when staff opens the web application.
The web application displays login.
Staff submits credentials.
The backend validates staff account and access level using the database.

Decision: account valid?
If no, display login error and return to login.
If yes, display Staff Web Dashboard.

Staff selects a module.

Decision: selected module.

1. Access and Records:
Staff manages user records or access control.
The backend checks staff permission.
The backend retrieves or updates user data in the database.
The web application displays confirmation.

2. Gym Operations:
Staff manages amenity bookings, trainer appointments, or manual payment and receipt verification.
The backend retrieves related records from the database.
Staff approves, updates, cancels, or verifies the transaction.
The backend saves changes in the database.
The web application displays operation result.

3. Inventory:
Staff manages retail and equipment inventory.
The backend retrieves inventory records from the database.
Staff adds, edits, or updates stock or equipment status.
The backend saves inventory updates in the database.
The web application displays updated inventory.

4. System Logs:
Staff opens Gym Action Log.
The backend retrieves log records from the database.
The web application displays logs.

5. Exercise Lab:
Staff creates or manages exercises.
The backend validates exercise details.
The database saves exercise records.
The web application displays saved exercise details.

6. Membership:
Staff creates or manages membership plans.
The backend validates membership details.
The database saves membership changes.
The web application displays confirmation.

7. Brodigy AI:
Staff opens Brodigy AI.
Staff submits a question or request.
The backend sends the request to Brodigy AI Service.
Brodigy AI Service returns a response.
The web application displays the AI response.

Decision: continue using Staff Web Dashboard?
If yes, return to module selection.
If no, staff logs out and the activity ends.
```

## Prompt 04: Admin Web Application Activity Diagram

```text
Create a UML Activity Diagram titled "Admin Web Application Activity Diagram".

Actor: Admin.
Platform: Web Application.

Use these swimlanes:
1. Admin
2. Web Application
3. Backend/System
4. Database
5. Brodigy AI Service

Admin modules:
- Access and Records: Authentication and Access Control, User Management
- Monitoring: Business Analytics and Reporting
- Gym Operations: Amenity Booking Management, Trainer Appointment Management, Manual Payment and Receipt Verification
- Facility: Gym Layout Editor
- Inventory: Retail and Equipment Inventory
- System Logs: Gym Action Log
- Gamification: Gamification Management
- Exercise Lab: Exercise Creation and Management
- Membership: Membership Creation and Management
- Intelligence: Brodigy AI

Flow:
Start when admin opens the web application.
The web application displays login.
Admin submits credentials.
The backend validates admin account and administrator privileges using the database.

Decision: account valid?
If no, display login error and return to login.
If yes, display Admin Web Dashboard.

Admin selects a module.

Decision: selected module.

1. Access and Records:
Admin manages authentication access control or user management.
The backend retrieves user and access records from the database.
Admin creates, edits, disables, or updates access.
The backend saves changes in the database.
The web application displays confirmation.

2. Monitoring:
Admin opens Business Analytics and Reporting.
The backend retrieves business data from the database.
The backend generates analytics or report summaries.
The web application displays reports.

3. Gym Operations:
Admin manages amenity bookings, trainer appointments, or manual payment and receipt verification.
The backend retrieves related records from the database.
Admin approves, updates, cancels, or verifies selected records.
The database saves changes.
The web application confirms the action.

4. Facility:
Admin opens Gym Layout Editor.
The backend retrieves the current gym layout from the database.
Admin edits the gym layout.
The backend validates layout changes.
The database saves the updated layout.
The web application displays the updated layout.

5. Inventory:
Admin manages retail and equipment inventory.
The backend retrieves inventory records.
Admin creates, edits, or updates stock or equipment status.
The database saves inventory updates.
The web application displays updated inventory.

6. System Logs:
Admin opens Gym Action Log.
The backend retrieves logs from the database.
The web application displays logs.

7. Gamification:
Admin manages gamification settings.
The backend validates rules or rewards.
The database saves gamification changes.
The web application displays confirmation.

8. Exercise Lab:
Admin creates or manages exercises.
The backend validates exercise data.
The database saves the exercise record.
The web application displays confirmation.

9. Membership:
Admin creates or manages membership plans.
The backend validates membership details.
The database saves membership updates.
The web application displays confirmation.

10. Brodigy AI:
Admin opens Brodigy AI.
Admin submits a request.
The backend sends the request to Brodigy AI Service.
Brodigy AI Service returns a response.
The web application displays the AI response.

Decision: continue using Admin Web Dashboard?
If yes, return to module selection.
If no, admin logs out and the activity ends.
```

## Prompt 05: Member And Non-member Web Application Activity Diagram

```text
Create a UML Activity Diagram titled "Member and Non-member Web Application Activity Diagram".

Actors: Member and Non-member.
Platform: Web Application.

Use these swimlanes:
1. Member/Non-member
2. Web Application
3. Backend/System
4. Database

Web modules:
- Account: Authentication, User Profile and Physical Metrics
- Booking and Coaching: Amenity Booking Viewing, Trainer Appointment Viewing
- Gym Navigation: Gym Layout Viewer
- Communication: Notification

Flow:
Start when member or non-member opens the web application.
The web application displays login/register.
The user submits credentials or registration details.
The backend validates the account using the database.

Decision: account valid?
If no, display error and return to login/register.
If yes, the backend identifies whether the user is a member or non-member.

The web application displays the allowed web dashboard.
The user selects a module.

Decision: selected module.

1. Account:
The user views or updates user profile and physical metrics.
The backend validates details.
The database saves or retrieves profile data.
The web application displays the updated profile.

2. Booking and Coaching:
The user views amenity booking information or trainer appointment information.
The backend retrieves booking or appointment records from the database.
The web application displays available or existing records.

3. Gym Navigation:
The user opens Gym Layout Viewer.
The backend retrieves gym layout from the database.
The web application displays the gym layout.

4. Communication:
The user opens Notification.
The backend retrieves notifications from the database.
The web application displays the notification list.

Decision: continue using web dashboard?
If yes, return to module selection.
If no, user logs out and the activity ends.
```

## Prompt 06: Member Mobile Application Activity Diagram

```text
Create a UML Activity Diagram titled "Member Mobile Application Activity Diagram".

Actor: Member.
Platform: Mobile Application.

Use these swimlanes:
1. Member
2. Mobile Application
3. Backend/System
4. Database
5. AI/Pose Detection Service
6. Brodigy AI Service

Member mobile modules:
- Account: Authentication, User Profile and Physical Metrics
- Booking and Coaching: Amenity Booking, Trainer Appointment
- Gym Progress: Coach Assessment
- Gym Navigation: Gym Layout Viewer
- Fitness Monitoring: Macronutrient Calculation, Muscle Mastery, Pose Estimation and Repetition Counting
- Intelligence: Brodigy AI
- Communication: Notification

Flow:
Start when member opens the mobile application.
The mobile application displays login/register.
Member submits credentials or registration details.
The backend validates the account using the database.

Decision: account valid?
If no, display login error and return to login/register.
If yes, display Member Mobile Dashboard.

Member selects a module.

Decision: selected module.

1. Account:
Member views or updates profile and physical metrics.
The backend validates details.
The database saves or retrieves profile data.
The mobile application displays the updated profile.

2. Booking and Coaching:
Member creates or views amenity booking or trainer appointment.
The backend checks availability using the database.

Decision: schedule available?
If no, the mobile application displays unavailable message.
If yes, the database saves the booking or appointment.
The mobile application displays confirmation.

3. Gym Progress:
Member opens Coach Assessment.
The backend retrieves assessment records from the database.
The mobile application displays progress or assessment information.

4. Gym Navigation:
Member opens Gym Layout Viewer.
The backend retrieves gym layout from the database.
The mobile application displays the gym layout.

5. Fitness Monitoring:
Member selects Macronutrient Calculation, Muscle Mastery, or Pose Estimation and Repetition Counting.
For Macronutrient Calculation, member enters required body or fitness data, the backend calculates the result, the database saves the result, and the mobile application displays the calculation result.
For Muscle Mastery, the backend retrieves exercise and muscle data, and the mobile application displays muscle guidance.
For Pose Estimation and Repetition Counting, the mobile application uses camera input, the AI/Pose Detection Service analyzes movement and counts repetitions, the backend saves the workout result in the database, and the mobile application displays workout summary.

6. Brodigy AI:
Member opens Brodigy AI.
Member submits a question or request.
The backend sends the request to Brodigy AI Service.
Brodigy AI Service returns a response.
The mobile application displays the AI response.

7. Communication:
Member opens Notification.
The backend retrieves notifications from the database.
The mobile application displays notifications.

Decision: continue using Member Mobile Dashboard?
If yes, return to module selection.
If no, member logs out and the activity ends.
```

## Prompt 07: Non-member Mobile Application Activity Diagram

```text
Create a UML Activity Diagram titled "Non-member Mobile Application Activity Diagram".

Actor: Non-member.
Platform: Mobile Application.

Use these swimlanes:
1. Non-member
2. Mobile Application
3. Backend/System
4. Database

Non-member mobile modules:
- Account: Authentication, User Profile and Physical Metrics
- Booking and Coaching: Amenity Booking, Trainer Appointment
- Gym Progress: Coach Assessment
- Gym Navigation: Gym Layout Viewer
- Communication: Notification

Flow:
Start when non-member opens the mobile application.
The mobile application displays login/register.
Non-member submits credentials or registration details.
The backend validates the account using the database.

Decision: account valid?
If no, display login error and return to login/register.
If yes, display Non-member Mobile Dashboard.

Non-member selects a module.

Decision: selected module.

1. Account:
Non-member views or updates profile and physical metrics.
The backend validates details.
The database saves or retrieves profile data.
The mobile application displays the updated profile.

2. Booking and Coaching:
Non-member creates or views amenity booking or trainer appointment.
The backend checks availability using the database.

Decision: schedule available?
If no, the mobile application displays unavailable message.
If yes, the database saves the booking or appointment.
The mobile application displays confirmation.

3. Gym Progress:
Non-member opens Coach Assessment.
The backend retrieves available assessment records from the database.
The mobile application displays coach assessment.

4. Gym Navigation:
Non-member opens Gym Layout Viewer.
The backend retrieves gym layout from the database.
The mobile application displays the gym layout.

5. Communication:
Non-member opens Notification.
The backend retrieves notifications from the database.
The mobile application displays notifications.

Decision: continue using Non-member Mobile Dashboard?
If yes, return to module selection.
If no, non-member logs out and the activity ends.

Do not include Fitness Monitoring or Brodigy AI because these are not shown under Non-member Mobile in the latest system architecture.
```

## Prompt 08: Authentication And Access Control Activity Diagram

```text
Create a UML Activity Diagram titled "Authentication and Access Control Activity Diagram".

Actors: Coach, Staff, Admin, Member, Non-member.
Platforms: Web Application and Mobile Application.

Use these swimlanes:
1. User
2. Web/Mobile Application
3. Backend/System
4. Database

Flow:
Start when the user opens FitTrack.
The application displays login/register.
The user enters credentials or registration details.
The application sends the request to the backend.
The backend validates the account using the database.

Decision: account valid?
If no, the application displays an error and returns to login/register.
If yes, the backend checks the user role and access level.

Decision: user role and platform.
- Coach can access the Web Application only.
- Staff can access the Web Application only.
- Admin can access the Web Application only.
- Member can access the Web Application and Mobile Application.
- Non-member can access the Web Application and Mobile Application.

The backend loads the allowed modules based on role and platform.
The application displays the correct dashboard.
End the activity when the dashboard is displayed.
```

## Prompt 09: User Management Activity Diagram

```text
Create a UML Activity Diagram titled "User Management Activity Diagram".

Actors: Admin and Staff.
Platform: Web Application.

Use these swimlanes:
1. Admin/Staff
2. Web Application
3. Backend/System
4. Database

Flow:
Start when Admin or Staff opens User Management.
The backend checks access permission.

Decision: permission allowed?
If no, the web application displays access denied and the activity ends.
If yes, the backend retrieves user records from the database.

The web application displays the user list.
Admin or Staff selects an action.

Decision: selected action.
- Create user account
- View user details
- Edit user information
- Update user role or access
- Disable or activate user account

The backend validates submitted changes.

Decision: data valid?
If no, the web application displays validation error.
If yes, the backend saves changes to the database.

The web application displays confirmation.
Admin or Staff may perform another action or return to dashboard.
End.
```

## Prompt 10: Gym Operations Activity Diagram

```text
Create a UML Activity Diagram titled "Gym Operations Activity Diagram".

Actors: Admin and Staff.
Platform: Web Application.

Use these swimlanes:
1. Admin/Staff
2. Web Application
3. Backend/System
4. Database
5. Notification Service

Gym Operations modules:
- Amenity Booking Management
- Trainer Appointment Management
- Manual Payment and Receipt Verification

Flow:
Start when Admin or Staff opens Gym Operations.
The backend checks permission.

Decision: permission allowed?
If no, the web application displays access denied and the activity ends.
If yes, the web application displays gym operation options.

Admin or Staff selects an operation.

Decision: selected operation.

1. Amenity Booking Management:
The backend retrieves amenity booking records from the database.
Admin or Staff approves, updates, cancels, or views booking details.
The backend saves booking changes to the database.
The Notification Service sends booking update notification if needed.

2. Trainer Appointment Management:
The backend retrieves trainer appointment records from the database.
Admin or Staff approves, updates, cancels, or assigns schedule.
The backend saves appointment changes to the database.
The Notification Service sends appointment update notification if needed.

3. Manual Payment and Receipt Verification:
The backend retrieves submitted payment or receipt record from the database.
Admin or Staff reviews payment details.

Decision: payment valid?
If no, the backend marks the payment as rejected and the Notification Service notifies the user.
If yes, the backend marks the payment as verified, updates the related record, and the Notification Service notifies the user.

The web application displays operation result.
End or return to Gym Operations dashboard.
```

## Prompt 11: Business Analytics And Reporting Activity Diagram

```text
Create a UML Activity Diagram titled "Business Analytics and Reporting Activity Diagram".

Actor: Admin.
Platform: Web Application.

Use these swimlanes:
1. Admin
2. Web Application
3. Backend/System
4. Database

Flow:
Start when Admin opens Monitoring.
Admin selects Business Analytics and Reporting.
The backend verifies admin permission.

Decision: permission allowed?
If no, the web application displays access denied and the activity ends.
If yes, the backend retrieves business data from the database.

The backend processes analytics data such as users, bookings, appointments, payments, inventory, and memberships.
The web application displays reports and dashboard summaries.

Admin selects a report filter or date range.
The backend updates the analytics query.
The database returns filtered records.
The backend generates updated report results.
The web application displays the updated report.

Decision: view another report?
If yes, return to report filter or report selection.
If no, return to dashboard or end.
```

## Prompt 12: Retail And Equipment Inventory Activity Diagram

```text
Create a UML Activity Diagram titled "Retail and Equipment Inventory Activity Diagram".

Actors: Admin and Staff.
Platform: Web Application.

Use these swimlanes:
1. Admin/Staff
2. Web Application
3. Backend/System
4. Database

Flow:
Start when Admin or Staff opens Inventory.
The backend checks permission.

Decision: permission allowed?
If no, the web application displays access denied and the activity ends.
If yes, the backend retrieves retail and equipment inventory records from the database.

The web application displays the inventory list.
Admin or Staff selects an action.

Decision: selected action.
- Add inventory item
- Edit item details
- Update stock quantity
- Update equipment status
- View inventory record

The backend validates item data.

Decision: data valid?
If no, the web application displays validation error.
If yes, the backend saves inventory changes to the database.

The web application displays updated inventory.
End or return to Inventory dashboard.
```

## Prompt 13: Facility And Gym Layout Activity Diagram

```text
Create a UML Activity Diagram titled "Facility and Gym Layout Activity Diagram".

Actors: Admin, Member, Non-member.
Platforms: Admin uses Web Application. Member and Non-member use Web Application or Mobile Application.

Use these swimlanes:
1. User
2. Web/Mobile Application
3. Backend/System
4. Database

Flow:
Start when the user opens Gym Navigation or Facility.
The backend checks the user role and permission.

Decision: user role.

If Admin:
Admin opens Gym Layout Editor in the web application.
The backend retrieves current gym layout from the database.
The web application displays editable gym layout.
Admin edits the gym layout.
The backend validates layout changes.

Decision: layout valid?
If no, the web application displays validation error and returns to editing.
If yes, the database saves the updated layout.
The web application displays the updated layout.

If Member or Non-member:
The user opens Gym Layout Viewer.
The backend retrieves the current gym layout from the database.
The web or mobile application displays the gym layout.
The user views facility areas and equipment locations.

End or return to dashboard.
```

## Prompt 14: Exercise Lab Activity Diagram

```text
Create a UML Activity Diagram titled "Exercise Lab Activity Diagram".

Actors: Admin and Staff.
Platform: Web Application.

Use these swimlanes:
1. Admin/Staff
2. Web Application
3. Backend/System
4. Database

Flow:
Start when Admin or Staff opens Exercise Lab.
The backend checks permission.

Decision: permission allowed?
If no, the web application displays access denied and the activity ends.
If yes, the backend retrieves exercise records from the database.

The web application displays the exercise list.
Admin or Staff selects an action.

Decision: selected action.
- Create exercise
- Edit exercise
- View exercise details
- Update exercise information
- Disable or remove exercise

Admin or Staff enters exercise details such as name, target muscle, instructions, and related metadata.
The backend validates exercise data.

Decision: data valid?
If no, the web application displays validation error.
If yes, the database saves the exercise record.

The web application displays confirmation and updated exercise list.
End or return to Exercise Lab dashboard.
```

## Prompt 15: Membership Creation And Management Activity Diagram

```text
Create a UML Activity Diagram titled "Membership Creation and Management Activity Diagram".

Actors: Admin and Staff.
Platform: Web Application.

Use these swimlanes:
1. Admin/Staff
2. Web Application
3. Backend/System
4. Database

Flow:
Start when Admin or Staff opens Membership.
The backend checks permission.

Decision: permission allowed?
If no, the web application displays access denied and the activity ends.
If yes, the backend retrieves membership plans and member records from the database.

The web application displays membership dashboard.
Admin or Staff selects an action.

Decision: selected action.
- Create membership plan
- Edit membership plan
- Assign membership to user
- Update membership status
- View membership details

The backend validates membership details.

Decision: data valid?
If no, the web application displays validation error.
If yes, the database saves membership changes.

The web application displays confirmation.
End or return to Membership dashboard.
```

## Prompt 16: Booking And Coaching Activity Diagram

```text
Create a UML Activity Diagram titled "Booking and Coaching Activity Diagram".

Actors: Member, Non-member, Admin, and Staff.
Platforms: Web Application and Mobile Application.

Use these swimlanes:
1. User/Admin/Staff
2. Web/Mobile Application
3. Backend/System
4. Database
5. Notification Service

Flow:
Start when a user opens Booking and Coaching.
The backend identifies role and platform.

Decision: role and platform access.
- Web Member/Non-member can view amenity booking and trainer appointment records.
- Mobile Member/Non-member can create or view amenity bookings and trainer appointments.
- Admin/Staff can manage amenity bookings and trainer appointments in the web application.

If Member or Non-member:
The user selects Amenity Booking or Trainer Appointment.
The backend retrieves available schedules from the database.
The application displays available schedules or existing records.

Decision: platform is mobile?
If no, the user only views booking or appointment information.
If yes, the user may submit a booking or appointment request.

The backend checks availability.

Decision: slot available?
If no, the application displays unavailable message.
If yes, the database saves the booking or appointment.
The Notification Service sends confirmation notification.
The application displays confirmation.

If Admin or Staff:
Admin or Staff opens booking or appointment management.
The backend retrieves booking or appointment requests from the database.
Admin or Staff approves, updates, cancels, or manages records.
The database saves changes.
The Notification Service sends update notification.
The web application displays operation result.

End or return to dashboard.
```

## Prompt 17: Fitness Monitoring Activity Diagram

```text
Create a UML Activity Diagram titled "Fitness Monitoring Activity Diagram".

Actor: Member.
Platform: Mobile Application only.

Use these swimlanes:
1. Member
2. Mobile Application
3. Backend/System
4. Database
5. AI/Pose Detection Service

Fitness Monitoring modules:
- Macronutrient Calculation
- Muscle Mastery
- Pose Estimation and Repetition Counting

Flow:
Start when Member opens Fitness Monitoring in the mobile application.
The backend checks member access.

Decision: access allowed?
If no, the mobile application displays access denied and the activity ends.
If yes, the mobile application displays Fitness Monitoring options.

Member selects a feature.

Decision: selected feature.

1. Macronutrient Calculation:
Member enters required body and fitness information.
The backend validates input.
The backend calculates macronutrient result.
The database saves the result.
The mobile application displays the calculation result.

2. Muscle Mastery:
Member selects muscle or exercise guide.
The backend retrieves exercise and muscle data from the database.
The mobile application displays muscle guidance.

3. Pose Estimation and Repetition Counting:
Member starts workout tracking.
The mobile application activates camera.
AI/Pose Detection Service analyzes movement.
AI/Pose Detection Service counts repetitions.
The backend saves workout result to the database.
The mobile application displays workout summary.

Decision: continue another fitness activity?
If yes, return to Fitness Monitoring options.
If no, return to Member Mobile Dashboard or end.
```

## Prompt 18: Gym Progress And Coach Assessment Activity Diagram

```text
Create a UML Activity Diagram titled "Gym Progress and Coach Assessment Activity Diagram".

Actors: Member and Non-member.
Platform: Mobile Application.

Use these swimlanes:
1. Member/Non-member
2. Mobile Application
3. Backend/System
4. Database

Flow:
Start when Member or Non-member opens Gym Progress.
The mobile application displays Coach Assessment.
The user selects Coach Assessment.
The backend checks account access.

Decision: access allowed?
If no, the mobile application displays access denied and the activity ends.
If yes, the backend retrieves assessment records from the database.

The mobile application displays coach assessment information.
The user views assessment details and progress information.

Decision: updated assessment available?
If no, the user returns to dashboard or ends the activity.
If yes, the backend retrieves latest assessment data from the database.
The mobile application displays updated assessment.
End.
```

## Prompt 19: Gamification Management Activity Diagram

```text
Create a UML Activity Diagram titled "Gamification Management Activity Diagram".

Actor: Admin.
Platform: Web Application.

Use these swimlanes:
1. Admin
2. Web Application
3. Backend/System
4. Database

Flow:
Start when Admin opens Gamification Management.
The backend verifies admin permission.

Decision: permission allowed?
If no, the web application displays access denied and the activity ends.
If yes, the backend retrieves gamification rules and reward records from the database.

The web application displays gamification dashboard.
Admin selects an action.

Decision: selected action.
- Create gamification rule
- Edit gamification rule
- Update rewards
- Enable or disable gamification item
- View gamification records

The backend validates rule or reward details.

Decision: data valid?
If no, the web application displays validation error.
If yes, the database saves gamification changes.

The web application displays confirmation.
End or return to Gamification dashboard.
```

## Prompt 20: Gym Action Log Activity Diagram

```text
Create a UML Activity Diagram titled "Gym Action Log Activity Diagram".

Actors: Admin and Staff.
Platform: Web Application.

Use these swimlanes:
1. Admin/Staff
2. Web Application
3. Backend/System
4. Database

Flow:
Start when Admin or Staff opens System Logs.
The backend checks permission.

Decision: permission allowed?
If no, the web application displays access denied and the activity ends.
If yes, the backend retrieves gym action logs from the database.

The web application displays log records.
Admin or Staff applies filter such as date, user, module, or action type.
The backend retrieves filtered log records from the database.
The web application displays filtered results.
Admin or Staff views log details.

Decision: view another log?
If yes, return to log list.
If no, return to dashboard or end.
```

## Prompt 21: Brodigy AI Activity Diagram

```text
Create a UML Activity Diagram titled "Brodigy AI Activity Diagram".

Actors: Coach, Staff, Admin, and Member.
Platforms: Coach, Staff, and Admin use Web Application. Member uses Mobile Application.

Use these swimlanes:
1. User
2. Web/Mobile Application
3. Backend/System
4. Database
5. Brodigy AI Service

Flow:
Start when an allowed user opens Brodigy AI.
The backend checks if the role has Brodigy AI access.
Allowed users are Coach, Staff, Admin, and Mobile Member.

Decision: access allowed?
If no, the application displays access denied and the activity ends.
If yes, the application displays the Brodigy AI interface.

The user submits a question or request.
The backend retrieves relevant user or system context from the database when needed.
The backend sends the request to Brodigy AI Service.
Brodigy AI Service generates a response.
The backend receives and validates the response.
The application displays the AI response to the user.

Decision: ask another question?
If yes, return to AI input.
If no, return to dashboard or end.

Do not include Non-member access because Brodigy AI is not shown for Non-member Mobile or Member/Non-member Web in the latest system architecture.
```

## Prompt 22: Notification Activity Diagram

```text
Create a UML Activity Diagram titled "Notification Activity Diagram".

Actors: Member and Non-member.
Platforms: Web Application and Mobile Application.

Use these swimlanes:
1. Member/Non-member
2. Web/Mobile Application
3. Backend/System
4. Database
5. Notification Service

Flow:
Start when a notification event occurs or the user opens Communication.
Possible notification events include booking updates, trainer appointment updates, account updates, or system announcements.

The backend creates a notification record.
The database saves the notification.
The Notification Service sends or makes the notification available.

The user opens Notification.
The application requests notification records.
The backend retrieves notifications from the database.
The application displays the notification list.
The user selects a notification.
The application displays notification details.
The backend marks the notification as read.
The database saves read status.

Decision: view another notification?
If yes, return to notification list.
If no, return to dashboard or end.
```

## Recommended Diagram Order In Documentation

```text
Figure 1. FitTrack Overall System Activity Diagram
Figure 2. Coach Web Application Activity Diagram
Figure 3. Staff Web Application Activity Diagram
Figure 4. Admin Web Application Activity Diagram
Figure 5. Member and Non-member Web Application Activity Diagram
Figure 6. Member Mobile Application Activity Diagram
Figure 7. Non-member Mobile Application Activity Diagram
Figure 8. Authentication and Access Control Activity Diagram
Figure 9. User Management Activity Diagram
Figure 10. Gym Operations Activity Diagram
Figure 11. Business Analytics and Reporting Activity Diagram
Figure 12. Retail and Equipment Inventory Activity Diagram
Figure 13. Facility and Gym Layout Activity Diagram
Figure 14. Exercise Lab Activity Diagram
Figure 15. Membership Creation and Management Activity Diagram
Figure 16. Booking and Coaching Activity Diagram
Figure 17. Fitness Monitoring Activity Diagram
Figure 18. Gym Progress and Coach Assessment Activity Diagram
Figure 19. Gamification Management Activity Diagram
Figure 20. Gym Action Log Activity Diagram
Figure 21. Brodigy AI Activity Diagram
Figure 22. Notification Activity Diagram
```
