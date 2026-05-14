-- CreateTable
CREATE TABLE "amenity_feedback" (
    "id" UUID NOT NULL,
    "amenity_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "comment" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "amenity_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_feedback" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "app_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "amenity_feedback_amenity_id_created_at_idx" ON "amenity_feedback"("amenity_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "amenity_feedback_user_id_created_at_idx" ON "amenity_feedback"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "app_feedback_user_id_created_at_idx" ON "app_feedback"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "amenity_feedback" ADD CONSTRAINT "amenity_feedback_amenity_id_fkey" FOREIGN KEY ("amenity_id") REFERENCES "amenities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amenity_feedback" ADD CONSTRAINT "amenity_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_feedback" ADD CONSTRAINT "app_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
