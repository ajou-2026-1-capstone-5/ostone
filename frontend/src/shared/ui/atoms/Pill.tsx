import React from 'react';
import { cn } from '@/shared/lib/utils';

export interface PillProps {
  tone?: 'signal' | 'warn' | 'danger' | 'info' | 'mute' | 'ink';
  dark?: boolean;
  active?: boolean;
  size?: 'sm' | 'md';
  children: React.ReactNode;
}

const toneMap: Record<NonNullable<PillProps['tone']>, { bg: string; text: string }> = {
  signal: { bg: 'bg-[var(--signal-bg)]', text: 'text-[var(--signal-ink)]' },
  warn: { bg: 'bg-[var(--warn-bg)]', text: 'text-[var(--warn-ink)]' },
  danger: { bg: 'bg-[var(--danger-bg)]', text: 'text-[var(--danger-ink)]' },
  info: { bg: 'bg-[var(--info-bg)]', text: 'text-[var(--info-ink)]' },
  mute: { bg: 'bg-[var(--paper-3)]', text: 'text-[var(--ink-2)]' },
  ink: { bg: 'bg-[var(--ink)]', text: 'text-[var(--paper)]' },
};

const darkToneMap: Record<NonNullable<PillProps['tone']>, { bg: string; text: string }> = {
  signal: { bg: 'bg-[var(--signal-ink)]', text: 'text-[var(--signal-bg)]' },
  warn: { bg: 'bg-[var(--warn-ink)]', text: 'text-[var(--warn-bg)]' },
  danger: { bg: 'bg-[var(--danger-ink)]', text: 'text-[var(--danger-bg)]' },
  info: { bg: 'bg-[var(--info-ink)]', text: 'text-[var(--info-bg)]' },
  mute: { bg: 'bg-[var(--ink-2)]', text: 'text-[var(--paper-3)]' },
  ink: { bg: 'bg-[var(--paper)]', text: 'text-[var(--ink)]' },
};

export function Pill({ tone = 'mute', dark, active, size = 'md', children }: PillProps) {
  const { bg, text } = dark ? darkToneMap[tone] : toneMap[tone];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-[5px] font-mono font-medium uppercase tracking-wider',
        'rounded-[var(--r-2)] leading-[1.4]',
        size === 'sm' ? 'px-1 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]',
        bg,
        text,
        active && 'ring-1 ring-[var(--ring)]'
      )}
    >
      {children}
    </span>
  );
}
