"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Bắt đầu seed database APG Manager...');
    const adminPassword = await bcrypt.hash('Admin@2026!', 12);
    const admin = await prisma.user.upsert({
        where: { email: 'andy@tanphuapg.com' },
        update: {},
        create: {
            email: 'andy@tanphuapg.com',
            password: adminPassword,
            fullName: 'Nguyễn Đức Điểm (Andy)',
            phone: '0912345678',
            role: client_1.UserRole.ADMIN,
        },
    });
    console.log(`✅ Admin: ${admin.email}`);
    const staffPassword = await bcrypt.hash('Staff@2026!', 12);
    const staff = await prisma.user.upsert({
        where: { email: 'sales1@tanphuapg.com' },
        update: {},
        create: {
            email: 'sales1@tanphuapg.com',
            password: staffPassword,
            fullName: 'Nguyễn Thị Hương',
            phone: '0987654321',
            role: client_1.UserRole.SALES,
        },
    });
    console.log(`✅ Nhân viên: ${staff.email}`);
    const airlines = [
        { airline: client_1.Airline.VN, balance: 450_000_000, alertThreshold: 50_000_000 },
        { airline: client_1.Airline.VJ, balance: 230_000_000, alertThreshold: 30_000_000 },
        { airline: client_1.Airline.QH, balance: 120_000_000, alertThreshold: 20_000_000 },
        { airline: client_1.Airline.BL, balance: 90_000_000, alertThreshold: 15_000_000 },
        { airline: client_1.Airline.VU, balance: 50_000_000, alertThreshold: 10_000_000 },
    ];
    for (const deposit of airlines) {
        await prisma.airlineDeposit.upsert({
            where: { id: deposit.airline },
            update: { balance: deposit.balance },
            create: {
                id: deposit.airline,
                ...deposit,
            },
        });
    }
    console.log('✅ Khởi tạo deposit các hãng bay');
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
//# sourceMappingURL=seed.js.map