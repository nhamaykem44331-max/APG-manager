// Backfill cash_flow_entries -> financial_transactions cho DỮ LIỆU CŨ (trước khi dual-write live).
// CHỐNG ĐẾM TRÙNG: dùng CHUNG bộ sinh key/type với dual-write (txn-type.util) -> mỗi sự kiện tiền
// ra ĐÚNG một dedupeKey, dù được ghi bởi backfill (cũ) hay dual-write (mới). Chạy lại luôn an toàn.
// CHỈ đọc từ cash_flow_entries (sổ tiền đã khử trùng); KHÔNG đọc payments/ledger_payments.
// DRY-RUN mặc định. Thêm --commit để ghi.
//   Vd test DB: DATABASE_URL=postgresql://apg:apg_dev_2026@localhost:5433/apg_manager \
//               npx ts-node --transpile-only prisma/backfill-financial-transactions.ts --commit
import { PrismaClient } from '@prisma/client';
import { dedupeKeyFromCashFlow, mapTxnType } from '../src/finance/txn-type.util';

type AnyPrisma = PrismaClient | any;

export async function runBackfill(prisma: AnyPrisma, opts: { commit: boolean }) {
  // Chỉ backfill bút toán đã thực (status=DONE) — khớp đúng phạm vi dual-write ghi vào FT.
  const entries = await prisma.cashFlowEntry.findMany({ where: { status: 'DONE' }, orderBy: { date: 'asc' } });
  const typeCount: Record<string, number> = {};
  let upserted = 0;

  for (const e of entries) {
    const type = mapTxnType(e.sourceType, e.category, e.direction);
    const dedupeKey = dedupeKeyFromCashFlow(e);
    typeCount[type] = (typeCount[type] ?? 0) + 1;
    if (!opts.commit) continue;
    await prisma.financialTransaction.upsert({
      where: { dedupeKey },
      update: {}, // KHÔNG ghi đè bản ghi dual-write đã có (giữ link nguồn phong phú hơn của nó)
      create: {
        dedupeKey,
        direction: e.direction,
        type,
        amount: e.amount,
        occurredAt: e.date,
        currency: 'VND',
        fundAccount: e.fundAccount,
        counterpartyFundAccount: e.counterpartyFundAccount,
        transferGroupId: e.transferGroupId,
        reference: e.reference,
        pic: e.pic,
        description: e.description,
        reason: e.reason,
        createdBy: e.createdBy,
      },
    });
    upserted += 1;
  }

  return { entries: entries.length, upserted, typeCount };
}

function sumByFund(rows: { fundAccount: string | null; direction: string; amount: unknown }[]) {
  const m: Record<string, number> = {};
  for (const r of rows) {
    if (!r.fundAccount) continue;
    m[r.fundAccount] = (m[r.fundAccount] ?? 0) + (r.direction === 'INFLOW' ? 1 : -1) * Number(r.amount);
  }
  return m;
}

async function main() {
  const prisma = new PrismaClient();
  const COMMIT = process.argv.includes('--commit');

  const { entries, upserted, typeCount } = await runBackfill(prisma, { commit: COMMIT });
  console.log(`[${COMMIT ? 'COMMIT' : 'DRY-RUN'}] cash_flow_entries(DONE)=${entries} upserted=${upserted}`);
  console.log('Phan bo TxnType:', JSON.stringify(typeCount));

  // —— Validation ——
  // FT ⊋ CFE từ GĐ3b: FT có thêm COMMISSION_INCOME (đối soát, key commSettle:*) không có CFE đối ứng.
  const ftCount = await prisma.financialTransaction.count({ where: { dedupeKey: { not: { startsWith: 'commSettle:' } } } });
  console.log(`[CHECK#1 count] FT(suy từ CFE)=${ftCount} CFE(DONE)=${entries} -> ${ftCount === entries ? 'PASS' : 'FAIL'}`);

  const doneEntries = await prisma.cashFlowEntry.findMany({ where: { status: 'DONE' }, select: { fundAccount: true, direction: true, amount: true } });
  const cfeFund = sumByFund(doneEntries);
  const ftRows = await prisma.financialTransaction.findMany({ select: { fundAccount: true, direction: true, amount: true } });
  const ftFund = sumByFund(ftRows);
  let balOk = true;
  for (const f of Array.from(new Set([...Object.keys(cfeFund), ...Object.keys(ftFund)]))) {
    const ok = Math.round(cfeFund[f] ?? 0) === Math.round(ftFund[f] ?? 0);
    if (!ok) balOk = false;
    console.log(`  fund ${f}: CFE=${cfeFund[f] ?? 0} FT=${ftFund[f] ?? 0} -> ${ok ? 'PASS' : 'FAIL'}`);
  }
  console.log(`[CHECK#2 fund balances] -> ${balOk ? 'PASS' : 'FAIL'}`);

  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
