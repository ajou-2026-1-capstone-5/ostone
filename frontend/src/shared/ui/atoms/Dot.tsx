import { cn } from '@/shared/lib/utils';

export interface DotProps {
  tone: 'signal' | 'warn' | 'danger' | 'info' | 'mute';
  size?: number;
}

const toneMap: Record<DotProps['tone'], string> = {
  signal: 'bg-[var(--signal)]',
  warn: 'bg-[var(--warn)]',
  danger: 'bg-[var(--danger)]',
  info: 'bg-[var(--info)]',
  mute: 'bg-[var(--ink-4)]',
};

export function Dot({ tone, size = 6 }: DotProps) {
  return (
    <span
      className={cn('inline-flex flex-shrink-0 rounded-full', toneMap[tone])}
      style={{ width: size, height: size }}
    />
  );
}
