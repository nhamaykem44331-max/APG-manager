'use client';

import { useState, type MouseEvent } from 'react';
import { cn } from '@/lib/utils';

interface PnrCopyChipProps {
  value: string;
  variant?: 'cyan' | 'orange';
  className?: string;
}

export function PnrCopyChip({ value, variant = 'cyan', className }: PnrCopyChipProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch (error) {
      console.error('Copy PNR failed:', error);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Copied' : 'Click to copy'}
      aria-label={`Copy ${value}`}
      className={cn(
        'inline-flex min-w-[84px] items-center justify-center rounded-lg border px-2.5 py-1.5 font-mono text-[12px] font-black tracking-[0.22em] shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_8px_24px_rgba(6,182,212,0.10)] transition-all duration-150 active:scale-[0.98]',
        copied
          ? 'border-emerald-400/70 bg-emerald-500/15 text-emerald-300 shadow-[0_0_0_1px_rgba(52,211,153,0.18),0_0_24px_rgba(52,211,153,0.18)]'
          : variant === 'orange'
            ? 'border-orange-400/40 bg-[linear-gradient(135deg,rgba(251,146,60,0.18),rgba(245,158,11,0.10))] text-orange-50 hover:border-orange-300/75 hover:bg-orange-400/15 hover:text-white'
            : 'border-cyan-400/35 bg-[linear-gradient(135deg,rgba(6,182,212,0.16),rgba(59,130,246,0.10))] text-cyan-50 hover:border-cyan-300/70 hover:bg-cyan-400/15 hover:text-white',
        className,
      )}
    >
      {value}
    </button>
  );
}
