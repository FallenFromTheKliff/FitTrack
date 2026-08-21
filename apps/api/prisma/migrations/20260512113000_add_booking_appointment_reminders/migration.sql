ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'booking_reminder';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'appointment_reminder';

ALTER TABLE "notification_preferences"
  ADD COLUMN IF NOT EXISTS "venue_booking_reminder_email" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "venue_booking_reminder_sms" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "coach_appointment_reminder_email" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "coach_appointment_reminder_sms" BOOLEAN NOT NULL DEFAULT false;
