// Harness regression: bug getPrimaryTicketLedgerWhere — filter { category: null } trên cột
// non-null (ledger_category) khiến Prisma 5.22 ném PrismaClientValidationError, nuốt trong
// try/catch của updateStatus → AR/AP KHÔNG được tạo khi xuất vé.
// Chạy trên TEST DB cách ly cổng 5433 (Postgres 17). KHÔNG nhắm prod.
//   DATABASE_URL=postgresql://apg:apg_dev_2026@localhost:5433/apg_manager \
//   DIRECT_URL=postgresql://apg:apg_dev_2026@localhost:5433/apg_manager \
//   npx ts-node --transpile-only prisma/test-ledger-category.ts
import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/common/prisma.service';
import { CashFlowService } from '../src/finance/cashflow.service';
import { FinancialLedgerService } from '../src/finance/financial-ledger.service';
import { CommissionService } from '../src/finance/commission.service';
import { CustomersService } from '../src/customers/customers.service';
import { NamedCreditService } from '../src/bookings/named-credit.service';
import { BookingsService } from '../src/bookings/bookings.service';

// ─── Guard tự vệ: chỉ cho chạy trên DB test cục bộ cổng 5433 ──────────────────
const DB_URL = process.env.DATABASE_URL ?? '';
if (!/(localhost|127\.0\.0\.1):5433\b/.test(DB_URL)) {
  console.error(
    'TỪ CHỐI CHẠY: DATABASE_URL phải trỏ DB test cổng 5433 (DB cách ly), không phải prod.\n' +
      '  Hiện tại: ' + (DB_URL ? DB_URL.replace(/:[^:@/]*@/, ':***@') : '(trống)'),
  );
  process.exit(2);
}

const prisma = new PrismaService();
const n8n: any = {
  sendLedgerPaymentNotification: async () => undefined,
  sendDailyReport: async () => undefined,
  triggerWebhook: async () => undefined,
};
const financialLedger = new FinancialLedgerService(prisma);
const cashflow = new CashFlowService(prisma, financialLedger);
const commission = new CommissionService(prisma, cashflow, financialLedger);
const customers = new CustomersService(prisma);
const namedCredit = new NamedCreditService(prisma);
const bookings = new BookingsService(prisma, n8n, customers, namedCredit, financialLedger, commission);

const USER = 'TEST-LCFIX-USER';
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

async function seedRefs() {
  await prisma.user.upsert({
    where: { id: USER },
    update: {},
    create: { id: USER, email: 'test-lcfix@apg.local', password: 'x', fullName: 'LCFix User', role: 'ACCOUNTANT', isActive: true },
  });
  await prisma.customer.upsert({
    where: { id: 'TEST-LCFIX-CUST' },
    update: {},
    create: { id: 'TEST-LCFIX-CUST', fullName: 'KH LCFix', phone: '0900777001', type: 'INDIVIDUAL', customerCode: 'LCFIXKH' },
  });
  await prisma.supplierProfile.upsert({
    where: { id: 'TEST-LCFIX-SUP' },
    update: {},
    create: { id: 'TEST-LCFIX-SUP', code: 'LCFIX-VN', name: 'VNA (lcfix test)', type: 'AIRLINE', isActive: true, paymentTerms: 15 },
  });
}

let bkSeq = 0;
async function makeIssuableBooking(sell: number, net: number) {
  bkSeq += 1;
  const id = `TEST-LCFIX-BK-${bkSeq}-${Math.random().toString(36).slice(2, 7)}`;
  const pax = await prisma.passenger.create({
    data: { fullName: 'PAX LCFix', type: 'ADT' as any, customerId: 'TEST-LCFIX-CUST' },
  });
  await prisma.booking.create({
    data: {
      id,
      bookingCode: id,
      staffId: USER,
      customerId: 'TEST-LCFIX-CUST',
      supplierId: 'TEST-LCFIX-SUP',
      contactName: 'KH LCFix',
      contactPhone: '0900777001',
      pnr: 'LCFIXPNR',
      status: 'PENDING_PAYMENT' as any,
      paymentStatus: 'UNPAID' as any,
      totalSellPrice: sell,
      totalNetPrice: net,
    } as any,
  });
  await prisma.ticket.create({
    data: {
      bookingId: id,
      passengerId: pax.id,
      airline: 'VN',
      flightNumber: 'VN123',
      departureCode: 'SGN',
      arrivalCode: 'HAN',
      departureTime: new Date(),
      arrivalTime: new Date(Date.now() + 7_200_000),
      seatClass: 'Economy',
      sellPrice: sell,
      netPrice: net,
      commission: 0,
      status: 'ACTIVE',
    },
  });
  return id;
}

