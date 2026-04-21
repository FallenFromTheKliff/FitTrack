-- AlterTable
ALTER TABLE "amenity_bookings" ADD COLUMN     "coach_id" UUID;

-- CreateIndex
CREATE INDEX "amenity_bookings_coach_id_starts_at_ends_at_idx" ON "amenity_bookings"("coach_id", "starts_at", "ends_at");

-- AddForeignKey
ALTER TABLE "amenity_bookings" ADD CONSTRAINT "amenity_bookings_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "coach_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
