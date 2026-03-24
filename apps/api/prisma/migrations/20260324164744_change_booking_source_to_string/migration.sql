/*
  Warnings:

  - The `source` column on the `bookings` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "bookings" DROP COLUMN "source",
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'PHONE';

-- DropEnum
DROP TYPE "BookingSource";

-- CreateIndex
CREATE INDEX "bookings_source_created_at_idx" ON "bookings"("source", "created_at");
