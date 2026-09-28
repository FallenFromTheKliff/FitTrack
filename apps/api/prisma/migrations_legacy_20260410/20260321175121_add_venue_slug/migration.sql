/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `venues` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `venues` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "venues" ADD COLUMN     "display_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "grid_column" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "grid_height" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "grid_row" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "grid_width" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "icon_key" TEXT NOT NULL DEFAULT 'dumbbell',
ADD COLUMN     "is_reservable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_system" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slug" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "venues_slug_key" ON "venues"("slug");
