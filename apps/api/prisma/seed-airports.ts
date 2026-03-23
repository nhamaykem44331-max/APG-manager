import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

interface AirportRow {
  iata: string; icao: string; name: string;
  region: string; country: string;
  lat: number; lng: number;
}

const viNames: Record<string, string> = {
  HAN: 'Sân bay Quốc tế Nội Bài',
  SGN: 'Sân bay Quốc tế Tân Sơn Nhất',
  DAD: 'Sân bay Quốc tế Đà Nẵng',
  PQC: 'Sân bay Quốc tế Phú Quốc',
  CXR: 'Sân bay Quốc tế Cam Ranh (Nha Trang)',
  HPH: 'Sân bay Quốc tế Cát Bi (Hải Phòng)',
  VCA: 'Sân bay Quốc tế Cần Thơ',
  VCL: 'Sân bay Chu Lai (Quảng Nam)',
  VII: 'Sân bay Vinh',
  HUI: 'Sân bay Phú Bài (Huế)',
  THD: 'Sân bay Thọ Xuân (Thanh Hóa)',
  VDH: 'Sân bay Đồng Hới',
  UIH: 'Sân bay Phù Cát (Bình Định)',
  PXU: 'Sân bay Pleiku',
  BMV: 'Sân bay Buôn Ma Thuột',
  DLI: 'Sân bay Liên Khương (Đà Lạt)',
  VKG: 'Sân bay Rạch Giá',
  CAH: 'Sân bay Cà Mau',
  DIN: 'Sân bay Điện Biên Phủ',
};

async function main() {
  const prisma = new PrismaClient();

  // Resolve path from apps/api/prisma directory
  const jsonPath = path.join(__dirname, '../../../apps/web/public/airports.json');
  
  // Fallback if running from monorepo root
  const altPath = path.join(process.cwd(), 'apps/web/public/airports.json');
  const finalPath = fs.existsSync(jsonPath) ? jsonPath : altPath;

  const data: AirportRow[] = JSON.parse(fs.readFileSync(finalPath, 'utf-8'));

  console.log(`Seeding ${data.length} airports from ${finalPath}...`);

  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < data.length; i += BATCH) {
    const batch = data.slice(i, i + BATCH);
    await (prisma as any).airport.createMany({
      data: batch.map((a: AirportRow) => ({
        iata: a.iata,
        icao: a.icao || null,
        name: a.name,
        nameVi: viNames[a.iata] ?? null,
        region: a.region,
        countryCode: a.country,
        latitude: a.lat,
        longitude: a.lng,
      })),
      skipDuplicates: true,
    });
    inserted += batch.length;
    console.log(`  Processed ${Math.min(inserted, data.length)}/${data.length}...`);
  }

  console.log(`✅ Airport seed complete: ${data.length} airports`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
