import { Mono } from '@/shared/ui/ostone/atoms';

const STATS = [
  { label: 'Node count', value: 8 },
  { label: 'Edge count', value: 9 },
  { label: 'Pass rate', value: '0.83' },
  { label: 'Avg latency', value: '1.2s' },
  { label: 'Coverage', value: '0.74' },
];

export function MetricsFooter() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '10px 16px',
        borderTop: '1px solid var(--line-2)',
      }}
    >
      {STATS.map((stat, i) => (
        <div key={stat.label} style={{ display: 'inline-flex', gap: '4px' }}>
          <Mono style={{ fontSize: '11px', color: 'var(--ink-3)' }}>
            {stat.label}:
          </Mono>
          <Mono style={{ fontSize: '11px', color: 'var(--ink)' }}>
            {stat.value}
          </Mono>
          {i < STATS.length - 1 && (
            <Mono style={{ fontSize: '11px', color: 'var(--ink-4)', marginLeft: '4px' }}>
              ·
            </Mono>
          )}
        </div>
      ))}
    </div>
  );
}
