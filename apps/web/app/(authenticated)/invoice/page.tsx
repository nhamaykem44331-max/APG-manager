'use client';

import { InvoiceTab } from '@/components/finance/invoice-tab';
import { PageHeader } from '@/components/ui/page-header';

export default function InvoicePage() {
  return (
    <div className="max-w-[1400px] space-y-5">
      <PageHeader
        title="Invoice"
        description="Quản lý hóa đơn đầu vào, đầu ra và bộ hồ sơ gửi MISA"
      />

      <InvoiceTab />
    </div>
  );
}
