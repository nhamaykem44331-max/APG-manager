// Harness: Item 1 (gắn đối tác giới thiệu cho khách + validate loại) + Item 2 (partnerSummary).
// CHẠY TRÊN DB DÙNG-MỘT-LẦN (vd apg_hh_test), KHÔNG phải DB review apg_manager.
//   DATABASE_URL=postgresql://apg:apg_dev_2026@localhost:5433/apg_hh_test \
//   DIRECT_URL=postgresql://apg:apg_dev_2026@localhost:5433/apg_hh_test \
//   npx ts-node --transpile-only prisma/test-referral-partner.ts
import { PrismaService } from '../src/common/prisma.service';
import { CashFlowService } from '../src/finance/cashflow.service';
import { FinancialLedgerService } from '../src/finance/financial-ledger.service';
import { CommissionService } from '../src/finance/commission.service';
import { CustomersService, CreateCustomerDto } from '../src/customers/customers.service';

const DB_URL = process.env.DATABASE_URL ?? '';
if (!/(localhost|127\.0\.0\.1):5433\b/.test(DB_URL)) {
  console.error('TỪ CHỐI: cần DB test cổng 5433. Hiện: ' + (DB_URL ? DB_URL.replace(/:[^:@/]*@/, ':***@') : '(trống)'));
  process.exit(2);
}
// Chặn chạy nhầm trên DB review (apg_manager) — test này chạm tiền (payPartner).
if (/\/apg_manager(\?|$)/.test(DB_URL)) {
  console.error('TỪ CHỐI: KHÔNG chạy test chạm tiền trên DB review apg_manager. Dùng DB dùng-một-lần (vd apg_hh_test).');
  process.exit(2);
}

const prisma = new PrismaService();
const financialLedger = new FinancialLedgerService(prisma);
const cashflow = new CashFlowService(prisma, financialLedger);
const commission = new CommissionService(prisma, cashflow, financialLedger);
const customers = new CustomersService(prisma);

let passN = 0;
let failN = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { passN += 1; console.log(`  PASS ${name}`); }
  else { failN += 1; console.log(`  FAIL ${name} ${detail}`); }
}

async function main() {
  // ── Seed: 1 user (staffId), 1 đối tác PARTNER, 1 hãng AIRLINE (để test validate) ──
  const user = await prisma.user.create({
    data: { email: 'hhtest@apg.local', password: 'x', fullName: 'HH Test', role: 'ACCOUNTANT', isActive: true },
  });
  const partner = await prisma.supplierProfile.create({
    data: { code: 'PTEST', name: 'Đối tác Test', type: 'PARTNER', isActive: true },
  });
  const airline = await prisma.supplierProfile.create({
    data: { code: 'ATEST', name: 'Hãng Test', type: 'AIRLINE', isActive: true },
  });

  console.log('\n[Item 1] Gắn đối tác giới thiệu + validate loại');
  // 1) Tạo khách gắn đối tác giới thiệu (PARTNER) — phải OK
  const cust: any = await customers.create({
    fullName: 'KH Đầu mối', phone: '0900111222', referredByPartnerId: partner.id,
  } as CreateCustomerDto);
  check('Tạo khách với referredByPartnerId (PARTNER) OK', cust.referredByPartnerId === partner.id, String(cust.referredByPartnerId));

  // findOne include referredByPartner
  const fetched: any = await customers.findOne(cust.id);
  check('findOne trả referredByPartner đúng', fetched.referredByPartner?.id === partner.id, JSON.stringify(fetched.referredByPartner));

  // 2) Validate: gán đối tác là HÃNG (không phải PARTNER) -> phải NÉM lỗi
  let threwCreate = false;
  try {
    await customers.create({ fullName: 'KH Sai', phone: '0900111333', referredByPartnerId: airline.id } as CreateCustomerDto);
  } catch { threwCreate = true; }
  check('Tạo khách gán đối tác sai loại (AIRLINE) bị chặn', threwCreate);

  let threwUpdate = false;
  try {
    await customers.update(cust.id, { referredByPartnerId: airline.id });
  } catch { threwUpdate = true; }
  check('Update khách gán đối tác sai loại bị chặn', threwUpdate);

  // Gỡ gắn (disconnect) rồi gắn lại — đảm bảo update path chạy
  const undone: any = await customers.update(cust.id, { referredByPartnerId: '' });
  check('Update gỡ đối tác (rỗng -> null) OK', undone.referredByPartnerId === null, String(undone.referredByPartnerId));
  await customers.update(cust.id, { referredByPartnerId: partner.id });

  console.log('\n[Item 2] partnerSummary');
  // 3) Booking ISSUED cho khách -> partnerSummary cộng doanh số + lãi
  const SELL = 10_000_000;
  const PROFIT = 1_500_000;
  await prisma.booking.create({
    data: {
      bookingCode: 'BK-HHTEST-1', staffId: user.id, customerId: cust.id, supplierId: airline.id,
      contactName: 'KH Đầu mối', contactPhone: '0900111222', pnr: 'PNRX',
      status: 'ISSUED' as any, paymentStatus: 'UNPAID' as any,
      totalSellPrice: SELL, totalNetPrice: 8_000_000, profit: PROFIT,
    } as any,
  });

  const sum1: any = await commission.partnerSummary(partner.id);
  check('customerCount = 1', sum1.totals.customerCount === 1, String(sum1.totals.customerCount));
  check('bookingCount = 1', sum1.totals.bookingCount === 1, String(sum1.totals.bookingCount));
  check('revenue = 10,000,000', sum1.totals.revenue === SELL, String(sum1.totals.revenue));
  check('profit = 1,500,000', sum1.totals.profit === PROFIT, String(sum1.totals.profit));
  check('paidFeedback = 0 (chưa trả)', sum1.totals.paidFeedback === 0, String(sum1.totals.paidFeedback));
  check('customers[0] đúng khách + số liệu', sum1.customers[0]?.id === cust.id && sum1.customers[0]?.revenue === SELL, JSON.stringify(sum1.customers[0]));

  // 4) Trả feedback 500k -> paidFeedback cập nhật, doanh số/lãi giữ nguyên
  await commission.payPartner({ partnerId: partner.id, amount: 500_000, fundAccount: 'CASH_OFFICE' as any });
  const sum2: any = await commission.partnerSummary(partner.id);
  check('sau trả: paidFeedback = 500,000', sum2.totals.paidFeedback === 500_000, String(sum2.totals.paidFeedback));
  check('sau trả: có >=1 payout trong lịch sử', sum2.payouts.length >= 1, String(sum2.payouts.length));
  check('sau trả: doanh số/lãi giữ nguyên', sum2.totals.revenue === SELL && sum2.totals.profit === PROFIT);

  console.log(`\n==== KẾT QUẢ: ${passN} PASS / ${failN} FAIL ====`);
  await prisma.$disconnect();
  process.exit(failN === 0 ? 0 : 1);
}
main().catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });
