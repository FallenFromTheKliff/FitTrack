# FitTrack — S12 — Notifications
_Always include `00-global-contracts.md` alongside this file._

---

# S12 — Notifications

## Overview
Current implementation note:
- `NotificationsService.dispatch()` is the central persistence and channel-fanout path.
- Event ownership is split between owning-domain lifecycle listeners and the notifications-local listener.
- Coaching relationship emails are still handled directly in `src/coaching/relationship` and are not yet routed through S12.

Event-driven notification dispatch via in_app (always), email (primary), and SMS (secondary, high-priority events only). No push notifications — no mobile app in scope.

## Prisma Schema

```prisma
model Notification {
  id         String              @id @default(uuid()) @db.Uuid
  user_id    String              @db.Uuid
  type       NotificationType
  channel    NotificationChannel
  title      String              @db.VarChar(255)
  body       String
  data       Json?
  status     NotificationStatus  @default(pending)
  sent_at    DateTime?           @db.Timestamptz(6)
  read_at    DateTime?           @db.Timestamptz(6)
  error      String?
  created_at DateTime            @default(now()) @db.Timestamptz(6)
  updated_at DateTime            @updatedAt @db.Timestamptz(6)

  user       User                @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id, channel, status])
  @@index([user_id, read_at])
  @@map("notifications")
}

enum NotificationType {
  subscription_expiring
  subscription_expired
  payment_confirmed
  payment_failed
  booking_confirmed
  booking_cancelled
  booking_no_show
  appointment_confirmed
  appointment_completed
  appointment_cancelled
  rank_up
  low_stock           // admin only
  equipment_write_off // admin only
  ai_session_archived
  system
}

enum NotificationChannel { in_app email sms }
enum NotificationStatus  { pending sent failed read }
```

## DTOs

```typescript
class NotificationFilterDTO extends PaginationDTO {
  unread_only?: boolean          // @IsOptional() @IsBoolean()
}
```

## API Endpoints

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| GET | /v1/notifications/my | JWT | NotificationFilterDTO | In-app inbox |
| GET | /v1/notifications/unread-count | JWT | — | Unread count |
| PATCH | /v1/notifications/:id/read | JWT | — | Mark single read |
| PATCH | /v1/notifications/read-all | JWT | — | Mark all in_app read |
| DELETE | /v1/notifications/:id | JWT | — | Delete notification |
| GET | /v1/notifications/preferences | JWT | — | Get prefs |
| PATCH | /v1/notifications/preferences | JWT | UpdateNotificationPrefsDTO | Update prefs |

## Notification Dispatch Flow

**Triggered by domain events via `@OnEvent()` or domain-owned lifecycle jobs. Never called directly by clients.**

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | Domain lifecycle listener or notifications listener | Receive domain event | `@OnEvent()` handler in the owning domain, or the notifications-local listener for shared cross-domain events |
| 2 | NotificationsService | `dispatch(userId, type, payload)` | Centralized S12 entrypoint for persisted inbox plus channel fanout |
| 3 | NotificationsService | INSERT notifications (channel=in_app, type, title, body, data) | Always created; every user gets in_app |
| 4 | NotificationsService | SELECT notification_preferences WHERE user_id=X | |
| 5 | NotificationsService | If email pref enabled for this type: INSERT notifications(channel=email); enqueue email queue | |
| 6 | NotificationsService | If SMS pref enabled AND user has phone_verified_at AND type is high-priority: INSERT notifications(channel=sms); enqueue SMS queue | High-priority types: subscription_expiring, appointment_confirmed, booking_confirmed |

Current exception:
- Coaching relationship request/status emails still bypass `NotificationsService` and queue direct email in `src/coaching/relationship/relationship-lifecycle.service.ts`.

## Notifications Event Registry

| Event | Emitted By | Consumed By |
|-------|-----------|-------------|
| UserRegisteredEvent | AuthService | NotificationDomainEventsListener -> NotificationsService |
| SubscriptionWarning sweep (7d/3d/1d) | SubscriptionLifecycleService | SubscriptionLifecycleService -> NotificationsService |
| PaymentCompletedEvent (subscription payable only) | PaymentService | SubscriptionLifecycleService -> NotificationsService |
| PaymentFailedEvent | PaymentService | NotificationDomainEventsListener -> NotificationsService |
| BookingConfirmedEvent | BookingService | BookingLifecycleService -> NotificationsService |
| BookingCancelledEvent | BookingService | BookingLifecycleService -> NotificationsService |
| Booking no-show job | BookingLifecycleService | BookingLifecycleService -> NotificationsService |
| AppointmentConfirmedEvent | AppointmentService | AppointmentLifecycleService -> NotificationsService |
| AppointmentCompletedEvent | AppointmentService | AppointmentLifecycleService -> NotificationsService |
| AppointmentCancelledEvent | AppointmentService | AppointmentLifecycleService -> NotificationsService |
| RelationshipRequestedEvent | RelationshipService | RelationshipLifecycleService (direct queued email, outside S12) |
| RelationshipStatusChangedEvent | RelationshipService | RelationshipLifecycleService (direct queued email, outside S12) |
| WorkoutSessionCompletedEvent | FitnessService | GamificationService, AnalyticsService |
| TrainingPlanCreatedEvent | FitnessService | AnalyticsService |
| RankUpEvent | GamificationService | GamificationLifecycleService -> NotificationsService |
| TDEERecalculatedEvent | NutritionService | NotificationDomainEventsListener -> NotificationsService |
| LowStockEvent | InventoryService | InventoryLifecycleService -> NotificationsService |
| EquipmentWriteOffEvent | InventoryService | InventoryLifecycleService -> NotificationsService |
| AiSessionArchivedEvent | AiService | NotificationDomainEventsListener -> NotificationsService |

## Service Functions

```typescript
// NotificationsService
dispatch(userId: string, type: NotificationType, payload: NotificationPayload): Promise<void>
getMyNotifications(userId: string, dto: NotificationFilterDTO): Promise<PaginatedResult<Notification>>
getUnreadCount(userId: string): Promise<{ count: number }>
markRead(userId: string, notificationId: string): Promise<void>
markAllRead(userId: string): Promise<{ updated_count: number }>
deleteNotification(userId: string, notificationId: string): Promise<void>

// NotificationDomainEventsListener (@OnEvent handlers that live in src/notifications)
handleUserRegistered(e: UserRegisteredEvent): Promise<void>
handleTdeeRecalculated(e: TdeeRecalculatedEvent): Promise<void>
handleAiSessionArchived(e: AiSessionArchivedEvent): Promise<void>
handlePaymentFailed(e: PaymentFailedEvent): Promise<void>

// Owning-domain lifecycle listeners that call NotificationsService.dispatch()
// live in src/membership/subscription, src/bookings/booking,
// src/coaching/appointment, src/fitness/gamification, and src/inventory.
```

---
