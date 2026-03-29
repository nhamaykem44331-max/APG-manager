# APG Manager RMS

**Hệ thống quản lý đại lý vé máy bay** cho Tân Phú APG  
Revenue Management System · Next.js 14 + NestJS 10 + PostgreSQL 16

---

## 🚀 Khởi động nhanh

### Yêu cầu
- Node.js >= 20.x
- Docker (cho PostgreSQL local)
- npm >= 10.x

### 1. Clone và cài đặt

```bash
git clone https://github.com/tanphuapg/apg-manager.git
cd apg-manager
npm install
```

### 2. Cấu hình môi trường

```bash
# Backend
cp apps/api/.env.example apps/api/.env
# Chỉnh sửa DATABASE_URL, JWT_SECRET, ...

# Frontend
cp apps/web/.env.example apps/web/.env.local
# Chỉnh sửa NEXTAUTH_SECRET
```

### 3. Khởi động PostgreSQL

```bash
docker compose up -d
# PostgreSQL chạy tại localhost:5432
# pgAdmin: http://localhost:5050
```

### 4. Migrate và seed database

```bash
cd apps/api
npx prisma migrate dev --name init
npx prisma db seed
# Tài khoản admin: andy@tanphuapg.com / Admin@2026!
```

### 5. Chạy development

```bash
# Từ thư mục root (chạy cả web + api)
npm run dev

# Hoặc từng app riêng:
cd apps/api && npm run dev   # API: http://localhost:3001
cd apps/web && npm run dev   # Web: http://localhost:3000
```

---

## Deployment Safety

Before changing dependencies, Prisma, auth, Render, Vercel, or shared types, read:

- `docs/deployment-guardrails.md`

Short version:

- This repo is an npm workspace monorepo
- The root `package-lock.json` is the only authoritative lockfile
- Prisma schema changes must include a migration
- Render API deploy and Vercel web deploy are separate and must both be verified when relevant

---

## 📁 Cấu trúc dự án

```
apg-manager/
├── apps/
│   ├── web/                    # Next.js 14 Frontend
│   │   ├── app/
│   │   │   ├── auth/login/     # Trang đăng nhập
│   │   │   ├── dashboard/      # Dashboard chính
│   │   │   ├── bookings/       # Quản lý booking
│   │   │   ├── customers/      # CRM khách hàng
│   │   │   ├── finance/        # Tài chính
│   │   │   ├── flights/        # Tra cứu giá vé
│   │   │   └── reports/        # Báo cáo
│   │   ├── components/
│   │   │   ├── layout/         # Sidebar, Header, ThemeProvider
│   │   │   └── charts/         # KPI Card, Revenue Chart, Airline Chart
│   │   ├── lib/                # API client, utils
│   │   ├── stores/             # Zustand stores
│   │   └── types/              # TypeScript types
│   │
│   └── api/                    # NestJS Backend
│       ├── src/
│       │   ├── auth/           # JWT Authentication
│       │   ├── bookings/       # Booking module
│       │   ├── customers/      # Customer CRM
│       │   ├── finance/        # Finance & reconciliation
│       │   ├── flights/        # AbayEngine integration
│       │   ├── reports/        # Analytics
│       │   ├── automation/     # n8n webhooks
│       │   └── common/         # Guards, decorators
│       └── prisma/
│           ├── schema.prisma   # Database schema
│           └── seed.ts         # Dữ liệu mẫu
│
├── docker-compose.yml          # PostgreSQL + pgAdmin
└── turbo.json                  # Turborepo config
```

---

## 🔐 Phân quyền (RBAC)

| Role | Quyền |
|------|-------|
| **ADMIN** | Toàn quyền (Andy) |
| **MANAGER** | Xem báo cáo, duyệt booking, quản lý nhân viên |
| **SALES** | Tạo/sửa booking, CRM khách hàng |
| **ACCOUNTANT** | Tài chính, đối soát, công nợ |

---

## 🌐 API Endpoints chính

```
POST   /api/v1/auth/login
GET    /api/v1/auth/me

GET    /api/v1/bookings
POST   /api/v1/bookings
PATCH  /api/v1/bookings/:id/status

GET    /api/v1/customers
POST   /api/v1/customers

GET    /api/v1/finance/dashboard
GET    /api/v1/finance/deposits
POST   /api/v1/finance/reconciliation/run

GET    /api/v1/reports/daily
GET    /api/v1/reports/revenue-chart
GET    /api/v1/reports/kpi
```

---

## 📡 n8n Webhooks

APG Manager tự động gửi webhook đến n8n VPS (`103.142.27.27:5678`):

| Event | Path | Hành động n8n |
|-------|------|--------------|
| Booking mới | `/booking-new` | Telegram → Andy |
| Đổi trạng thái | `/booking-status` | Zalo → Khách hàng |
| Thanh toán | `/payment` | Google Sheets kế toán |
| Deposit thấp | `/deposit-alert` | Telegram cảnh báo |
| Báo cáo ngày | `/daily-report` | Telegram tổng hợp KPI |

---

## 🚀 Deploy lên VPS

```bash
# Build backend
cd apps/api
npm run build
# Copy dist/ lên VPS, chạy với PM2

# Frontend
cd apps/web
# Deploy lên Vercel (auto từ GitHub)
```

---

## 📋 Roadmap

### Phase 1 ✅ (Hiện tại)
- Auth (JWT + RBAC)
- Booking CRUD + state machine
- Customer CRM
- Finance Dashboard
- n8n Webhooks

### Phase 2 🔜
- Tích hợp AbayEngine (tra cứu giá thực)
- Booking form đa bước
- Customer detail page
- Finance tabs đầy đủ
- Báo cáo PDF export

### Phase 3 📅
- Claude AI chatbot
- MISA kế toán sync
- Zalo OA notification
- Mobile PWA

---

*Tân Phú APG · Thái Nguyên · Level-1 GDS Amadeus*
