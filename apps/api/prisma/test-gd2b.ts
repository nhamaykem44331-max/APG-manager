// Harness kiểm thử GĐ2b (dual-write) trên TEST DB cách ly (cổng 5433). KHÔNG nhắm prod.
//   DATABASE_URL=postgresql://apg:apg_dev_2026@localhost:5433/apg_manager \
//   DIRECT_URL=postgresql://apg:apg_dev_2026@localhost:5433/apg_manager \
//   npx ts-node --transpile-only prisma/test-gd2b.ts
import { PrismaService } from '../src/common/prisma.service';
import { CashFlowService } from '../src/finance/cashflow.service';
import { FinancialLedgerService } from '../src/finance/financial-ledger.service';
import { LedgerService } from '../src/finance/ledger.service';
import { BookingsService } from '../src/bookings/bookings.service';
import { CustomersService } from '../src/customers/customers.service';
import { NamedCreditService } from '../src/bookings/named-credit.service';

const prisma = new PrismaService();
const n8n: any = {
  sendLedgerPaymentNotification: async () => undefined,
  sendDailyReport: async () => undefined,
  triggerWebhook: async () => undefined,
};
const cashflow = new CashFlowService(prisma);
const financialLedger = new FinancialLedgerService(prisma);
const ledger = new LedgerService(prisma, n8n, cashflow, financialLedger);
const customers = new CustomersService(prisma);
const namedCredit = new NamedCreditService(prisma);
const bookings = new BookingsService(prisma, n8n, customers, namedCredit, financialLedger);

const USER = 'TEST-USER';
let passN = 0;
let failN = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    passN += 1;
    console.log(`  PASS ${name}`);
  } else {
    failN += 1;
    console.log(`  FAIL ${name} ${detail}`);
  }
}

async function counts() {
  const [cfe, ft] = await Promise.all([
    prisma.cashFlowEntry.count(),
    prisma.financialTransaction.count(),
  ]);
  return { cfe, ft };
}

async function sumByFund(table: 'cfe' | 'ft') {
  const rows = table === 'cfe'
    ? await prisma.cashFlowEntry.findMany({ where: { status: 'DONE' }, select: { fundAccount: true, direction: true, amount: true } })
    : await prisma.financialTransaction.findMany({ select: { fundAccount: true, direction: true, amount: true } });
  const m: Record<string, number> = {};
  for (const r of rows) {
    if (!r.fundAccount) continue;
    m[r.fundAccount] = (m[r.fundAccount] ?? 0) + (r.direction === 'INFLOW' ? 1 : -1) * Number(r.amount);
  }
  return m;
}

async function resetMoneyTables() {
  await prisma.financialTransaction.deleteMany({});
  await prisma.ledgerPayment.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.cashFlowEntry.deleteMany({});
  await prisma.accountsLedger.deleteMany({});
  await prisma.operatingExpense.deleteMany({});
  await prisma.airlineDeposit.deleteMany({});
}

async function seedRefs() {
  await prisma.user.upsert({
    where: { id: USER },
    update: {},
    create: { id: USER, email: 'test-gd2b@apg.local', password: 'x', fullName: 'Test User', role: 'ACCOUNTANT', isActive: true },
  });
  await prisma.customer.upsert({
    where: { id: 'TEST-CUST-1' },
    update: {},
    create: { id: 'TEST-CUST-1', fullName: 'KH Test', phone: '0900000001', type: 'INDIVIDUAL', customerCode: 'TESTKH1' },
  });
  await prisma.supplierProfile.upsert({
    where: { id: 'TEST-SUP-VN' },
    update: {},
    create: { id: 'TEST-SUP-VN', code: 'VN', name: 'Vietnam Airlines (test)', type: 'AIRLINE', isActive: true },
  });
  await prisma.booking.upsert({
    where: { id: 'TEST-BK-1' },
    update: {},
    create: {
      id: 'TEST-BK-1',
      bookingCode: 'TEST-BK-0001',
      staffId: USER,
      customerId: 'TEST-CUST-1',
      supplierId: 'TEST-SUP-VN',
      contactName: 'KH Test',
      contactPhone: '0900000001',
      pnr: 'TESTPNR',
    },
  });
}

function futureDate(days = 30) {
  return new Date(Date.now() + days * 86_400_000);
}

async function makeLedger(direction: 'RECEIVABLE' | 'PAYABLE', total: number, extra: Record<string, unknown> = {}) {
  return prisma.accountsLedger.create({
    data: {
      code: `TEST-${direction}-${Math.random().toString(36).slice(2, 8)}`,
      direction,
      partyType: direction === 'RECEIVABLE' ? 'CUSTOMER_INDIVIDUAL' : 'AIRLINE',
      totalAmount: total,
      paidAmount: 0,
      remaining: total,
      issueDate: new Date(),
      dueDate: futureDate(),
      status: 'ACTIVE',
      category: 'TICKET',
      description: 'Test ledger',
      ...extra,
    } as any,
  });
}

// ─── M2: ledger.pay / payBatch ────────────────────────────────────────────
async function testLedgerPayAR() {
  console.log('\n[M2] ledger.pay — AR (thu công nợ khách)');
  const before = await counts();
  const lg = await makeLedger('RECEIVABLE', 1_000_000, { customerId: 'TEST-CUST-1', customerCode: 'TESTKH1' });
  await ledger.pay(lg.id, { amount: 400_000, method: 'CASH', fundAccount: 'CASH_OFFICE' } as any, USER);
  const after = await counts();
  check('AR: +1 CFE', after.cfe - before.cfe === 1, `Δcfe=${after.cfe - before.cfe}`);
  check('AR: +1 FT', after.ft - before.ft === 1, `Δft=${after.ft - before.ft}`);
  const ft = await prisma.financialTransaction.findFirst({ where: { ledgerId: lg.id } });
  check('AR: FT type=AR_COLLECTION', ft?.type === 'AR_COLLECTION', String(ft?.type));
  check('AR: FT direction=INFLOW', ft?.direction === 'INFLOW', String(ft?.direction));
  check('AR: FT amount=400000', Number(ft?.amount) === 400_000, String(ft?.amount));
  check('AR: FT fundAccount=CASH_OFFICE', ft?.fundAccount === 'CASH_OFFICE', String(ft?.fundAccount));
  check('AR: FT customerId set', ft?.customerId === 'TEST-CUST-1', String(ft?.customerId));
  check('AR: FT dedupeKey ledgerPayment:*', !!ft?.dedupeKey.startsWith('ledgerPayment:'), String(ft?.dedupeKey));

  // Idempotent: post lại cùng dedupeKey -> không nhân đôi
  const c1 = await counts();
  await financialLedger.post({
    type: 'AR_COLLECTION', direction: 'INFLOW', amount: 400_000, occurredAt: new Date(),
    dedupeKey: ft!.dedupeKey, fundAccount: 'CASH_OFFICE', description: 'dup', ledgerId: lg.id,
  });
  const c2 = await counts();
  check('AR: idempotent (post lại không +FT)', c2.ft - c1.ft === 0, `Δft=${c2.ft - c1.ft}`);
}

async function testLedgerPayAP() {
  console.log('\n[M2] ledger.pay — AP (trả hãng, giảm deposit)');
  await prisma.airlineDeposit.create({ data: { airline: 'VN' as any, balance: 5_000_000, lastTopUp: 0, alertThreshold: 1_000_000 } });
  const before = await counts();
  const lg = await makeLedger('PAYABLE', 2_000_000, { supplierId: 'TEST-SUP-VN' });
  await ledger.pay(lg.id, { amount: 500_000, method: 'BANK_TRANSFER', fundAccount: 'BANK_HTX' } as any, USER);
  const after = await counts();
  check('AP: +1 CFE', after.cfe - before.cfe === 1, `Δcfe=${after.cfe - before.cfe}`);
  check('AP: +1 FT', after.ft - before.ft === 1, `Δft=${after.ft - before.ft}`);
  const ft = await prisma.financialTransaction.findFirst({ where: { ledgerId: lg.id } });
  check('AP: FT type=AP_PAYMENT', ft?.type === 'AP_PAYMENT', String(ft?.type));
  check('AP: FT direction=OUTFLOW', ft?.direction === 'OUTFLOW', String(ft?.direction));
  check('AP: FT supplierId set', ft?.supplierId === 'TEST-SUP-VN', String(ft?.supplierId));
  const dep = await prisma.airlineDeposit.findFirst({ where: { airline: 'VN' as any } });
  check('AP: deposit giảm còn 4,500,000', Number(dep?.balance) === 4_500_000, String(dep?.balance));
}

