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
    { airline: Airline.VN, balance: 450_000_000, alertThreshold: 50_000_000 },
    { airline: Airline.VJ, balance: 230_000_000, alertThreshold: 30_000_000 },
    { airline: Airline.QH, balance: 120_000_000, alertThreshold: 20_000_000 },
    { airline: Airline.BL, balance: 90_000_000,  alertThreshold: 15_000_000 },
    { airline: Airline.VU, balance: 50_000_000,  alertThreshold: 10_000_000 },
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
