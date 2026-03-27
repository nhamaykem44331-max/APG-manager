ALTER TABLE "bookings"
ADD COLUMN "business_date" TIMESTAMP(3);

UPDATE "bookings"
SET "business_date" = "created_at"
WHERE "business_date" IS NULL;

CREATE INDEX "bookings_business_date_idx" ON "bookings"("business_date");
