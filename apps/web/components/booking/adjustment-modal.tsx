'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { RefreshCw, X } from 'lucide-react';
import { MoneyInput } from '@/components/ui/money-input';
import { bookingsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { AdjustmentType } from '@/types';

interface AdjustmentModalProps {
  bookingId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AdjustmentModal({ bookingId, isOpen, onClose, onSuccess }: AdjustmentModalProps) {
  const [type, setType] = useState<AdjustmentType>('CHANGE');
  const [chargeToCustomer, setChargeToCustomer] = useState('');
  const [changeFee, setChangeFee] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setType('CHANGE');
    setChargeToCustomer('');
    setChangeFee('');
    setRefundAmount('');
    setNotes('');
  };

  const handleClose = () => {
    if (submitMutation.isPending) return;
    resetForm();
    onClose();
  };

  const submitMutation = useMutation({
    mutationFn: async () => bookingsApi.addAdjustment(bookingId, {
      type,
      chargeToCustomer: Number(chargeToCustomer || 0),
      changeFee: Number(changeFee || 0),
      refundAmount: Number(refundAmount || 0),
      notes,
    }),
    onSuccess: () => {
      resetForm();
      onSuccess();
      onClose();
    },
    onError: (error) => {
      console.error('Lỗi khi ghi nhận hoàn/đổi:', error);
      window.alert('Có lỗi xảy ra, vui lòng thử lại.');
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMutation.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
              <RefreshCw className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Ghi nhận Hoàn / Đổi vé</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitMutation.isPending}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-foreground">Loại nghiệp vụ</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setType('CHANGE')}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm transition-all',
                    type === 'CHANGE'
                      ? 'border-blue-500 bg-blue-500/10 font-semibold text-blue-600'
                      : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  Đổi vé
                </button>
                <button
                  type="button"
                  onClick={() => setType('REFUND_CREDIT')}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm transition-all',
                    type === 'REFUND_CREDIT'
                      ? 'border-orange-500 bg-orange-500/10 font-semibold text-orange-600'
                      : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  Hoàn bảo lưu
                </button>
                <button
                  type="button"
                  onClick={() => setType('REFUND_CASH')}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm transition-all',
                    type === 'REFUND_CASH'
                      ? 'border-red-500 bg-red-500/10 font-semibold text-red-600'
                      : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  Hoàn tiền mặt
                </button>
              </div>
            </div>

            {type === 'CHANGE' && (
              <>
                <div>
                  <MoneyInput
                    label="Thu khách (Phụ thu)"
                    value={chargeToCustomer}
                    onChange={setChargeToCustomer}
                    placeholder="0"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Sẽ tạo công nợ Khách hàng (AR) tương ứng.</p>
                </div>
                <div>
                  <MoneyInput
                    label="Phí đổi trả NCC / Hãng"
                    value={changeFee}
                    onChange={setChangeFee}
                    placeholder="0"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Sẽ tạo công nợ Phải trả NCC (AP) tương ứng.</p>
                </div>
              </>
            )}

            {(type === 'REFUND_CREDIT' || type === 'REFUND_CASH') && (
              <div>
                <MoneyInput
                  label="Số tiền khách được hoàn"
                  value={refundAmount}
                  onChange={setRefundAmount}
                  placeholder="0"
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-foreground">Ghi chú thêm</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-[14px] outline-none focus:border-ring"
                placeholder="VD: Khách yêu cầu đổi sang chuyến lúc 15:00..."
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitMutation.isPending}
              className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={submitMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitMutation.isPending ? 'Đang lưu...' : 'Ghi nhận'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
