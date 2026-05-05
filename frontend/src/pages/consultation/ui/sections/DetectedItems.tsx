import { Icon, Eyebrow, Mono } from '@/shared/ui/ostone/atoms';

export interface DetectedItem {
  label: string;
  value: string;
  ok: boolean;
}

export function DetectedItems({ items }: { items: DetectedItem[] }) {
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Eyebrow>
          확인된 정보 · {items.length}
        </Eyebrow>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item) => (
          <div
            key={item.label}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--r-2)',
              background: item.ok ? 'var(--signal-bg)' : 'var(--warn-bg)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {item.ok ? (
              <span style={{ color: 'var(--signal)', display: 'inline-flex' }}>
                <Icon name="check" size={14} />
              </span>
            ) : (
              <span
                style={{
                  color: 'var(--warn)',
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: 'var(--mono)',
                }}
              >
                !
              </span>
            )}
            <div>
              <Mono style={{ fontSize: 10, color: 'var(--ink-3)', display: 'block' }}>{item.label}</Mono>
              <span style={{ fontSize: 12, color: 'var(--ink)' }}>{item.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
