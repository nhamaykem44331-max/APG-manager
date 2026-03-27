-- CreateEnum
CREATE TYPE "InvoiceDirection" AS ENUM ('INCOMING', 'OUTGOING');

-- CreateEnum
CREATE TYPE "InvoiceSourceType" AS ENUM ('MANUAL', 'BOOKING_BATCH', 'OCR_IMPORT', 'MISA_IMPORT');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('ELIGIBLE', 'DRAFT', 'READY_FOR_EXPORT', 'EXPORTED_TO_MISA', 'ISSUED_IN_MISA', 'SENT_TO_CUSTOMER', 'VIEWED', 'PAID', 'PARTIAL_PAID', 'CANCELLED', 'ADJUSTED', 'OCR_PENDING', 'NEED_REVIEW', 'VERIFIED', 'MATCHED', 'INVALID', 'REJECTED', 'NOT_REQUESTED');

-- CreateEnum
CREATE TYPE "InvoiceAttachmentType" AS ENUM ('IMAGE', 'PDF', 'XML', 'EXCEL', 'OTHER');

-- CreateEnum
CREATE TYPE "InvoiceImportStatus" AS ENUM ('OCR_PENDING', 'NEED_REVIEW', 'VERIFIED', 'IMPORTED', 'FAILED');

-- CreateEnum
CREATE TYPE "InvoiceExportType" AS ENUM ('DEBT_STATEMENT', 'OUTGOING_REQUEST');

-- CreateTable
CREATE TABLE "invoice_records" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "direction" "InvoiceDirection" NOT NULL,
    "source_type" "InvoiceSourceType" NOT NULL DEFAULT 'MANUAL',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "invoice_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "period_from" TIMESTAMP(3),
    "period_to" TIMESTAMP(3),
    "currency_code" TEXT NOT NULL DEFAULT 'VND',
    "payment_method" TEXT,
    "customer_id" TEXT,
    "supplier_id" TEXT,
    "buyer_type" "CustomerType",
    "invoice_number" TEXT,
    "invoice_series" TEXT,
    "invoice_template_no" TEXT,
    "transaction_id" TEXT,
    "lookup_url" TEXT,
    "seller_legal_name" TEXT,
    "seller_tax_code" TEXT,
    "seller_address" TEXT,
    "seller_email" TEXT,
    "seller_phone" TEXT,
    "seller_bank_account" TEXT,
    "seller_bank_name" TEXT,
    "buyer_legal_name" TEXT,
    "buyer_tax_code" TEXT,
    "buyer_address" TEXT,
    "buyer_email" TEXT,
    "buyer_phone" TEXT,
    "buyer_full_name" TEXT,
    "supplier_legal_name" TEXT,
    "supplier_tax_code" TEXT,
    "supplier_address" TEXT,
    "supplier_email" TEXT,
    "supplier_phone" TEXT,
    "supplier_bank_account" TEXT,
    "supplier_bank_name" TEXT,
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "vat_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "metadata" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "line_no" INTEGER NOT NULL,
    "booking_id" TEXT,
    "booking_code" TEXT,
    "pnr" TEXT,
    "ticket_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT NOT NULL,
    "passenger_name" TEXT,
    "passenger_type" TEXT,
    "route" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "unit_name" TEXT DEFAULT 'Ve',
    "currency_code" TEXT NOT NULL DEFAULT 'VND',
    "unit_price" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amount_before_vat" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "vat_rate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "vat_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "service_fee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_attachments" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "type" "InvoiceAttachmentType" NOT NULL DEFAULT 'OTHER',
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "storage_path" TEXT,
    "external_url" TEXT,
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_review_logs" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from_status" "InvoiceStatus",
    "to_status" "InvoiceStatus",
    "payload" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_review_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_import_batches" (
    "id" TEXT NOT NULL,
    "status" "InvoiceImportStatus" NOT NULL DEFAULT 'OCR_PENDING',
    "supplier_id" TEXT,
    "invoice_id" TEXT,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "file_size" INTEGER,
    "storage_path" TEXT,
    "external_url" TEXT,
    "ocr_provider" TEXT,
    "error_message" TEXT,
    "extracted_data" JSONB,
    "reviewed_data" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_export_batches" (
    "id" TEXT NOT NULL,
    "type" "InvoiceExportType" NOT NULL,
    "invoice_id" TEXT,
    "customer_id" TEXT,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL DEFAULT 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "filters" JSONB,
    "payload" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_export_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoice_records_code_key" ON "invoice_records"("code");

-- CreateIndex
CREATE INDEX "invoice_records_direction_status_idx" ON "invoice_records"("direction", "status");

-- CreateIndex
CREATE INDEX "invoice_records_customer_id_idx" ON "invoice_records"("customer_id");

-- CreateIndex
CREATE INDEX "invoice_records_supplier_id_idx" ON "invoice_records"("supplier_id");

-- CreateIndex
CREATE INDEX "invoice_records_invoice_date_idx" ON "invoice_records"("invoice_date");

-- CreateIndex
CREATE INDEX "invoice_records_invoice_number_idx" ON "invoice_records"("invoice_number");

-- CreateIndex
CREATE INDEX "invoice_line_items_invoice_id_line_no_idx" ON "invoice_line_items"("invoice_id", "line_no");

-- CreateIndex
CREATE INDEX "invoice_line_items_booking_id_idx" ON "invoice_line_items"("booking_id");

-- CreateIndex
CREATE INDEX "invoice_line_items_pnr_idx" ON "invoice_line_items"("pnr");

-- CreateIndex
CREATE INDEX "invoice_attachments_invoice_id_idx" ON "invoice_attachments"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_review_logs_invoice_id_idx" ON "invoice_review_logs"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_review_logs_created_at_idx" ON "invoice_review_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_import_batches_invoice_id_key" ON "invoice_import_batches"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_import_batches_status_created_at_idx" ON "invoice_import_batches"("status", "created_at");

-- CreateIndex
CREATE INDEX "invoice_import_batches_supplier_id_idx" ON "invoice_import_batches"("supplier_id");

-- CreateIndex
CREATE INDEX "invoice_export_batches_type_created_at_idx" ON "invoice_export_batches"("type", "created_at");

-- CreateIndex
CREATE INDEX "invoice_export_batches_invoice_id_idx" ON "invoice_export_batches"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_export_batches_customer_id_idx" ON "invoice_export_batches"("customer_id");

-- AddForeignKey
ALTER TABLE "invoice_records" ADD CONSTRAINT "invoice_records_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_records" ADD CONSTRAINT "invoice_records_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_attachments" ADD CONSTRAINT "invoice_attachments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_review_logs" ADD CONSTRAINT "invoice_review_logs_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_import_batches" ADD CONSTRAINT "invoice_import_batches_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_import_batches" ADD CONSTRAINT "invoice_import_batches_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_export_batches" ADD CONSTRAINT "invoice_export_batches_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_export_batches" ADD CONSTRAINT "invoice_export_batches_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

