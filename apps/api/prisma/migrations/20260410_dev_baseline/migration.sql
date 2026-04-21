-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'staff', 'member', 'coach');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('pending', 'active', 'suspended', 'banned');

-- CreateEnum
CREATE TYPE "AccountDeletionRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('email', 'phone', 'google');

-- CreateEnum
CREATE TYPE "OtpChannel" AS ENUM ('email', 'sms');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('registration', 'login_2fa', 'password_reset', 'phone_verify');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'other');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('sedentary', 'light', 'moderate', 'active', 'very_active');

-- CreateEnum
CREATE TYPE "FitnessGoal" AS ENUM ('bulking', 'cutting', 'maintenance', 'sport_specific');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('pending_payment', 'active', 'past_due', 'expired', 'cancelled', 'suspended');

-- CreateEnum
CREATE TYPE "MembershipCardStatus" AS ENUM ('pending_verification', 'active', 'revoked');

-- CreateEnum
CREATE TYPE "MembershipCardSource" AS ENUM ('cash', 'paymongo', 'admin_grant', 'admin_repair');

-- CreateEnum
CREATE TYPE "PayableType" AS ENUM ('subscription', 'booking', 'coaching', 'product');

-- CreateEnum
CREATE TYPE "PaymentStage" AS ENUM ('downpayment', 'balance', 'full');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('paymongo', 'cash');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'processing', 'awaiting_verification', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "AmenityType" AS ENUM ('basketball_court', 'boxing_ring', 'other');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'confirmed', 'balance_pending', 'completed', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('pending_coach', 'pending_payment', 'confirmed', 'cancelled', 'completed', 'no_show');

-- CreateEnum
CREATE TYPE "RelationshipStatus" AS ENUM ('pending', 'active', 'paused', 'terminated');

-- CreateEnum
CREATE TYPE "ExerciseCategory" AS ENUM ('strength', 'cardio', 'flexibility', 'balance');

-- CreateEnum
CREATE TYPE "PoseProfileKind" AS ENUM ('seed', 'learned');

-- CreateEnum
CREATE TYPE "PlanSource" AS ENUM ('ai_generated', 'coach_assigned', 'self_created');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "MasteryRank" AS ENUM ('bronze', 'silver', 'gold', 'platinum', 'adamantite');

-- CreateEnum
CREATE TYPE "NutritionUnit" AS ENUM ('g', 'kg', 'ml', 'L', 'oz', 'lb', 'cup', 'tbsp', 'tsp', 'serving', 'piece');

-- CreateEnum
CREATE TYPE "SalePaymentMethod" AS ENUM ('cash', 'paymongo');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('pending', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "ChatContext" AS ENUM ('general', 'tdee_adjustment', 'training_plan', 'nutrition');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('user', 'assistant');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('chat', 'plan_generation', 'tdee_adjustment', 'pose_analysis');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('subscription_expiring', 'subscription_expired', 'payment_confirmed', 'payment_failed', 'booking_confirmed', 'booking_cancelled', 'booking_no_show', 'appointment_confirmed', 'appointment_completed', 'appointment_cancelled', 'rank_up', 'low_stock', 'equipment_write_off', 'ai_session_archived', 'system');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('in_app', 'email', 'sms');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'sent', 'failed', 'read');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('available', 'occupied', 'maintenance');

-- CreateEnum
CREATE TYPE "GymChatRole" AS ENUM ('user', 'assistant', 'system');

-- CreateEnum
CREATE TYPE "GymFaqCategory" AS ENUM ('general', 'hours', 'rates', 'promo', 'membership', 'amenities', 'coaching', 'training', 'nutrition', 'rules');

-- CreateEnum
CREATE TYPE "InsightFocus" AS ENUM ('overview', 'revenue', 'attendance', 'membership', 'coaching', 'inventory');

