CREATE INDEX "bookings_customer_id_idx" ON "bookings"("customer_id");
CREATE INDEX "bookings_staff_id_idx" ON "bookings"("staff_id");
CREATE INDEX "bookings_status_idx" ON "bookings"("status");
CREATE INDEX "bookings_created_at_idx" ON "bookings"("created_at");
CREATE INDEX "bookings_deleted_at_idx" ON "bookings"("deleted_at");
CREATE INDEX "bookings_payment_status_idx" ON "bookings"("payment_status");

CREATE INDEX "tickets_booking_id_idx" ON "tickets"("booking_id");
CREATE INDEX "tickets_passenger_id_idx" ON "tickets"("passenger_id");
CREATE INDEX "tickets_airline_idx" ON "tickets"("airline");

CREATE INDEX "passengers_customer_id_idx" ON "passengers"("customer_id");

CREATE INDEX "payments_booking_id_idx" ON "payments"("booking_id");
CREATE INDEX "payments_paid_at_idx" ON "payments"("paid_at");

CREATE INDEX "debts_customer_id_idx" ON "debts"("customer_id");
CREATE INDEX "debts_status_idx" ON "debts"("status");
CREATE INDEX "debts_due_date_idx" ON "debts"("due_date");

CREATE INDEX "booking_status_logs_booking_id_idx" ON "booking_status_logs"("booking_id");
CREATE INDEX "booking_status_logs_created_at_idx" ON "booking_status_logs"("created_at");

CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

CREATE INDEX "customer_interactions_customer_id_idx" ON "customer_interactions"("customer_id");
CREATE INDEX "customer_interactions_staff_id_idx" ON "customer_interactions"("staff_id");
CREATE INDEX "customer_interactions_follow_up_at_idx" ON "customer_interactions"("follow_up_at");

CREATE INDEX "customer_notes_customer_id_idx" ON "customer_notes"("customer_id");
CREATE INDEX "customer_notes_staff_id_idx" ON "customer_notes"("staff_id");

CREATE INDEX "communication_logs_customer_id_idx" ON "communication_logs"("customer_id");
