-- CreateEnum
CREATE TYPE "NamedCreditStatus" AS ENUM ('ACTIVE', 'PARTIAL', 'USED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LedgerCategory" AS ENUM ('TICKET', 'TICKET_CHANGE', 'TICKET_REFUND', 'HLKG', 'SERVICE');

-- AlterEnum
ALTER TYPE "AdjustmentType" ADD VALUE 'REFUND_NAMED';
ALTER TYPE "AdjustmentType" ADD VALUE 'HLKG';
ALTER TYPE "AdjustmentType" ADD VALUE 'SERVICE';

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_customer_id_fkey";

-- AlterTable
ALTER TABLE "accounts_ledger"
ADD COLUMN "ledger_category" "LedgerCategory" NOT NULL DEFAULT 'TICKET',
ADD COLUMN "service_code" TEXT;

ALTER TABLE "bookings"
ALTER COLUMN "customer_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "named_credits" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "passenger_name" TEXT NOT NULL,
    "airline" TEXT NOT NULL,
    "ticket_number" TEXT,
    "pnr" TEXT,
    "credit_amount" DECIMAL(65,30) NOT NULL,
    "used_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "remaining_amount" DECIMAL(65,30) NOT NULL,
    "expiry_date" TIMESTAMP(3) NOT NULL,
    "status" "NamedCreditStatus" NOT NULL DEFAULT 'ACTIVE',
    "used_in_booking_id" TEXT,
    "used_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "named_credits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "named_credits_customer_id_idx" ON "named_credits"("customer_id");
CREATE INDEX "named_credits_booking_id_idx" ON "named_credits"("booking_id");
CREATE INDEX "named_credits_status_idx" ON "named_credits"("status");
CREATE INDEX "named_credits_airline_passenger_name_idx" ON "named_credits"("airline", "passenger_name");
CREATE INDEX "named_credits_expiry_date_idx" ON "named_credits"("expiry_date");
CREATE INDEX "accounts_ledger_ledger_category_idx" ON "accounts_ledger"("ledger_category");

-- AddForeignKey
ALTER TABLE "bookings"
ADD CONSTRAINT "bookings_customer_id_fkey"
FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "named_credits"
ADD CONSTRAINT "named_credits_booking_id_fkey"
FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "named_credits"
ADD CONSTRAINT "named_credits_customer_id_fkey"
FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "named_credits"
ADD CONSTRAINT "named_credits_used_in_booking_id_fkey"
FOREIGN KEY ("used_in_booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