-- CreateEnum
CREATE TYPE "InsightPeriod" AS ENUM ('daily', 'weekly', 'monthly', 'yearly', 'custom');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'pending',
    "email_verified_at" TIMESTAMPTZ(6),
    "phone_verified_at" TIMESTAMPTZ(6),
    "qr_code_token" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_deletion_requests" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "reason" TEXT,
    "status" "AccountDeletionRequestStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "account_deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "identifier" VARCHAR(255) NOT NULL,
    "credential_hash" VARCHAR(255),
    "provider_user_id" VARCHAR(255),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "device_info" VARCHAR(255),
    "ip_address" VARCHAR(45),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "rotated_from" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_verifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" "OtpChannel" NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "code_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "otp_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20),
    "date_of_birth" DATE,
    "gender" "Gender",
    "weight_kg" DECIMAL(5,2),
    "height_cm" DECIMAL(5,2),
    "activity_level" "ActivityLevel",
    "fitness_goal" "FitnessGoal",
    "avatar_url" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_metrics" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "weight_kg" DECIMAL(5,2),
    "height_cm" DECIMAL(5,2),
    "body_fat_pct" DECIMAL(4,2),
    "muscle_mass_kg" DECIMAL(5,2),
    "waist_cm" DECIMAL(5,2),
    "chest_cm" DECIMAL(5,2),
    "notes" TEXT,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "progress_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "subscription_expiring_email" BOOLEAN NOT NULL DEFAULT true,
    "subscription_expiring_sms" BOOLEAN NOT NULL DEFAULT false,
    "subscription_expired_email" BOOLEAN NOT NULL DEFAULT true,
    "booking_confirmed_email" BOOLEAN NOT NULL DEFAULT true,
    "booking_confirmed_sms" BOOLEAN NOT NULL DEFAULT false,
    "booking_cancelled_email" BOOLEAN NOT NULL DEFAULT true,
    "booking_no_show_email" BOOLEAN NOT NULL DEFAULT true,
    "appointment_confirmed_email" BOOLEAN NOT NULL DEFAULT true,
    "appointment_confirmed_sms" BOOLEAN NOT NULL DEFAULT false,
    "appointment_completed_email" BOOLEAN NOT NULL DEFAULT true,
    "appointment_cancelled_email" BOOLEAN NOT NULL DEFAULT true,
    "rank_up_email" BOOLEAN NOT NULL DEFAULT true,
    "payment_confirmed_email" BOOLEAN NOT NULL DEFAULT true,
    "payment_failed_email" BOOLEAN NOT NULL DEFAULT true,
    "ai_session_archived_email" BOOLEAN NOT NULL DEFAULT true,
    "system_email" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "scanned_by" UUID,
    "check_in_at" TIMESTAMPTZ(6) NOT NULL,
    "check_out_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "attendance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_plans" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'PHP',
    "duration_days" INTEGER NOT NULL,
    "features" JSONB NOT NULL DEFAULT '{}',
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "includes_coaching" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "membership_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "payment_id" UUID,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'pending_payment',
    "starts_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "warned_7d_at" TIMESTAMPTZ(6),
    "warned_3d_at" TIMESTAMPTZ(6),
    "warned_1d_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_cards" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "MembershipCardStatus" NOT NULL DEFAULT 'active',
    "source" "MembershipCardSource" NOT NULL DEFAULT 'admin_grant',
    "price" DECIMAL(10,2) NOT NULL DEFAULT 400,
    "purchased_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" TIMESTAMPTZ(6),
    "verified_by" UUID,
    "activated_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_by" UUID,
    "revoke_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "membership_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "payable_type" "PayableType" NOT NULL,
    "payable_id" UUID NOT NULL,
    "payment_stage" "PaymentStage" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'PHP',
    "provider" "PaymentProvider" NOT NULL,
    "provider_ref" VARCHAR(255),
    "gateway_event_id" VARCHAR(255),
    "idempotency_key" VARCHAR(128) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "gateway_metadata" JSONB,
    "screenshot_url" VARCHAR(500),
    "rejection_reason" TEXT,
    "verified_by" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amenities" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" "AmenityType" NOT NULL,
    "description" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "hourly_rate" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "minimum_hours" INTEGER,
    "icon_key" VARCHAR(100),
    "grid_column" INTEGER,
    "grid_row" INTEGER,
    "grid_width" INTEGER,
    "grid_height" INTEGER,
    "is_reservable" BOOLEAN,
    "display_order" INTEGER,
    "floor_id" VARCHAR(20),
    "requires_subscription" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amenity_bookings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amenity_id" UUID NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending',
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "downpayment_amount" DECIMAL(10,2) NOT NULL,
    "balance_amount" DECIMAL(10,2) NOT NULL,
    "downpayment_paid_at" TIMESTAMPTZ(6),
    "balance_paid_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "amenity_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "specialization" VARCHAR(255),
    "bio" TEXT,
    "certification" VARCHAR(255),
    "hourly_rate" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "gym_commission_pct" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "average_rating" DECIMAL(3,2),
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "is_available_for_booking" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "coach_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_appointments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "coach_id" UUID NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'pending_coach',
    "is_free_session" BOOLEAN NOT NULL DEFAULT false,
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "total_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "downpayment_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "balance_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "gym_revenue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "coach_earnings" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "downpayment_paid_at" TIMESTAMPTZ(6),
    "balance_paid_at" TIMESTAMPTZ(6),
    "session_notes" TEXT,
    "member_notes" TEXT,
    "completed_at" TIMESTAMPTZ(6),
    "no_show_at" TIMESTAMPTZ(6),
    "cancellation_reason" TEXT,
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "coach_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_reviews" (
    "id" UUID NOT NULL,
    "coach_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "rating" SMALLINT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "coach_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_availability_slots" (
    "id" UUID NOT NULL,
    "coach_id" UUID NOT NULL,
    "day_of_week" SMALLINT NOT NULL,
    "start_time" TIME(0) NOT NULL,
    "end_time" TIME(0) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "coach_availability_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_client_relationships" (
    "id" UUID NOT NULL,
    "coach_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "status" "RelationshipStatus" NOT NULL DEFAULT 'pending',
    "started_at" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "coach_client_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_catalog" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "muscle_group" VARCHAR(100) NOT NULL,
    "category" "ExerciseCategory" NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "video_url" VARCHAR(500),
    "image_url" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "exercise_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_plans" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "coach_id" UUID,
    "source" "PlanSource" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "goal" "FitnessGoal" NOT NULL,
    "duration_weeks" INTEGER NOT NULL,
    "days_per_week" SMALLINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "is_template" BOOLEAN NOT NULL DEFAULT false,
    "ai_generation_prompt" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "training_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_schedule_days" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "week_number" SMALLINT NOT NULL,
    "day_of_week" SMALLINT NOT NULL,
    "focus_label" VARCHAR(100),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "training_schedule_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_exercises" (
    "id" UUID NOT NULL,
    "schedule_day_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "sets" SMALLINT NOT NULL,
    "reps" SMALLINT,
    "duration_seconds" INTEGER,
    "rest_seconds" INTEGER NOT NULL DEFAULT 60,
    "weight_kg_target" DECIMAL(6,2),
    "notes" TEXT,
    "order_index" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "plan_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID,
    "status" "SessionStatus" NOT NULL DEFAULT 'in_progress',
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "duration_seconds" INTEGER,
    "total_volume_kg" DECIMAL(10,2),
    "last_activity_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_logs" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_exercise_id" UUID,
    "exercise_id" UUID NOT NULL,
    "set_number" SMALLINT NOT NULL,
    "reps_target" SMALLINT,
    "reps_completed" SMALLINT,
    "reps_ai_counted" SMALLINT,
    "weight_kg" DECIMAL(6,2),
    "duration_seconds" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "exercise_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pose_exercise_profiles" (
    "id" UUID NOT NULL,
    "exercise_id" UUID,
    "canonical_name" VARCHAR(100) NOT NULL,
    "profile_kind" "PoseProfileKind" NOT NULL DEFAULT 'seed',
    "landmark_signature" JSONB NOT NULL,
    "angle_signature" JSONB NOT NULL,
    "rep_rules" JSONB,
    "sample_count" INTEGER NOT NULL DEFAULT 1,
    "confidence_threshold" DECIMAL(4,3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pose_exercise_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pose_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "exercise_log_id" UUID,
    "exercise_hint" VARCHAR(255),
    "rep_count_ai" SMALLINT NOT NULL DEFAULT 0,
    "confidence_avg" DECIMAL(4,3),
    "detected_exercise_name" VARCHAR(100),
    "detected_profile_id" UUID,
    "classification_confidence" DECIMAL(4,3),
    "subject_lock_confidence" DECIMAL(4,3),
    "analysis_summary" JSONB,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pose_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "muscle_mastery_progress" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "muscle_group" VARCHAR(100) NOT NULL,
    "total_volume_kg" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "xp_points" INTEGER NOT NULL DEFAULT 0,
    "rank" "MasteryRank" NOT NULL DEFAULT 'bronze',
    "last_ranked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "muscle_mastery_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tdee_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "weight_kg" DECIMAL(5,2) NOT NULL,
    "height_cm" DECIMAL(5,2) NOT NULL,
    "age" SMALLINT NOT NULL,
    "gender" "Gender" NOT NULL,
    "activity_level" "ActivityLevel" NOT NULL,
    "fitness_goal" "FitnessGoal" NOT NULL,
    "bmr_calories" DECIMAL(8,2) NOT NULL,
    "tdee_calories" DECIMAL(8,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "calculated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tdee_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "macro_targets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tdee_profile_id" UUID NOT NULL,
    "target_calories" DECIMAL(8,2) NOT NULL,
    "protein_g" DECIMAL(6,2) NOT NULL,
    "carbs_g" DECIMAL(6,2) NOT NULL,
    "fat_g" DECIMAL(6,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "macro_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nutrition_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "macro_target_id" UUID,
    "log_date" DATE NOT NULL,
    "meal_name" VARCHAR(100) NOT NULL,
    "food_item" VARCHAR(255) NOT NULL,
    "calories" DECIMAL(8,2) NOT NULL,
    "protein_g" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "carbs_g" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "fat_g" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "quantity" DECIMAL(6,2) NOT NULL DEFAULT 1,
    "unit" "NutritionUnit" NOT NULL DEFAULT 'serving',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "nutrition_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retail_products" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "category" VARCHAR(80) NOT NULL DEFAULT 'other',
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "reorder_threshold" INTEGER NOT NULL DEFAULT 10,
    "last_low_stock_alert_at" TIMESTAMPTZ(6),
    "image_url" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "retail_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_transactions" (
    "id" UUID NOT NULL,
    "customer_name" VARCHAR(255),
    "customer_user_id" UUID,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "payment_method" "SalePaymentMethod" NOT NULL,
    "payment_id" UUID,
    "processed_by" UUID NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sale_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_transaction_items" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sale_transaction_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_equipment_items" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "quantity_total" INTEGER NOT NULL,
    "quantity_current" INTEGER NOT NULL,
    "unit" VARCHAR(50) NOT NULL DEFAULT 'units',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gym_equipment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_write_offs" (
    "id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "quantity_before" INTEGER NOT NULL,
    "quantity_set_to" INTEGER NOT NULL,
    "quantity_lost" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "performed_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "equipment_write_offs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "context_type" "ChatContext" NOT NULL,
    "title" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_activity_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ai_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_messages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "action_triggered" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ai_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_interaction_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID,
    "interaction_type" "InteractionType" NOT NULL,
    "request_payload" JSONB NOT NULL,
    "response_payload" JSONB,
    "action_triggered" VARCHAR(100),
    "action_result" JSONB,
    "latency_ms" INTEGER,
    "model_used" VARCHAR(100),
    "token_count" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ai_interaction_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMPTZ(6),
    "read_at" TIMESTAMPTZ(6),
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_equipment" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "floor_id" VARCHAR(20) NOT NULL DEFAULT 'floor-1',
    "grid_column" INTEGER,
    "grid_row" INTEGER,
    "position_x" DECIMAL(8,2) NOT NULL,
    "position_y" DECIMAL(8,2) NOT NULL,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'available',
    "icon_key" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gym_equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity" VARCHAR(100) NOT NULL,
    "entity_id" VARCHAR(100) NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_chat_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_activity_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gym_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_chat_messages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "role" "GymChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "grounded_sources" JSONB,
    "out_of_scope" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gym_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_chat_interaction_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID,
    "request_payload" JSONB NOT NULL,
    "grounding_payload" JSONB,
    "response_payload" JSONB,
    "latency_ms" INTEGER,
    "model_used" VARCHAR(100),
    "token_count" INTEGER,
    "out_of_scope" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gym_chat_interaction_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_operating_hours" (
    "id" UUID NOT NULL,
    "day_of_week" SMALLINT NOT NULL,
    "opens_at" TIME(0) NOT NULL,
    "closes_at" TIME(0) NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "label" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gym_operating_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_special_schedules" (
    "id" UUID NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "opens_at" TIME(0),
    "closes_at" TIME(0),
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "reason" VARCHAR(255) NOT NULL,
    "pricing_note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gym_special_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_promotions" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "promo_code" VARCHAR(100),
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "pricing_note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gym_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_faq_entries" (
    "id" UUID NOT NULL,
    "category" "GymFaqCategory" NOT NULL,
    "question" VARCHAR(255) NOT NULL,
    "answer" TEXT NOT NULL,
    "keywords" JSONB,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gym_faq_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_insight_runs" (
    "id" UUID NOT NULL,
    "requested_by" UUID,
    "focus" "InsightFocus" NOT NULL,
    "period" "InsightPeriod" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "request_payload" JSONB NOT NULL,
    "insight_payload" JSONB NOT NULL,
    "model_used" VARCHAR(100),
    "token_count" INTEGER,
    "latency_ms" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "business_insight_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_qr_code_token_key" ON "users"("qr_code_token");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "account_deletion_requests_user_id_idx" ON "account_deletion_requests"("user_id");

-- CreateIndex
CREATE INDEX "account_deletion_requests_status_idx" ON "account_deletion_requests"("status");

-- CreateIndex
CREATE INDEX "auth_identities_provider_identifier_idx" ON "auth_identities"("provider", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "auth_identities_user_id_provider_identifier_key" ON "auth_identities"("user_id", "provider", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "otp_verifications_user_id_purpose_idx" ON "otp_verifications"("user_id", "purpose");

-- CreateIndex
CREATE INDEX "otp_verifications_expires_at_idx" ON "otp_verifications"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE INDEX "progress_metrics_user_id_recorded_at_idx" ON "progress_metrics"("user_id", "recorded_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE INDEX "attendance_logs_user_id_check_in_at_idx" ON "attendance_logs"("user_id", "check_in_at" DESC);

-- CreateIndex
CREATE INDEX "attendance_logs_check_in_at_idx" ON "attendance_logs"("check_in_at");

-- CreateIndex
CREATE INDEX "membership_plans_is_active_sort_order_idx" ON "membership_plans"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "subscriptions_expires_at_status_idx" ON "subscriptions"("expires_at", "status");

-- CreateIndex
CREATE UNIQUE INDEX "membership_cards_user_id_key" ON "membership_cards"("user_id");

-- CreateIndex
CREATE INDEX "membership_cards_status_idx" ON "membership_cards"("status");

-- CreateIndex
CREATE INDEX "membership_cards_verified_by_idx" ON "membership_cards"("verified_by");

-- CreateIndex
CREATE INDEX "membership_cards_revoked_by_idx" ON "membership_cards"("revoked_by");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_ref_key" ON "payments"("provider_ref");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gateway_event_id_key" ON "payments"("gateway_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_payable_type_payable_id_idx" ON "payments"("payable_type", "payable_id");

-- CreateIndex
CREATE INDEX "payments_user_id_status_idx" ON "payments"("user_id", "status");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "amenities_is_active_type_idx" ON "amenities"("is_active", "type");

-- CreateIndex
CREATE INDEX "amenity_bookings_user_id_idx" ON "amenity_bookings"("user_id");

-- CreateIndex
CREATE INDEX "amenity_bookings_amenity_id_starts_at_ends_at_idx" ON "amenity_bookings"("amenity_id", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "amenity_bookings_status_idx" ON "amenity_bookings"("status");

-- CreateIndex
CREATE UNIQUE INDEX "coach_profiles_user_id_key" ON "coach_profiles"("user_id");

-- CreateIndex
CREATE INDEX "coach_profiles_is_available_for_booking_average_rating_idx" ON "coach_profiles"("is_available_for_booking", "average_rating" DESC);

-- CreateIndex
CREATE INDEX "coach_appointments_user_id_status_idx" ON "coach_appointments"("user_id", "status");

-- CreateIndex
CREATE INDEX "coach_appointments_coach_id_scheduled_at_idx" ON "coach_appointments"("coach_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "coach_appointments_scheduled_at_status_idx" ON "coach_appointments"("scheduled_at", "status");

-- CreateIndex
CREATE UNIQUE INDEX "coach_reviews_appointment_id_key" ON "coach_reviews"("appointment_id");

-- CreateIndex
CREATE INDEX "coach_reviews_coach_id_created_at_idx" ON "coach_reviews"("coach_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "coach_availability_slots_coach_id_day_of_week_is_active_idx" ON "coach_availability_slots"("coach_id", "day_of_week", "is_active");

-- CreateIndex
CREATE INDEX "coach_client_relationships_coach_id_status_idx" ON "coach_client_relationships"("coach_id", "status");

-- CreateIndex
CREATE INDEX "coach_client_relationships_member_id_status_idx" ON "coach_client_relationships"("member_id", "status");

-- CreateIndex
CREATE INDEX "exercise_catalog_muscle_group_is_active_idx" ON "exercise_catalog"("muscle_group", "is_active");

-- CreateIndex
CREATE INDEX "exercise_catalog_category_idx" ON "exercise_catalog"("category");

-- CreateIndex
CREATE INDEX "training_plans_user_id_is_active_idx" ON "training_plans"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "training_schedule_days_plan_id_week_number_day_of_week_idx" ON "training_schedule_days"("plan_id", "week_number", "day_of_week");

-- CreateIndex
CREATE INDEX "plan_exercises_schedule_day_id_order_index_idx" ON "plan_exercises"("schedule_day_id", "order_index");

-- CreateIndex
CREATE INDEX "workout_sessions_user_id_status_idx" ON "workout_sessions"("user_id", "status");

-- CreateIndex
CREATE INDEX "workout_sessions_user_id_started_at_idx" ON "workout_sessions"("user_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "exercise_logs_session_id_idx" ON "exercise_logs"("session_id");

-- CreateIndex
CREATE INDEX "exercise_logs_exercise_id_created_at_idx" ON "exercise_logs"("exercise_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "pose_exercise_profiles_canonical_name_is_active_idx" ON "pose_exercise_profiles"("canonical_name", "is_active");

-- CreateIndex
CREATE INDEX "pose_exercise_profiles_exercise_id_is_active_idx" ON "pose_exercise_profiles"("exercise_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "pose_sessions_exercise_log_id_key" ON "pose_sessions"("exercise_log_id");

-- CreateIndex
CREATE INDEX "pose_sessions_user_id_idx" ON "pose_sessions"("user_id");

-- CreateIndex
CREATE INDEX "pose_sessions_detected_exercise_name_idx" ON "pose_sessions"("detected_exercise_name");

-- CreateIndex
CREATE INDEX "pose_sessions_detected_profile_id_idx" ON "pose_sessions"("detected_profile_id");

-- CreateIndex
CREATE INDEX "muscle_mastery_progress_user_id_idx" ON "muscle_mastery_progress"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "muscle_mastery_progress_user_id_muscle_group_key" ON "muscle_mastery_progress"("user_id", "muscle_group");

-- CreateIndex
CREATE INDEX "tdee_profiles_user_id_is_active_idx" ON "tdee_profiles"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "macro_targets_user_id_is_active_idx" ON "macro_targets"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "nutrition_logs_user_id_log_date_idx" ON "nutrition_logs"("user_id", "log_date" DESC);

-- CreateIndex
CREATE INDEX "nutrition_logs_log_date_idx" ON "nutrition_logs"("log_date");

-- CreateIndex
CREATE INDEX "retail_products_category_is_active_idx" ON "retail_products"("category", "is_active");

-- CreateIndex
CREATE INDEX "retail_products_is_active_idx" ON "retail_products"("is_active");

-- CreateIndex
CREATE INDEX "retail_products_stock_quantity_idx" ON "retail_products"("stock_quantity");

-- CreateIndex
CREATE INDEX "sale_transactions_created_at_idx" ON "sale_transactions"("created_at" DESC);

-- CreateIndex
CREATE INDEX "sale_transactions_customer_user_id_idx" ON "sale_transactions"("customer_user_id");

-- CreateIndex
CREATE INDEX "sale_transactions_status_idx" ON "sale_transactions"("status");

-- CreateIndex
CREATE INDEX "sale_transaction_items_transaction_id_idx" ON "sale_transaction_items"("transaction_id");

-- CreateIndex
CREATE INDEX "sale_transaction_items_product_id_idx" ON "sale_transaction_items"("product_id");

-- CreateIndex
CREATE INDEX "gym_equipment_items_is_active_idx" ON "gym_equipment_items"("is_active");

-- CreateIndex
CREATE INDEX "equipment_write_offs_equipment_id_created_at_idx" ON "equipment_write_offs"("equipment_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_chat_sessions_user_id_is_active_idx" ON "ai_chat_sessions"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "ai_chat_messages_session_id_created_at_idx" ON "ai_chat_messages"("session_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_interaction_logs_user_id_interaction_type_idx" ON "ai_interaction_logs"("user_id", "interaction_type");

-- CreateIndex
CREATE INDEX "ai_interaction_logs_created_at_idx" ON "ai_interaction_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_user_id_channel_status_idx" ON "notifications"("user_id", "channel", "status");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "gym_equipment_status_idx" ON "gym_equipment"("status");

-- CreateIndex
CREATE INDEX "gym_equipment_is_active_idx" ON "gym_equipment"("is_active");

-- CreateIndex
CREATE INDEX "gym_equipment_floor_id_grid_column_grid_row_idx" ON "gym_equipment"("floor_id", "grid_column", "grid_row");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "gym_chat_sessions_user_id_is_active_idx" ON "gym_chat_sessions"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "gym_chat_messages_session_id_created_at_idx" ON "gym_chat_messages"("session_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "gym_chat_interaction_logs_user_id_created_at_idx" ON "gym_chat_interaction_logs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "gym_operating_hours_day_of_week_key" ON "gym_operating_hours"("day_of_week");

-- CreateIndex
CREATE INDEX "gym_special_schedules_starts_on_ends_on_is_active_idx" ON "gym_special_schedules"("starts_on", "ends_on", "is_active");

-- CreateIndex
CREATE INDEX "gym_promotions_starts_at_ends_at_is_active_idx" ON "gym_promotions"("starts_at", "ends_at", "is_active");

-- CreateIndex
CREATE INDEX "gym_faq_entries_category_is_active_sort_order_idx" ON "gym_faq_entries"("category", "is_active", "sort_order");

-- CreateIndex
CREATE INDEX "business_insight_runs_created_at_idx" ON "business_insight_runs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "business_insight_runs_requested_by_created_at_idx" ON "business_insight_runs"("requested_by", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_rotated_from_fkey" FOREIGN KEY ("rotated_from") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_verifications" ADD CONSTRAINT "otp_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_metrics" ADD CONSTRAINT "progress_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_scanned_by_fkey" FOREIGN KEY ("scanned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "membership_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_cards" ADD CONSTRAINT "membership_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amenity_bookings" ADD CONSTRAINT "amenity_bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amenity_bookings" ADD CONSTRAINT "amenity_bookings_amenity_id_fkey" FOREIGN KEY ("amenity_id") REFERENCES "amenities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_profiles" ADD CONSTRAINT "coach_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_appointments" ADD CONSTRAINT "coach_appointments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_appointments" ADD CONSTRAINT "coach_appointments_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "coach_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_reviews" ADD CONSTRAINT "coach_reviews_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "coach_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_reviews" ADD CONSTRAINT "coach_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_reviews" ADD CONSTRAINT "coach_reviews_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "coach_appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_availability_slots" ADD CONSTRAINT "coach_availability_slots_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "coach_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_client_relationships" ADD CONSTRAINT "coach_client_relationships_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "coach_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_client_relationships" ADD CONSTRAINT "coach_client_relationships_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_schedule_days" ADD CONSTRAINT "training_schedule_days_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "training_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_exercises" ADD CONSTRAINT "plan_exercises_schedule_day_id_fkey" FOREIGN KEY ("schedule_day_id") REFERENCES "training_schedule_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_exercises" ADD CONSTRAINT "plan_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercise_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "training_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_logs" ADD CONSTRAINT "exercise_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_logs" ADD CONSTRAINT "exercise_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_logs" ADD CONSTRAINT "exercise_logs_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercise_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pose_exercise_profiles" ADD CONSTRAINT "pose_exercise_profiles_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercise_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pose_sessions" ADD CONSTRAINT "pose_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pose_sessions" ADD CONSTRAINT "pose_sessions_exercise_log_id_fkey" FOREIGN KEY ("exercise_log_id") REFERENCES "exercise_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pose_sessions" ADD CONSTRAINT "pose_sessions_detected_profile_id_fkey" FOREIGN KEY ("detected_profile_id") REFERENCES "pose_exercise_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "muscle_mastery_progress" ADD CONSTRAINT "muscle_mastery_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tdee_profiles" ADD CONSTRAINT "tdee_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "macro_targets" ADD CONSTRAINT "macro_targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "macro_targets" ADD CONSTRAINT "macro_targets_tdee_profile_id_fkey" FOREIGN KEY ("tdee_profile_id") REFERENCES "tdee_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nutrition_logs" ADD CONSTRAINT "nutrition_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nutrition_logs" ADD CONSTRAINT "nutrition_logs_macro_target_id_fkey" FOREIGN KEY ("macro_target_id") REFERENCES "macro_targets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_transactions" ADD CONSTRAINT "sale_transactions_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_transactions" ADD CONSTRAINT "sale_transactions_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_transaction_items" ADD CONSTRAINT "sale_transaction_items_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "sale_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_transaction_items" ADD CONSTRAINT "sale_transaction_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "retail_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_write_offs" ADD CONSTRAINT "equipment_write_offs_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "gym_equipment_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_write_offs" ADD CONSTRAINT "equipment_write_offs_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_sessions" ADD CONSTRAINT "ai_chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ai_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_interaction_logs" ADD CONSTRAINT "ai_interaction_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_interaction_logs" ADD CONSTRAINT "ai_interaction_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ai_chat_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_chat_sessions" ADD CONSTRAINT "gym_chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_chat_messages" ADD CONSTRAINT "gym_chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "gym_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_chat_interaction_logs" ADD CONSTRAINT "gym_chat_interaction_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_chat_interaction_logs" ADD CONSTRAINT "gym_chat_interaction_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "gym_chat_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_insight_runs" ADD CONSTRAINT "business_insight_runs_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
