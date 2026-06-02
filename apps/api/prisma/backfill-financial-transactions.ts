// Backfill cash_flow_entries -> financial_transactions (1:1, idempotent theo dedupeKey="cfe:<id>").
// CHỐNG ĐẾM TRÙNG: chỉ đọc từ cash_flow_entries (sổ tiền đã khử trùng); KHÔNG đọc payments/ledger_payments.
// DRY-RUN mặc định. Thêm --commit để ghi. Dùng DATABASE_URL từ môi trường.
//   Vd test DB: DATABASE_URL=postgresql://apg:apg_dev_2026@localhost:5433/apg_manager \
//               npx ts-node --transpile-only prisma/backfill-financial-transactions.ts --commit
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const COMMIT = process.argv.includes('--commit');

const OPEX_CATEGORIES = ['SALARY', 'OFFICE_RENT', 'OFFICE_SUPPLIES', 'ENTERTAINMENT', 'TRAVEL', 'RITUAL', 'MARKETING', 'TECHNOLOGY'];

function mapType(sourceType: string | null, category: string, direction: string): string {
  if (sourceType === 'FUND_TRANSFER') return 'FUND_TRANSFER';
  if (sourceType === 'FUND_ADJUSTMENT') return 'ADJUSTMENT';
  if (sourceType === 'DEPOSIT_TOPUP') return 'DEPOSIT_TOPUP';
  if (sourceType === 'OPERATING_EXPENSE') return 'OPERATING_EXPENSE';
  if (sourceType === 'LEDGER_PAYMENT') return direction === 'INFLOW' ? 'AR_COLLECTION' : 'AP_PAYMENT';
  if (category === 'TICKET_REFUND') return 'CUSTOMER_REFUND';
  if (category === 'PARTNER_FEEDBACK') return 'PARTNER_FEEDBACK';
  if (category === 'AIRLINE_PAYMENT') return 'AP_PAYMENT';
  if (category === 'TICKET_PAYMENT' && direction === 'INFLOW') return 'TICKET_SALE_RECEIPT';
  if (OPEX_CATEGORIES.includes(category)) return 'OPERATING_EXPENSE';
  return direction === 'INFLOW' ? 'OTHER_INCOME' : 'OTHER_EXPENSE';
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
  const entries = await prisma.cashFlowEntry.findMany({ orderBy: { date: 'asc' } });
  const typeCount: Record<string, number> = {};
  let upserted = 0;

  for (const e of entries) {
    const type = mapType(e.sourceType, e.category, e.direction);
    typeCount[type] = (typeCount[type] ?? 0) + 1;
    if (!COMMIT) continue;
    await prisma.financialTransaction.upsert({
      where: { dedupeKey: `cfe:${e.id}` },
      update: {},
      create: {
        dedupeKey: `cfe:${e.id}`,
        direction: e.direction as any,
        type: type as any,
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
    upserted++;
  }

  console.log(`[${COMMIT ? 'COMMIT' : 'DRY-RUN'}] cash_flow_entries=${entries.length} upserted=${upserted}`);
  console.log('Phan bo TxnType:', JSON.stringify(typeCount));

  // —— Validation ——
  const ftCount = await prisma.financialTransaction.count();
  console.log(`[CHECK#1 count] FT=${ftCount} CFE=${entries.length} -> ${ftCount === entries.length ? 'PASS' : 'FAIL'}`);

  const cfeFund = sumByFund(entries.map((e) => ({ fundAccount: e.fundAccount, direction: e.direction, amount: e.amount })));
  const ftRows = await prisma.financialTransaction.findMany({ select: { fundAccount: true, direction: true, amount: true } });
  const ftFund = sumByFund(ftRows.map((r) => ({ fundAccount: r.fundAccount, direction: r.direction, amount: r.amount })));
  let balOk = true;
  for (const f of Array.from(new Set([...Object.keys(cfeFund), ...Object.keys(ftFund)]))) {
    const ok = Math.round(cfeFund[f] ?? 0) === Math.round(ftFund[f] ?? 0);
    if (!ok) balOk = false;
    console.log(`  fund ${f}: CFE=${cfeFund[f] ?? 0} FT=${ftFund[f] ?? 0} -> ${ok ? 'PASS' : 'FAIL'}`);
  }
  console.log(`[CHECK#2 fund balances] -> ${balOk ? 'PASS' : 'FAIL'}`);

  await prisma.$disconnect();
}
main().catch((err) => { console.error(err); process.exit(1); });
