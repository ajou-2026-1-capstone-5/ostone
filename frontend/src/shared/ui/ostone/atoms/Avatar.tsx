export type AvatarTone = 'mute' | 'signal' | 'warn' | 'info';

const AVATAR_STYLE_MAP: Record<AvatarTone, { bg: string; color: string }> = {
  mute: { bg: 'var(--paper-3)', color: 'var(--ink-2)' },
  signal: { bg: 'var(--signal-bg)', color: 'var(--signal-ink)' },
  warn: { bg: 'var(--warn-bg)', color: 'var(--warn)' },
  info: { bg: 'var(--info-bg)', color: 'var(--info)' },
};

interface AvatarProps {
  initial: string;
  tone?: AvatarTone;
  size?: number;
}

export function Avatar({ initial, tone = 'mute', size = 28 }: AvatarProps) {
  const style = AVATAR_STYLE_MAP[tone] ?? AVATAR_STYLE_MAP.mute;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: 'var(--r-2)',
        background: style.bg,
        color: style.color,
        fontFamily: 'var(--mono)',
        fontSize: `${size * 0.4}px`,
        fontWeight: 500,
        textAlign: 'center',
      }}
    >
      {initial}
    </span>
  );
}
