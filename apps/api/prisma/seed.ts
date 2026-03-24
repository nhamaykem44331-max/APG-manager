// APG Manager RMS - Seed Database (tạo dữ liệu mẫu ban đầu)
import { PrismaClient, UserRole, Airline } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu seed database APG Manager...');

  // Tạo tài khoản Admin (Andy)
  const adminPassword = await bcrypt.hash('Admin@2026!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'andy@tanphuapg.com' },
    update: {},
    create: {
      email: 'andy@tanphuapg.com',
      password: adminPassword,
      fullName: 'Nguyễn Đức Điểm (Andy)',
      phone: '0912345678',
      role: UserRole.ADMIN,
    },
  });
  console.log(`✅ Admin: ${admin.email}`);

  // Tạo tài khoản nhân viên mẫu
  const staffPassword = await bcrypt.hash('Staff@2026!', 12);
  const staff = await prisma.user.upsert({
    where: { email: 'sales1@tanphuapg.com' },
    update: {},
    create: {
      email: 'sales1@tanphuapg.com',
      password: staffPassword,
      fullName: 'Nguyễn Thị Hương',
      phone: '0987654321',
      role: UserRole.SALES,
    },
  });
  console.log(`✅ Nhân viên: ${staff.email}`);

  // Tạo deposit ban đầu cho các hãng bay
  const airlines = [
    { airline: 'VN', balance: 450_000_000, alertThreshold: 50_000_000 },
    { airline: 'VJ', balance: 230_000_000, alertThreshold: 30_000_000 },
    { airline: 'QH', balance: 120_000_000, alertThreshold: 20_000_000 },
    { airline: 'BL', balance: 90_000_000,  alertThreshold: 15_000_000 },
    { airline: 'VU', balance: 50_000_000,  alertThreshold: 10_000_000 },
  ];

  for (const deposit of airlines) {
    // Dùng airline field làm unique key để tránh dùng airline code như UUID
    const existing = await prisma.airlineDeposit.findFirst({
      where: { airline: deposit.airline },
    });
    if (existing) {
      await prisma.airlineDeposit.update({
        where: { id: existing.id },
        data: { balance: deposit.balance, alertThreshold: deposit.alertThreshold },
      });
    } else {
      await prisma.airlineDeposit.create({ data: deposit });
    }
  }
  console.log('✅ Khởi tạo deposit các hãng bay');

  // Tạo khách hàng mẫu
  const customer = await prisma.customer.upsert({
    where: { phone: '0901234567' },
    update: {},
    create: {
      fullName: 'Trần Văn Minh',
      phone: '0901234567',
      email: 'minh.tran@example.com',
      type: 'INDIVIDUAL',
      tags: ['VIP', 'thường_bay_HAN'],
    },
  });
  console.log(`✅ Khách hàng mẫu: ${customer.fullName}`);

  // ── Bước 1g: Seed Supplier Profiles (hãng bay + GDS) ──────────────
  // Tài liệu APG_Debt_Upgrade_Prompt_1.md - Bước 1g
  const suppliers = [
    { code: 'VN', name: 'Vietnam Airlines',       type: 'AIRLINE'       as const, paymentTerms: 15 },
    { code: 'VJ', name: 'Vietjet Air',             type: 'AIRLINE'       as const, paymentTerms: 15 },
    { code: 'QH', name: 'Bamboo Airways',          type: 'AIRLINE'       as const, paymentTerms: 15 },
    { code: 'BL', name: 'Pacific Airlines',        type: 'AIRLINE'       as const, paymentTerms: 30 },
    { code: 'VU', name: 'Vietravel Airlines',      type: 'AIRLINE'       as const, paymentTerms: 15 },
    { code: 'AMADEUS', name: 'Amadeus GDS',        type: 'GDS_PROVIDER'  as const, paymentTerms: 30 },
    { code: 'SCCM', name: 'SCCM Group',            type: 'PARTNER'       as const, paymentTerms: 30 },
  ];
  for (const s of suppliers) {
    await prisma.supplierProfile.upsert({
      where: { code: s.code },
      update: {},
      create: s,
    });
  }
  console.log('✅ Nhà cung cấp mẫu (suppliers)');

  console.log('\n🎉 Seed hoàn tất!');
  console.log('📧 Admin login: andy@tanphuapg.com / Admin@2026!');
  console.log('📧 Staff login: sales1@tanphuapg.com / Staff@2026!');
}

main()
  .catch((e) => {
    console.error('❌ Seed thất bại:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
