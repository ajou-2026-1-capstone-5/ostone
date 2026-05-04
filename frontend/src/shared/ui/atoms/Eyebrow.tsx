import React from 'react';
import { cn } from '@/shared/lib/utils';

export interface EyebrowProps {
  children: React.ReactNode;
  className?: string;
  tone?: 'mute' | 'ink' | 'signal';
}

const toneMap: Record<NonNullable<EyebrowProps['tone']>, string> = {
  mute: 'text-[var(--ink-3)]',
  ink: 'text-[var(--ink)]',
  signal: 'text-[var(--signal)]',
};

export function Eyebrow({ children, className, tone = 'mute' }: EyebrowProps) {
  return (
    <span className={cn('t-eyebrow', toneMap[tone], className)}>
      {children}
    </span>
  );
}
