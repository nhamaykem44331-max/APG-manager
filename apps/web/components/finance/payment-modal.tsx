'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ledgerApi } from '@/lib/api';
import type { AccountsLedger } from '@/types';
import {
  PAYMENT_METHOD_OPTIONS,
  PaymentEntryModal,
  type PaymentEntryPayload,
} from './payment-entry-modal';

interface Props {
  ledgers: AccountsLedger[];
  onClose: () => void;
}

export function PaymentModal({ ledgers, onClose }: Props) {
  const qc = useQueryClient();
  const [error, setError] = useState('');

  const orderedLedgers = useMemo(
    () => [...ledgers].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [ledgers],
  );

  const primaryLedger = orderedLedgers[0]!;
  const isBatch = orderedLedgers.length > 1;
  const bookingRef = primaryLedger.booking?.pnr
    ?? primaryLedger.booking?.bookingCode
    ?? primaryLedger.bookingCode
    ?? primaryLedger.code;
  const partyName = primaryLedger.customer?.fullName
    ?? primaryLedger.supplier?.name
    ?? primaryLedger.customerCode
    ?? 'N/A';
  const remainingAmount = orderedLedgers.reduce((sum, ledger) => sum + Number(ledger.remaining), 0);
  const contextLine = isBatch
    ? `${bookingRef} · ${orderedLedgers.length} khoản nợ · ${partyName}`
    : `${bookingRef} · ${partyName}`;

  const mutation = useMutation({
    mutationFn: (payload: PaymentEntryPayload) => {
      if (isBatch) {
        return ledgerApi.payBatch({
          ledgerIds: orderedLedgers.map((ledger) => ledger.id),
          ...payload,
        });
      }

      return ledgerApi.pay(primaryLedger.id, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ledger'] });
      qc.invalidateQueries({ queryKey: ['bookings'] });

      const bookingIds = new Set(orderedLedgers.map((ledger) => ledger.bookingId).filter(Boolean));
      for (const bookingId of bookingIds) {
        qc.invalidateQueries({ queryKey: ['booking', bookingId] });
      }

      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Có lỗi khi ghi nhận thanh toán');
    },
  });

  return (
    <PaymentEntryModal
      contextLine={contextLine}
      remainingAmount={remainingAmount}
      direction={primaryLedger.direction}
      methods={PAYMENT_METHOD_OPTIONS}
      isPending={mutation.isPending}
      error={error}
      onClearError={() => setError('')}
      onSubmit={(payload) => mutation.mutate(payload)}
      onClose={onClose}
    />
  );
}
