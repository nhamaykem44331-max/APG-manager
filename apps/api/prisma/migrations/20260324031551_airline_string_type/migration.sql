/*
  Warnings:

  - Changed the type of `airline` on the `tickets` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "tickets" DROP COLUMN "airline",
ADD COLUMN     "airline" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "tickets_airline_idx" ON "tickets"("airline");
