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
        // Structure (shared across themes). Light mode = clean neutral chip (matches design);
        // dark mode restores the original glowing gradient treatment via dark: overrides.
        'inline-flex min-w-[84px] items-center justify-center rounded-lg border px-2.5 py-1.5 font-mono text-[12px] font-black tracking-[0.22em] transition-all duration-150 active:scale-[0.98]',
        copied
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/70 dark:bg-emerald-500/15 dark:text-emerald-300 dark:shadow-[0_0_0_1px_rgba(52,211,153,0.18),0_0_24px_rgba(52,211,153,0.18)]'
          : variant === 'orange'
            ? 'border-border bg-muted/60 text-foreground hover:border-primary/40 hover:bg-primary/5 dark:border-orange-400/40 dark:bg-[linear-gradient(135deg,rgba(251,146,60,0.18),rgba(245,158,11,0.10))] dark:text-orange-50 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_8px_24px_rgba(245,158,11,0.10)] dark:hover:border-orange-300/75 dark:hover:bg-orange-400/15 dark:hover:text-white'
            : 'border-border bg-muted/60 text-foreground hover:border-primary/40 hover:bg-primary/5 dark:border-cyan-400/35 dark:bg-[linear-gradient(135deg,rgba(6,182,212,0.16),rgba(59,130,246,0.10))] dark:text-cyan-50 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_8px_24px_rgba(6,182,212,0.10)] dark:hover:border-cyan-300/70 dark:hover:bg-cyan-400/15 dark:hover:text-white',
        className,
      )}
    >
      {value}
    </button>
  );
}
