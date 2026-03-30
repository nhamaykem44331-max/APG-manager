'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { RefreshCw, X } from 'lucide-react';
import { MoneyInput } from '@/components/ui/money-input';
import { bookingsApi } from '@/lib/api';
import { cn, formatVND } from '@/lib/utils';
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
  const [airlineRefund, setAirlineRefund] = useState('');
  const [penaltyFee, setPenaltyFee] = useState('');
  const [apgServiceFee, setApgServiceFee] = useState('');
  const [fundAccount, setFundAccount] = useState('BANK_HTX');
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setType('CHANGE');
    setChargeToCustomer('');
    setChangeFee('');
    setRefundAmount('');
    setAirlineRefund('');
    setPenaltyFee('');
    setApgServiceFee('');
    setFundAccount('BANK_HTX');
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
      airlineRefund: Number(airlineRefund || 0),
      penaltyFee: Number(penaltyFee || 0),
      apgServiceFee: Number(apgServiceFee || 0),
      fundAccount,
      notes,
    }),
    onSuccess: () => {
      resetForm();
      onSuccess();
      onClose();
    },
    onError: (error) => {
      console.error('Lỗi khi ghi nhận hoàn/đổi:', error);
      const message = (() => {
        const responseMessage = (error as {
          response?: { data?: { message?: string | string[] } };
        })?.response?.data?.message;

        if (Array.isArray(responseMessage)) {
          return responseMessage[0];
        }

        if (typeof responseMessage === 'string' && responseMessage.trim()) {
          return responseMessage;
        }

        return 'Có lỗi xảy ra, vui lòng thử lại.';
      })();

      window.alert(message);
    },
  });

  if (!isOpen) return null;

  const retainedByApg = Number(airlineRefund || 0) - Number(refundAmount || 0);

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
      <div className="flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
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
              <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                <div className="border-b border-border pb-2">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Khi chọn đổi vé
                  </p>
                </div>

                <div>
                  <MoneyInput
                    label="Thu khách (Phụ thu)"
                    value={chargeToCustomer}
                    onChange={setChargeToCustomer}
                    placeholder="0"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sẽ tạo công nợ Khách hàng (AR) tương ứng.
                  </p>
                </div>

                <div>
                  <MoneyInput
                    label="Phí đổi trả NCC / Hãng"
                    value={changeFee}
                    onChange={setChangeFee}
                    placeholder="0"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sẽ tạo công nợ Phải trả NCC (AP) tương ứng.
                  </p>
                </div>
              </div>
            )}

            {(type === 'REFUND_CREDIT' || type === 'REFUND_CASH') && (
              <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                <div className="border-b border-border pb-2">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Khi chọn hoàn vé
                  </p>
                </div>

                <div>
                  <MoneyInput
                    label="NCC / Hãng hoàn cho APG"
                    value={airlineRefund}
                    onChange={setAirlineRefund}
                    placeholder="0"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Số tiền hãng bay thực hoàn (sau trừ phí hoàn). Sẽ ghi CashFlow INFLOW.
                  </p>
                </div>

                <div>
                  <MoneyInput
                    label="Phí hoàn (hãng thu)"
                    value={penaltyFee}
                    onChange={setPenaltyFee}
                    placeholder="0"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Phí hãng giữ lại khi hoàn. VD: vé 8M, hãng thu 1.5M phí → hoàn 6.5M.
                  </p>
                </div>

                <div>
                  <MoneyInput
                    label="APG hoàn cho khách"
                    value={refundAmount}
                    onChange={setRefundAmount}
                    placeholder="0"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Số tiền APG hoàn lại KH. {type === 'REFUND_CASH' ? 'Sẽ ghi CashFlow OUTFLOW.' : 'Bảo lưu (credit).'}
                  </p>
                </div>

                <div>
                  <MoneyInput
                    label="Phí xử lý APG giữ lại"
                    value={apgServiceFee}
                    onChange={setApgServiceFee}
                    placeholder="0"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Phí dịch vụ APG thu cho việc xử lý hoàn. APG giữ = NCC hoàn − Hoàn KH.
                  </p>
                </div>

                {type === 'REFUND_CASH' && (
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-foreground">Chi / Nhận từ quỹ</label>
                    <select
                      value={fundAccount}
                      onChange={(e) => setFundAccount(e.target.value)}
                      className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-[13px]"
                    >
                      <option value="CASH_OFFICE">Quỹ tiền mặt VP</option>
                      <option value="BANK_HTX">TK BIDV HTX (3900543757)</option>
                      <option value="BANK_PERSONAL">TK MB cá nhân (996106688)</option>
                    </select>
                  </div>
                )}

                <div className="mt-1 space-y-1 rounded-lg bg-muted/60 p-3 text-xs">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">NCC hoàn APG:</span>
                    <span className="font-tabular text-emerald-500">+{formatVND(Number(airlineRefund || 0))}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">APG hoàn KH:</span>
                    <span className="font-tabular text-red-500">-{formatVND(Number(refundAmount || 0))}</span>
                  </div>
                  <div className="mt-1 flex justify-between gap-3 border-t border-border pt-2">
                    <span className="font-medium text-foreground">APG giữ lại:</span>
                    <span
                      className={cn(
                        'font-tabular font-medium',
                        retainedByApg >= 0 ? 'text-emerald-500' : 'text-red-500',
                      )}
                    >
                      {formatVND(retainedByApg)}
                    </span>
                  </div>
                </div>
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
