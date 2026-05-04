import { cn } from '@/shared/lib/utils';

export interface AvatarProps {
  name: string;
  size?: 24 | 32 | 40;
  tone?: 'signal' | 'ink' | 'mute';
}

const toneMap: Record<NonNullable<AvatarProps['tone']>, { bg: string; text: string }> = {
  signal: { bg: 'bg-[var(--signal-bg)]', text: 'text-[var(--signal-ink)]' },
  ink: { bg: 'bg-[var(--ink)]', text: 'text-[var(--paper)]' },
  mute: { bg: 'bg-[var(--paper-3)]', text: 'text-[var(--ink-2)]' },
};

function getInitial(name: string): string {
  if (!name) return '?';
  if (name.includes('@')) {
    return name.charAt(0).toUpperCase();
  }
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
  return parts[0]?.charAt(0)?.toUpperCase() ?? '?';
}

const sizeMap: Record<NonNullable<AvatarProps['size']>, string> = {
  24: 'w-6 h-6 text-[10px]',
  32: 'w-8 h-8 text-xs',
  40: 'w-10 h-10 text-sm',
};

export function Avatar({ name, size = 24, tone = 'mute' }: AvatarProps) {
  const { bg, text } = toneMap[tone];

  return (
    <span
      className={cn(
        'inline-flex flex-shrink-0 items-center justify-center rounded-full font-medium',
        sizeMap[size],
        bg,
        text
      )}
    >
      {getInitial(name)}
    </span>
  );
}
