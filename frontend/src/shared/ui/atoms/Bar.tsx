import { cn } from '@/shared/lib/utils';

export interface BarProps {
  value: number;
  tone?: 'signal' | 'warn' | 'danger' | 'mute';
  height?: number;
  className?: string;
}

const toneMap: Record<NonNullable<BarProps['tone']>, string> = {
  signal: 'bg-[var(--signal)]',
  warn: 'bg-[var(--warn)]',
  danger: 'bg-[var(--danger)]',
  mute: 'bg-[var(--ink-2)]',
};

export function Bar({ value, tone = 'signal', height = 8, className }: BarProps) {
  const clamped = Math.max(0, Math.min(1, value));

  return (
    <div
      className={cn('w-full rounded-[var(--r-1)] bg-[var(--line-2)] overflow-hidden', className)}
      style={{ height }}
    >
      <div
        className={cn('h-full rounded-[var(--r-1)]', toneMap[tone])}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}
