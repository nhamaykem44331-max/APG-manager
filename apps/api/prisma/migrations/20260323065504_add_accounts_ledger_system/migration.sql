-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('RECEIVABLE', 'PAYABLE');

-- CreateEnum
CREATE TYPE "LedgerPartyType" AS ENUM ('CUSTOMER_INDIVIDUAL', 'CUSTOMER_CORPORATE', 'AIRLINE', 'GDS_PROVIDER', 'PARTNER', 'OTHER_SUPPLIER');

-- CreateTable
CREATE TABLE "supplier_profiles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LedgerPartyType" NOT NULL,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "tax_id" TEXT,
    "bank_account" TEXT,
    "bank_name" TEXT,
    "credit_limit" DECIMAL(65,30),
    "payment_terms" INTEGER,
    "feedback_rate" DECIMAL(65,30),
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts_ledger" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "party_type" "LedgerPartyType" NOT NULL,
    "customer_id" TEXT,
    "supplier_id" TEXT,
    "customer_code" TEXT,
    "booking_id" TEXT,
    "booking_code" TEXT,
    "total_amount" DECIMAL(65,30) NOT NULL,
    "paid_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "remaining" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "issue_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" "DebtStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "invoice_number" TEXT,
    "pic" TEXT,
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_payments" (
    "id" TEXT NOT NULL,
    "ledger_id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_by" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_profiles_code_key" ON "supplier_profiles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_ledger_code_key" ON "accounts_ledger"("code");

-- CreateIndex
CREATE INDEX "accounts_ledger_direction_status_idx" ON "accounts_ledger"("direction", "status");

-- CreateIndex
CREATE INDEX "accounts_ledger_customer_id_idx" ON "accounts_ledger"("customer_id");

-- CreateIndex
CREATE INDEX "accounts_ledger_supplier_id_idx" ON "accounts_ledger"("supplier_id");

-- CreateIndex
CREATE INDEX "accounts_ledger_customer_code_idx" ON "accounts_ledger"("customer_code");

-- CreateIndex
CREATE INDEX "accounts_ledger_due_date_idx" ON "accounts_ledger"("due_date");

-- CreateIndex
CREATE INDEX "accounts_ledger_party_type_idx" ON "accounts_ledger"("party_type");

-- CreateIndex
CREATE INDEX "ledger_payments_ledger_id_idx" ON "ledger_payments"("ledger_id");

-- AddForeignKey
ALTER TABLE "accounts_ledger" ADD CONSTRAINT "accounts_ledger_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_ledger" ADD CONSTRAINT "accounts_ledger_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_ledger" ADD CONSTRAINT "accounts_ledger_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_payments" ADD CONSTRAINT "ledger_payments_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "accounts_ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
