'use client';

// APG Manager RMS - MoneyInput Component
// Input tiền tự động đặt dấu chấm phân cách hàng nghìn khi gõ
// Ví dụ: gõ 2000000 hiển thị "2.000.000", lưu số thuần 2000000

import { useCallback } from 'react';
import { cn } from '@/lib/utils';

interface MoneyInputProps {
  label: string;
  required?: boolean;
  value: string;             // raw numeric string (no dots): "2000000"
  onChange: (raw: string) => void; // trả về raw (no dots): "2000000"
  placeholder?: string;
  className?: string;
  min?: number;
}

export function MoneyInput({
  label, required, value, onChange, placeholder = '0', className,
}: MoneyInputProps) {
  // Hiển thị: chèn dấu chấm vào số đang nhập
  const displayValue = value
    ? Number(value).toLocaleString('vi-VN')
    : '';

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Chỉ giữ lại các chữ số
    const digits = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
    onChange(digits);
  }, [onChange]);

  return (
    <div className={cn('space-y-1', className)}>
      <label className="block text-xs font-medium text-muted-foreground">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          className={cn(
            'w-full px-3 py-2 pr-7 text-sm rounded-lg border border-border bg-background',
            'text-foreground placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-1 focus:ring-primary',
          )}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none select-none">
          ₫
        </span>
      </div>
    </div>
  );
}
