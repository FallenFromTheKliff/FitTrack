-- CreateEnum
CREATE TYPE "GymChatRole" AS ENUM ('user', 'assistant', 'system');

-- CreateEnum
CREATE TYPE "GymFaqCategory" AS ENUM (
    'general',
    'hours',
    'rates',
    'promo',
    'membership',
    'amenities',
    'coaching',
    'training',
    'nutrition',
    'rules'
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

-- AddForeignKey
ALTER TABLE "gym_chat_sessions" ADD CONSTRAINT "gym_chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_chat_messages" ADD CONSTRAINT "gym_chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "gym_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_chat_interaction_logs" ADD CONSTRAINT "gym_chat_interaction_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_chat_interaction_logs" ADD CONSTRAINT "gym_chat_interaction_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "gym_chat_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
