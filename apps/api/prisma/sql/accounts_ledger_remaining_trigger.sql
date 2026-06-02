-- GĐ1 — Ép bất biến: accounts_ledger.remaining = total_amount - paid_amount
-- Lý do dùng trigger thay vì cột generated: repo quản lý schema bằng `prisma db push`,
-- mà db push sẽ revert cột generated (Prisma không biểu diễn được). Trigger thì VÔ HÌNH
-- với Prisma/db push nên sống sót qua mọi lần đồng bộ schema.
--
-- CÁCH ÁP DỤNG (chạy lại được, idempotent): áp SAU mỗi lần `prisma db push`.
--   psql "<DIRECT_URL>" -f prisma/sql/accounts_ledger_remaining_trigger.sql
--   (hoặc dán vào Supabase SQL Editor cho prod)

CREATE OR REPLACE FUNCTION set_accounts_ledger_remaining()
RETURNS TRIGGER AS $$
BEGIN
  NEW.remaining := NEW.total_amount - NEW.paid_amount;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_accounts_ledger_remaining ON accounts_ledger;
CREATE TRIGGER trg_accounts_ledger_remaining
  BEFORE INSERT OR UPDATE ON accounts_ledger
  FOR EACH ROW EXECUTE FUNCTION set_accounts_ledger_remaining();
