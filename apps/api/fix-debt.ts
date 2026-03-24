import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const bookingId = '86bff38a-120e-4c42-9b57-00739d71e622'; // The one from the screenshot

  // 1. Delete LedgerPayments related to our AR Ledger that were triggered automagically
  const arLedgers = await prisma.accountsLedger.findMany({
    where: { bookingId, direction: 'RECEIVABLE' },
  });
  
  for (const ar of arLedgers) {
    console.log(`Resetting AR Ledger ${ar.code}`);
    await prisma.ledgerPayment.deleteMany({
      where: { ledgerId: ar.id, method: 'DEBT' } // Delete auto payments
    });
    
    // Reset the AR amounts back to 0 paid
    await prisma.accountsLedger.update({
      where: { id: ar.id },
      data: {
        paidAmount: 0,
        remaining: ar.totalAmount,
        status: 'ACTIVE'
      }
    });
  }

  // 2. We don't necessarily delete the DEBT payments from the 'payments' table 
  // because DEBT payments are how the user knows a debt was registered.
  // Actually, wait, if there are MULTIPLE DEBT payments in history, it means the user clicked it twice.
  // Let's delete ALL of them and let the user do it once from the UI properly if they want.
  
  await prisma.payment.deleteMany({
    where: { bookingId, method: 'DEBT' }
  });
  console.log(`Deleted DEBT transactions from booking ${bookingId}`);

  // 3. Delete the AR Ledger itself if we want them to re-create it by clicking "Công nợ"
  // Wait, no, we just delete the AR Ledger entirely, and the payment entirely. The user can start fresh!
  await prisma.accountsLedger.deleteMany({
    where: { bookingId, direction: 'RECEIVABLE' }
  });
  console.log(`Deleted AR Ledgers for booking ${bookingId}`);

  // 4. Update booking paymentStatus
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  const payments = await prisma.payment.findMany({ where: { bookingId } });
  const totalPaid = payments.filter(p => p.method !== 'DEBT').reduce((sum, p) => sum + Number(p.amount), 0);
  const totalSell = Number(booking?.totalSellPrice || 0);

  let paymentStatus: any = 'UNPAID';
  if (totalPaid >= totalSell && totalSell > 0) paymentStatus = 'PAID';
  else if (totalPaid > 0) paymentStatus = 'PARTIAL';

  await prisma.booking.update({
    where: { id: bookingId },
    data: { paymentStatus }
  });
  console.log(`Reset Booking ${bookingId} to paymentStatus = ${paymentStatus}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