async function testPayBatch() {
  console.log('\n[M2] ledger.payBatch — 2 AR cùng khách (1 CFE + 1 FT)');
  const before = await counts();
  const l1 = await makeLedger('RECEIVABLE', 300_000, { customerId: 'TEST-CUST-1', customerCode: 'TESTKH1' });
  const l2 = await makeLedger('RECEIVABLE', 700_000, { customerId: 'TEST-CUST-1', customerCode: 'TESTKH1' });
  await ledger.payBatch({ ledgerIds: [l1.id, l2.id], amount: 1_000_000, method: 'CASH', fundAccount: 'CASH_OFFICE' } as any, USER);
  const after = await counts();
  check('Batch: +1 CFE', after.cfe - before.cfe === 1, `Δcfe=${after.cfe - before.cfe}`);
  check('Batch: +1 FT', after.ft - before.ft === 1, `Δft=${after.ft - before.ft}`);
  const ft = await prisma.financialTransaction.findFirst({ where: { ledgerId: l1.id }, orderBy: { createdAt: 'desc' } });
  check('Batch: FT amount=1,000,000', Number(ft?.amount) === 1_000_000, String(ft?.amount));
}

// ─── M3: bookings.addPayment — nhánh tiền mặt ─────────────────────────────
async function testBookingCash() {
  console.log('\n[M3] bookings.addPayment — thu tiền mặt vé (TICKET_SALE_RECEIPT)');
  const before = await counts();
  await bookings.addPayment('TEST-BK-1', { amount: 850_000, method: 'CASH', fundAccount: 'CASH_OFFICE' } as any);
  const after = await counts();
  check('Booking: +1 CFE', after.cfe - before.cfe === 1, `Δcfe=${after.cfe - before.cfe}`);
  check('Booking: +1 FT', after.ft - before.ft === 1, `Δft=${after.ft - before.ft}`);
  const ft = await prisma.financialTransaction.findFirst({ where: { bookingId: 'TEST-BK-1' }, orderBy: { createdAt: 'desc' } });
  check('Booking: FT type=TICKET_SALE_RECEIPT', ft?.type === 'TICKET_SALE_RECEIPT', String(ft?.type));
  check('Booking: FT direction=INFLOW', ft?.direction === 'INFLOW', String(ft?.direction));
  check('Booking: FT amount=850000', Number(ft?.amount) === 850_000, String(ft?.amount));
  check('Booking: FT paymentId set', !!ft?.paymentId, String(ft?.paymentId));
  check('Booking: FT customerId set', ft?.customerId === 'TEST-CUST-1', String(ft?.customerId));
  check('Booking: FT dedupeKey payment:*', !!ft?.dedupeKey.startsWith('payment:'), String(ft?.dedupeKey));
  // CFE gắn nguồn để backfill suy ra cùng key
  const cfe = await prisma.cashFlowEntry.findFirst({ where: { sourceType: 'BOOKING_PAYMENT', sourceId: ft?.paymentId ?? '' } });
  check('Booking: CFE sourceType=BOOKING_PAYMENT + sourceId=paymentId', !!cfe, `cfe=${!!cfe}`);
}

async function assertInvariant() {
  console.log('\n[INVARIANT] Σ FinancialTransaction theo quỹ == Σ CashFlowEntry theo quỹ');
  const cfe = await sumByFund('cfe');
  const ft = await sumByFund('ft');
  const funds = Array.from(new Set([...Object.keys(cfe), ...Object.keys(ft)]));
  let ok = true;
  for (const f of funds) {
    const a = Math.round(cfe[f] ?? 0);
    const b = Math.round(ft[f] ?? 0);
    if (a !== b) ok = false;
    console.log(`  ${f}: CFE=${a} FT=${b} ${a === b ? 'OK' : 'MISMATCH'}`);
  }
  check('Σ theo quỹ khớp từng đồng', ok);
}

async function main() {
  await resetMoneyTables();
  await seedRefs();

  await testLedgerPayAR();
  await testLedgerPayAP();
  await testPayBatch();
  await testBookingCash();
  await assertInvariant();

  console.log(`\n==== KẾT QUẢ: ${passN} PASS / ${failN} FAIL ====`);
  await prisma.$disconnect();
  process.exit(failN === 0 ? 0 : 1);
}
main().catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });
