// APG Manager RMS - Script migrate dữ liệu Debt cũ → AccountsLedger
// Tài liệu: APG_Debt_Upgrade_Prompt_1.md - Bước 6
//
// Chạy: npx ts-node prisma/migrate-debts.ts
//
// Dùng raw SQL để tránh phụ thuộc vào Prisma model schema của bảng `debts` cũ
// (bảng debts có thể không còn trong schema.prisma nhưng vẫn tồn tại trong DB)
// KHÔNG xóa dữ liệu Debt cũ — giữ lại để rollback nếu cần

import { PrismaClient } from '@prisma/client';

// Kiểu dữ liệu row thô từ bảng debts cũ
interface OldDebtRow {
  id: string;
  customer_id: string;
  amount: number | null;
  total_amount: number | null;
  paid_amount: number | null;
  remaining: number | null;
  due_date: Date;
  status: string;
  description: string | null;
  created_at: Date;
  customer_type: string | null;
  customer_name: string | null;
}

const prisma = new PrismaClient();

async function tableExists(tableName: string): Promise<boolean> {
  const result = await prisma.$queryRaw<[{ exists: boolean }]>`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    ) AS exists
  `;
  return result[0]?.exists ?? false;
}

async function generateLedgerCode(direction: string): Promise<string> {
  const prefix = direction === 'RECEIVABLE' ? 'AR' : 'AP';
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = (now.getMonth() + 1).toString().padStart(2, '0');
  const dd = now.getDate().toString().padStart(2, '0');
  const datePrefix = `${prefix}-${yy}${mm}${dd}`;
  const count = await prisma.accountsLedger.count({
    where: { code: { startsWith: datePrefix } },
  });
  return `${datePrefix}-${(count + 1).toString().padStart(3, '0')}-${Date.now().toString().slice(-4)}`;
}

async function main() {
  console.log('🔄 Bắt đầu migrate Debt cũ → AccountsLedger...\n');

  // Kiểm tra bảng debts có tồn tại không
  const hasDebtsTable = await tableExists('debts');
  if (!hasDebtsTable) {
    console.log('ℹ️  Bảng "debts" không tồn tại trong DB này.');
    console.log('✅ Không có dữ liệu cũ cần migrate. Hệ thống đã dùng AccountsLedger từ đầu.');
    return;
  }

  // Lấy tất cả rows từ bảng debts cũ + join customers để lấy type
  const debts = await prisma.$queryRaw<OldDebtRow[]>`
    SELECT
      d.id,
      d.customer_id,
      d.amount,
      d.total_amount,
      d.paid_amount,
      d.remaining,
      d.due_date,
      d.status,
      d.description,
      d.created_at,
      c.type  AS customer_type,
      c.full_name AS customer_name
    FROM debts d
    LEFT JOIN customers c ON c.id = d.customer_id
    ORDER BY d.created_at ASC
  `;

  console.log(`📋 Tìm thấy ${debts.length} records Debt cũ trong bảng "debts"`);

  if (debts.length === 0) {
    console.log('✅ Không có debt cũ cần migrate');
    return;
  }

  let migrated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const debt of debts) {
    try {
      // Tính totalAmount từ các trường có thể có tên khác nhau
      const totalAmount = Number(debt.total_amount ?? debt.amount ?? debt.remaining ?? 0);
      const paidAmount  = Number(debt.paid_amount ?? 0);
      const remaining   = Number(debt.remaining ?? totalAmount - paidAmount);

      if (totalAmount === 0) {
        console.log(`⏭️  Skip Debt ${debt.id} (totalAmount = 0)`);
        skipped++;
        continue;
      }

      // Kiểm tra xem đã migrate chưa (tránh duplicate)
      const existing = await prisma.accountsLedger.findFirst({
        where: {
          customerId: debt.customer_id,
          description: { contains: '[MIGRATED]' },
          issueDate: debt.created_at,
        },
      });

      if (existing) {
        console.log(`⏭️  Skip Debt ${debt.id} (đã migrate → ${existing.code})`);
        skipped++;
        continue;
      }

      const partyType = debt.customer_type === 'CORPORATE'
        ? 'CUSTOMER_CORPORATE'
        : 'CUSTOMER_INDIVIDUAL';

      const code = await generateLedgerCode('RECEIVABLE');

      await prisma.accountsLedger.create({
        data: {
          code,
          direction:   'RECEIVABLE',
          partyType:   partyType as never,
          customerId:  debt.customer_id,
          totalAmount,
          paidAmount,
          remaining,
          dueDate:     debt.due_date,
          status:      (debt.status ?? 'ACTIVE') as never,
          description: `[MIGRATED] ${debt.description ?? 'Công nợ cũ'}`,
          issueDate:   debt.created_at,
          createdBy:   'MIGRATION_SCRIPT',
        },
      });

      const name = debt.customer_name ?? '?';
      console.log(`✅ ${code} ← Debt ${debt.id} | ${name} | ${remaining.toLocaleString('vi-VN')}đ còn lại`);
      migrated++;

      // Tiny delay để tránh code timestamp trùng
      await new Promise((r) => setTimeout(r, 5));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Lỗi migrate Debt ${debt.id}: ${msg}`);
      errors.push(debt.id);
    }
  }

  console.log('\n═══════════════════════════════════════════');
  console.log(`✅ Migrated:  ${migrated}/${debts.length} records`);
  console.log(`⏭️  Skipped:   ${skipped}`);
  if (errors.length > 0) {
    console.log(`❌ Lỗi:      ${errors.length} records: ${errors.join(', ')}`);
  }
  console.log('');
  console.log('📝 Ghi chú: Bảng "debts" cũ vẫn giữ nguyên để rollback nếu cần.');
  console.log('   Sau khi xác nhận migration OK, có thể DROP TABLE debts;');
  console.log('═══════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Migration thất bại:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