// ─── RC: chứng minh nguyên nhân gốc — filter { category: null } trên cột non-null ném lỗi ───
async function testRootCauseFilterThrows() {
  console.log('\n[RC] Nguyên nhân gốc: { category: null } trên cột non-null → PrismaClientValidationError');
  let threwOnNull = false;
  let errName = '';
  try {
    await prisma.accountsLedger.findFirst({
      where: { direction: 'PAYABLE', OR: [{ category: 'TICKET' }, { category: null }] } as Prisma.AccountsLedgerWhereInput,
    });
  } catch (e: any) {
    threwOnNull = true;
    errName = e?.constructor?.name ?? '';
  }
  check('Filter { category: null } NÉM lỗi (đây là root cause của helper cũ)', threwOnNull, `name=${errName}`);

  // Đối chứng: filter chỉ { category: 'TICKET' } (helper sau khi sửa) KHÔNG ném lỗi.
  let okOnTicket = true;
  try {
    await prisma.accountsLedger.findFirst({
      where: { direction: 'PAYABLE', category: 'TICKET' },
    });
  } catch {
    okOnTicket = false;
  }
  check('Filter { category: "TICKET" } chạy bình thường (hướng sửa)', okOnTicket);
}

// ─── REG: updateStatus → ISSUED tạo đúng AR (phải thu) + AP (phải trả) ────────
async function testIssueCreatesArAp() {
  console.log('\n[REG] updateStatus→ISSUED tạo đúng AR + AP qua helper getPrimaryTicketLedgerWhere');
  const sell = 1_000_000;
  const net = 800_000;
  const bk = await makeIssuableBooking(sell, net);

  await bookings.updateStatus(bk, { toStatus: 'ISSUED' } as any, USER);

  const ars = await prisma.accountsLedger.findMany({ where: { bookingId: bk, direction: 'RECEIVABLE' } });
  const aps = await prisma.accountsLedger.findMany({ where: { bookingId: bk, direction: 'PAYABLE' } });
  const ar = ars[0];
  const ap = aps[0];

  check('AR: tạo đúng 1 bản (phải thu khách)', ars.length === 1, `count=${ars.length}`);
  check('AR: totalAmount = totalSellPrice (1,000,000)', Number(ar?.totalAmount) === sell, String(ar?.totalAmount));
  check('AR: category = TICKET', ar?.category === 'TICKET', String(ar?.category));
  check('AR: remaining = 1,000,000 (chưa thu)', Number(ar?.remaining) === sell, String(ar?.remaining));
  check('AR: customerId gắn đúng', ar?.customerId === 'TEST-LCFIX-CUST', String(ar?.customerId));

  check('AP: tạo đúng 1 bản (phải trả NCC)', aps.length === 1, `count=${aps.length}`);
  check('AP: totalAmount = totalNetPrice (800,000)', Number(ap?.totalAmount) === net, String(ap?.totalAmount));
  check('AP: category = TICKET', ap?.category === 'TICKET', String(ap?.category));
  check('AP: supplierId gắn đúng', ap?.supplierId === 'TEST-LCFIX-SUP', String(ap?.supplierId));
}

async function main() {
  await seedRefs();

  await testRootCauseFilterThrows();
  await testIssueCreatesArAp();

  console.log(`\n==== KẾT QUẢ: ${passN} PASS / ${failN} FAIL ====`);
  await prisma.$disconnect();
  process.exit(failN === 0 ? 0 : 1);
}
main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
