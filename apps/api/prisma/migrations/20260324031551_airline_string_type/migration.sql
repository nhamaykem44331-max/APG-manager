/*
  Warnings:

  - Changed the type of `airline` on the `tickets` table from Airline enum to TEXT.

*/
-- AlterTable: safely convert enum to text
ALTER TABLE "tickets" ALTER COLUMN "airline" TYPE TEXT USING "airline"::TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tickets_airline_idx" ON "tickets"("airline");
