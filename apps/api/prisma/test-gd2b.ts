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
import { FinanceService } from '../src/finance/finance.service';
import { ExpenseService } from '../src/finance/expense.service';
import { CommissionService } from '../src/finance/commission.service';
import { runBackfill } from './backfill-financial-transactions';

const prisma = new PrismaService();
const n8n: any = {
  sendLedgerPaymentNotification: async () => undefined,
  sendDailyReport: async () => undefined,
  triggerWebhook: async () => undefined,
};
const financialLedger = new FinancialLedgerService(prisma);
const cashflow = new CashFlowService(prisma, financialLedger);
const commission = new CommissionService(prisma, cashflow, financialLedger);
const ledger = new LedgerService(prisma, n8n, cashflow, financialLedger);
const customers = new CustomersService(prisma);
const namedCredit = new NamedCreditService(prisma);
const bookings = new BookingsService(prisma, n8n, customers, namedCredit, financialLedger, commission);
const finance = new FinanceService(prisma, n8n, cashflow, financialLedger);
const expense = new ExpenseService(prisma, cashflow, financialLedger);

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
  await prisma.commissionRecord.deleteMany({});
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
  await prisma.supplierProfile.upsert({
    where: { id: 'TEST-PARTNER' },
    update: {},
    create: { id: 'TEST-PARTNER', code: 'SCCM', name: 'Mr Luu SCCM (test)', type: 'PARTNER', isActive: true, feedbackRate: 10 },
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

let bkSeq = 0;
async function makeBookingWithTickets(opts: { status: string; issued: boolean; commissions: number[] }) {
  bkSeq += 1;
  const id = `TEST-BKC-${bkSeq}-${Math.random().toString(36).slice(2, 7)}`;
  const pax = await prisma.passenger.create({ data: { fullName: 'PAX Test', type: 'ADT' as any, customerId: 'TEST-CUST-1' } });
  await prisma.booking.create({
    data: {
      id,
      bookingCode: id,
      staffId: USER,
      customerId: 'TEST-CUST-1',
      supplierId: 'TEST-SUP-VN',
      contactName: 'KH Test',
      contactPhone: '0900000002',
      pnr: 'COMMPNR',
      status: opts.status as any,
      issuedAt: opts.issued ? new Date() : null,
      totalSellPrice: 1_000_000 * Math.max(1, opts.commissions.length),
      totalNetPrice: 800_000 * Math.max(1, opts.commissions.length),
    } as any,
  });
  for (let i = 0; i < opts.commissions.length; i += 1) {
    await prisma.ticket.create({
      data: {
        bookingId: id,
        passengerId: pax.id,
        airline: 'VN',
        flightNumber: `VN${100 + i}`,
        departureCode: 'SGN',
        arrivalCode: 'HAN',
        departureTime: new Date(),
        arrivalTime: new Date(Date.now() + 7_200_000),
        seatClass: 'Economy',
        sellPrice: 1_000_000,
        netPrice: 800_000,
        commission: opts.commissions[i],
        status: 'ACTIVE',
      },
    });
  }
  return id;
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

// ─── M4: deposit top-up + expense (create/update/remove) ──────────────────
async function testDeposit() {
  console.log('\n[M4] finance.updateDeposit — nạp deposit hãng (DEPOSIT_TOPUP)');
  const dep = await prisma.airlineDeposit.create({ data: { airline: 'VJ' as any, balance: 0, lastTopUp: 0, alertThreshold: 1_000_000 } });
  const before = await counts();
  await finance.updateDeposit(dep.id, { amount: 3_000_000, fundAccount: 'BANK_HTX', userId: USER });
  const after = await counts();
  check('Deposit: +1 CFE', after.cfe - before.cfe === 1, `Δcfe=${after.cfe - before.cfe}`);
  check('Deposit: +1 FT', after.ft - before.ft === 1, `Δft=${after.ft - before.ft}`);
  const ft = await prisma.financialTransaction.findFirst({ where: { type: 'DEPOSIT_TOPUP' }, orderBy: { createdAt: 'desc' } });
  check('Deposit: FT type=DEPOSIT_TOPUP', ft?.type === 'DEPOSIT_TOPUP', String(ft?.type));
  check('Deposit: FT direction=OUTFLOW', ft?.direction === 'OUTFLOW', String(ft?.direction));
  check('Deposit: FT amount=3,000,000', Number(ft?.amount) === 3_000_000, String(ft?.amount));
  check('Deposit: dedupeKey deposit-topup:*', !!ft?.dedupeKey.startsWith('deposit-topup:'), String(ft?.dedupeKey));
}

async function testExpenseLifecycle() {
  console.log('\n[M4] expense.create/update/remove — đồng bộ vòng đời');
  // create
  const c0 = await counts();
  const exp = await expense.create({ category: 'OFFICE_RENT', description: 'Thuê VP T6', amount: 5_000_000, date: new Date().toISOString(), fundAccount: 'CASH_OFFICE' } as any, USER);
  const c1 = await counts();
  check('Expense create: +1 CFE', c1.cfe - c0.cfe === 1, `Δcfe=${c1.cfe - c0.cfe}`);
  check('Expense create: +1 FT', c1.ft - c0.ft === 1, `Δft=${c1.ft - c0.ft}`);
  let ft = await prisma.financialTransaction.findFirst({ where: { expenseId: exp.id } });
  check('Expense create: FT type=OPERATING_EXPENSE', ft?.type === 'OPERATING_EXPENSE', String(ft?.type));
  check('Expense create: FT amount=5,000,000', Number(ft?.amount) === 5_000_000, String(ft?.amount));
  check('Expense create: dedupeKey expense:*', ft?.dedupeKey === `expense:${exp.id}`, String(ft?.dedupeKey));

  // update amount -> FT cập nhật theo (không nhân đôi)
  await expense.update(exp.id, { amount: 6_500_000 } as any, USER);
  const c2 = await counts();
  check('Expense update: CFE không đổi số lượng', c2.cfe === c1.cfe, `cfe=${c2.cfe}`);
  check('Expense update: FT không đổi số lượng', c2.ft === c1.ft, `ft=${c2.ft}`);
  ft = await prisma.financialTransaction.findFirst({ where: { expenseId: exp.id } });
  check('Expense update: FT amount lan sang 6,500,000', Number(ft?.amount) === 6_500_000, String(ft?.amount));

  // remove -> FT bị xóa
  await expense.remove(exp.id);
  const c3 = await counts();
  check('Expense remove: CFE giảm 1', c1.cfe - c3.cfe === 1, `Δcfe=${c1.cfe - c3.cfe}`);
  check('Expense remove: FT giảm 1', c1.ft - c3.ft === 1, `Δft=${c1.ft - c3.ft}`);
  const gone = await prisma.financialTransaction.findFirst({ where: { expenseId: exp.id } });
  check('Expense remove: FT đã biến mất', !gone, `gone=${!gone}`);
}

// ─── M5: cashflow thủ công + adjust + transfer ────────────────────────────
async function testCashflowManual() {
  console.log('\n[M5] cashflow.create/update/remove — thu thủ công (MANUAL)');
  const c0 = await counts();
  const e = await cashflow.create({ direction: 'INFLOW', category: 'OTHER', amount: 1_200_000, pic: 'NV1', description: 'Thu khác', date: new Date().toISOString(), fundAccount: 'CASH_OFFICE' } as any, USER);
  const c1 = await counts();
  check('Manual create: +1 CFE', c1.cfe - c0.cfe === 1, `Δcfe=${c1.cfe - c0.cfe}`);
  check('Manual create: +1 FT', c1.ft - c0.ft === 1, `Δft=${c1.ft - c0.ft}`);
  let ft = await prisma.financialTransaction.findFirst({ where: { dedupeKey: `cashflow:${e.id}` } });
  check('Manual create: FT key cashflow:<id>', !!ft, `ft=${!!ft}`);
  check('Manual create: FT type=OTHER_INCOME', ft?.type === 'OTHER_INCOME', String(ft?.type));
  check('Manual create: FT amount=1,200,000', Number(ft?.amount) === 1_200_000, String(ft?.amount));

  await cashflow.update(e.id, { amount: 1_500_000 } as any, USER);
  const c2 = await counts();
  check('Manual update: FT số lượng không đổi', c2.ft === c1.ft, `ft=${c2.ft}`);
  ft = await prisma.financialTransaction.findFirst({ where: { dedupeKey: `cashflow:${e.id}` } });
  check('Manual update: FT amount lan 1,500,000', Number(ft?.amount) === 1_500_000, String(ft?.amount));

  await cashflow.remove(e.id, USER);
  const c3 = await counts();
  check('Manual remove: CFE -1', c2.cfe - c3.cfe === 1, `Δcfe=${c2.cfe - c3.cfe}`);
  check('Manual remove: FT -1', c2.ft - c3.ft === 1, `Δft=${c2.ft - c3.ft}`);
}

async function testAdjust() {
  console.log('\n[M5] cashflow.adjustFundBalance — điều chỉnh số dư (ADJUSTMENT)');
  const before = await counts();
  await cashflow.adjustFundBalance({ fundAccount: 'BANK_PERSONAL', targetBalance: 2_000_000, reason: 'Khớp sao kê', pic: 'KT', date: new Date().toISOString() } as any, USER);
  const after = await counts();
  check('Adjust: +1 CFE', after.cfe - before.cfe === 1, `Δcfe=${after.cfe - before.cfe}`);
  check('Adjust: +1 FT', after.ft - before.ft === 1, `Δft=${after.ft - before.ft}`);
  const ft = await prisma.financialTransaction.findFirst({ where: { type: 'ADJUSTMENT' }, orderBy: { createdAt: 'desc' } });
  check('Adjust: FT type=ADJUSTMENT', ft?.type === 'ADJUSTMENT', String(ft?.type));
  check('Adjust: FT reason set', !!ft?.reason, String(ft?.reason));
  check('Adjust: dedupeKey adjust:*', !!ft?.dedupeKey.startsWith('adjust:'), String(ft?.dedupeKey));
}

async function testTransferLifecycle() {
  console.log('\n[M5] cashflow.transferBetweenFunds/update/remove — chuyển quỹ (2 chân)');
  const c0 = await counts();
  const trf = await cashflow.transferBetweenFunds({ fromFundAccount: 'CASH_OFFICE', toFundAccount: 'BANK_PERSONAL', amount: 500_000, pic: 'KT', date: new Date().toISOString() } as any, USER);
  const c1 = await counts();
  check('Transfer: +2 CFE', c1.cfe - c0.cfe === 2, `Δcfe=${c1.cfe - c0.cfe}`);
  check('Transfer: +2 FT', c1.ft - c0.ft === 2, `Δft=${c1.ft - c0.ft}`);
  const out = await prisma.financialTransaction.findFirst({ where: { dedupeKey: `transferLeg:${trf.transferGroupId}:OUT` } });
  const inn = await prisma.financialTransaction.findFirst({ where: { dedupeKey: `transferLeg:${trf.transferGroupId}:IN` } });
  check('Transfer: OUT leg type=FUND_TRANSFER/OUTFLOW', out?.type === 'FUND_TRANSFER' && out?.direction === 'OUTFLOW', `${out?.type}/${out?.direction}`);
  check('Transfer: IN leg INFLOW + counterparty', inn?.direction === 'INFLOW' && inn?.counterpartyFundAccount === 'CASH_OFFICE', `${inn?.direction}/${inn?.counterpartyFundAccount}`);

  await cashflow.updateFundTransfer(trf.outflow.id, { fromFundAccount: 'CASH_OFFICE', toFundAccount: 'BANK_PERSONAL', amount: 700_000, pic: 'KT', date: new Date().toISOString() } as any, USER);
  const c2 = await counts();
  check('Transfer update: FT số lượng không đổi (2)', c2.ft === c1.ft, `ft=${c2.ft}`);
  const out2 = await prisma.financialTransaction.findFirst({ where: { dedupeKey: `transferLeg:${trf.transferGroupId}:OUT` } });
  check('Transfer update: OUT amount lan 700,000', Number(out2?.amount) === 700_000, String(out2?.amount));

  await cashflow.remove(trf.outflow.id, USER);
  const c3 = await counts();
  check('Transfer remove: CFE -2', c2.cfe - c3.cfe === 2, `Δcfe=${c2.cfe - c3.cfe}`);
  check('Transfer remove: FT -2', c2.ft - c3.ft === 2, `Δft=${c2.ft - c3.ft}`);
}

// ─── GĐ3a M2: dồn tích hoa hồng nhận từ hãng ──────────────────────────────
async function testCommissionAccrual() {
  console.log('\n[GĐ3a-M2] CommissionService.accrue — dồn tích hoa hồng hãng (trực tiếp)');
  const bk = await makeBookingWithTickets({ status: 'ISSUED', issued: true, commissions: [50_000, 30_000] });
  const before = await counts();
  await commission.accrueAirlineIncomeForBooking(bk, USER);
  const after = await counts();
  const rec = await prisma.commissionRecord.findUnique({ where: { dedupeKey: `commAccrual:${bk}` } });
  check('Accrual: tạo CommissionRecord', !!rec, `rec=${!!rec}`);
  check('Accrual: kind=AIRLINE_INCOME', rec?.kind === 'AIRLINE_INCOME', String(rec?.kind));
  check('Accrual: status=ACCRUED', rec?.status === 'ACCRUED', String(rec?.status));
  check('Accrual: amount=Σcommission=80,000', Number(rec?.amount) === 80_000, String(rec?.amount));
  check('Accrual: KHÔNG tạo FT (chưa phải cash)', after.ft === before.ft, `Δft=${after.ft - before.ft}`);
  check('Accrual: KHÔNG tạo CFE', after.cfe === before.cfe, `Δcfe=${after.cfe - before.cfe}`);

  // Idempotent: gọi lại không nhân đôi
  await commission.accrueAirlineIncomeForBooking(bk, USER);
  const recs = await prisma.commissionRecord.count({ where: { dedupeKey: `commAccrual:${bk}` } });
  check('Accrual: idempotent (vẫn 1 record)', recs === 1, `count=${recs}`);

  // Vé sửa commission về 0 -> gỡ bản dồn tích
  await prisma.ticket.updateMany({ where: { bookingId: bk }, data: { commission: 0 } });
  await commission.accrueAirlineIncomeForBooking(bk, USER);
  const gone = await prisma.commissionRecord.findUnique({ where: { dedupeKey: `commAccrual:${bk}` } });
  check('Accrual: commission=0 -> gỡ record', !gone, `gone=${!gone}`);
}

async function testCommissionAccrualHook() {
  console.log('\n[GĐ3a-M2] hook updateStatus→ISSUED tự dồn tích hoa hồng');
  const bk = await makeBookingWithTickets({ status: 'PENDING_PAYMENT', issued: false, commissions: [40_000, 20_000] });
  await bookings.updateStatus(bk, { toStatus: 'ISSUED' } as any, USER);
  const rec = await prisma.commissionRecord.findUnique({ where: { dedupeKey: `commAccrual:${bk}` } });
  check('Hook: CommissionRecord tạo qua updateStatus', !!rec, `rec=${!!rec}`);
  check('Hook: amount=60,000', Number(rec?.amount) === 60_000, String(rec?.amount));
  check('Hook: kind=AIRLINE_INCOME/ACCRUED', rec?.kind === 'AIRLINE_INCOME' && rec?.status === 'ACCRUED', `${rec?.kind}/${rec?.status}`);
}

// ─── GĐ3a M3: trả hoa hồng đối tác (nhập tay, chạm tiền) ───────────────────
async function testPayPartner() {
  console.log('\n[GĐ3a-M3] CommissionService.payPartner — trả đối tác (PARTNER_FEEDBACK)');
  const before = await counts();
  const sumBefore = await cashflow.getSummary();
  const res = await commission.payPartner({ partnerId: 'TEST-PARTNER', amount: 1_000_000, fundAccount: 'CASH_OFFICE', userId: USER });
  const after = await counts();
  check('PayPartner: +1 CFE', after.cfe - before.cfe === 1, `Δcfe=${after.cfe - before.cfe}`);
  check('PayPartner: +1 FT', after.ft - before.ft === 1, `Δft=${after.ft - before.ft}`);
  check('PayPartner: FT type=PARTNER_FEEDBACK/OUTFLOW', res.financialTransaction.type === 'PARTNER_FEEDBACK' && res.financialTransaction.direction === 'OUTFLOW', `${res.financialTransaction.type}/${res.financialTransaction.direction}`);
  check('PayPartner: FT supplierId=đối tác', res.financialTransaction.supplierId === 'TEST-PARTNER', String(res.financialTransaction.supplierId));
  check('PayPartner: CommissionRecord PARTNER_PAYOUT/SETTLED', res.commission.kind === 'PARTNER_PAYOUT' && res.commission.status === 'SETTLED', `${res.commission.kind}/${res.commission.status}`);
  check('PayPartner: record link FT', res.commission.financialTransactionId === res.financialTransaction.id, String(res.commission.financialTransactionId));
  // PARTNER_FEEDBACK là chi phí thực -> vào gross outflow
  const sumAfter = await cashflow.getSummary();
  check('PayPartner: getSummary.outflow +1,000,000', Math.round(sumAfter.totalOutflow - sumBefore.totalOutflow) === 1_000_000, `Δout=${sumAfter.totalOutflow - sumBefore.totalOutflow}`);
}

// ─── M6: backfill source-keyed — chống đếm trùng + idempotent ─────────────
async function testBackfillIdempotent() {
  console.log('\n[M6] backfill source-keyed — chống đếm trùng + idempotent');
  const n0 = await counts();
  // CFE "cũ" mô phỏng trước cutover: thu tiền mặt KHÔNG gắn nguồn, chưa có FT.
  await prisma.cashFlowEntry.create({
    data: {
      direction: 'INFLOW', category: 'TICKET_PAYMENT', amount: 333_000, pic: 'Legacy',
      description: 'Legacy cash receipt', date: new Date(), status: 'DONE', fundAccount: 'CASH_OFFICE',
    },
  });
  const n1 = await counts();
  check('Backfill: +1 CFE legacy (chưa có FT)', n1.cfe - n0.cfe === 1 && n1.ft === n0.ft, `cfe+${n1.cfe - n0.cfe} ft+${n1.ft - n0.ft}`);

  const r1 = await runBackfill(prisma, { commit: true });
  const n2 = await counts();
  check('Backfill lần 1: chỉ +1 FT cho legacy (dual-write no-op)', n2.ft - n1.ft === 1, `Δft=${n2.ft - n1.ft} upserted=${r1.upserted}`);

  await runBackfill(prisma, { commit: true });
  const n3 = await counts();
  check('Backfill lần 2: idempotent, FT không đổi', n3.ft === n2.ft, `ft=${n3.ft}`);
  check('Backfill: FT count == CFE(DONE) count', n3.ft === n3.cfe, `ft=${n3.ft} cfe=${n3.cfe}`);
}

// ─── M7: reads tổng hợp đọc từ FT, khớp số tính độc lập từ CFE ─────────────
async function testReadsMatch() {
  console.log('\n[M7] reads tổng hợp (FT) khớp số liệu tính từ CFE');

  // 1) getFundBalances
  const fb = await cashflow.getFundBalances();
  const cfeRows = await prisma.cashFlowEntry.findMany({ where: { status: 'DONE', fundAccount: { not: null } }, select: { fundAccount: true, direction: true, amount: true } });
  const expBal: Record<string, number> = {};
  for (const r of cfeRows) expBal[r.fundAccount!] = (expBal[r.fundAccount!] ?? 0) + (r.direction === 'INFLOW' ? 1 : -1) * Number(r.amount);
  let balOk = true;
  for (const f of fb) if (Math.round(f.balance) !== Math.round(expBal[f.fund] ?? 0)) balOk = false;
  check('getFundBalances (FT) == số dư tính từ CFE', balOk, JSON.stringify(fb.map((f) => [f.fund, f.balance])));

  // 2) getSummary — loại FUND_TRANSFER + ADJUSTMENT (giữ bút toán sourceType=null)
  const sum = await cashflow.getSummary();
  const pnlRows = await prisma.cashFlowEntry.findMany({
    where: { status: 'DONE', OR: [{ sourceType: null }, { sourceType: { notIn: ['FUND_TRANSFER', 'FUND_ADJUSTMENT'] } }] },
    select: { direction: true, amount: true },
  });
  let ein = 0; let eout = 0;
  for (const r of pnlRows) { if (r.direction === 'INFLOW') ein += Number(r.amount); else eout += Number(r.amount); }
  check('getSummary.totalInflow khớp', Math.round(sum.totalInflow) === Math.round(ein), `FT=${sum.totalInflow} CFE=${ein}`);
  check('getSummary.totalOutflow khớp', Math.round(sum.totalOutflow) === Math.round(eout), `FT=${sum.totalOutflow} CFE=${eout}`);

  // 3) getMonthlyReport năm hiện tại — tổng cả năm khớp gross
  const year = new Date().getFullYear();
  const monthly = await cashflow.getMonthlyReport(year);
  const sumIn = monthly.reduce((s: number, m: any) => s + m.inflow, 0);
  const sumOut = monthly.reduce((s: number, m: any) => s + m.outflow, 0);
  check('getMonthlyReport Σ inflow == getSummary inflow', Math.round(sumIn) === Math.round(sum.totalInflow), `${sumIn} vs ${sum.totalInflow}`);
  check('getMonthlyReport Σ outflow == getSummary outflow', Math.round(sumOut) === Math.round(sum.totalOutflow), `${sumOut} vs ${sum.totalOutflow}`);

  // 4) ADJUSTMENT bị loại khỏi gross nhưng vẫn vào số dư quỹ
  const adj = await prisma.financialTransaction.aggregate({ where: { type: 'ADJUSTMENT' }, _sum: { amount: true } });
  const adjAmt = Number(adj._sum.amount ?? 0);
  check('ADJUSTMENT tồn tại để kiểm (test có điều chỉnh)', adjAmt > 0, `adj=${adjAmt}`);
  const personal = fb.find((f) => f.fund === 'BANK_PERSONAL');
  check('Số dư BANK_PERSONAL gồm cả ADJUSTMENT', Math.round(personal?.balance ?? 0) === Math.round(expBal['BANK_PERSONAL'] ?? 0), String(personal?.balance));
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
  await testDeposit();
  await testExpenseLifecycle();
  await testCashflowManual();
  await testAdjust();
  await testTransferLifecycle();
  await testCommissionAccrual();
  await testCommissionAccrualHook();
  await testPayPartner();
  await testBackfillIdempotent();
  await testReadsMatch();
  await assertInvariant();

  console.log(`\n==== KẾT QUẢ: ${passN} PASS / ${failN} FAIL ====`);
  await prisma.$disconnect();
  process.exit(failN === 0 ? 0 : 1);
}
main().catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });
