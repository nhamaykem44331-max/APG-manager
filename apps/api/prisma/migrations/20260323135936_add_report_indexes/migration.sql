-- CreateIndex
CREATE INDEX "bookings_source_created_at_idx" ON "bookings"("source", "created_at");

-- CreateIndex
CREATE INDEX "tickets_departure_code_arrival_code_idx" ON "tickets"("departure_code", "arrival_code");
