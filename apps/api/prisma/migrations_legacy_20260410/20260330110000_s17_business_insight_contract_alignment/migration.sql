-- CreateEnum
CREATE TYPE "InsightFocus" AS ENUM (
    'overview',
    'revenue',
    'attendance',
    'membership',
    'coaching',
    'inventory'
);

-- CreateEnum
CREATE TYPE "InsightPeriod" AS ENUM (
    'daily',
    'weekly',
    'monthly',
    'yearly',
    'custom'
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
CREATE INDEX "business_insight_runs_created_at_idx" ON "business_insight_runs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "business_insight_runs_requested_by_created_at_idx" ON "business_insight_runs"("requested_by", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "business_insight_runs" ADD CONSTRAINT "business_insight_runs_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
