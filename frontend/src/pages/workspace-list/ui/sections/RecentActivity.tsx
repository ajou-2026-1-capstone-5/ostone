import { Dot, Mono, Pill, Eyebrow } from '@/shared/ui/ostone/atoms';

export interface ActivityEvent {
  id: string;
  stage: string;
  workspace: string;
  status: 'success' | 'running' | 'failed';
  time: string;
  duration: string;
}

const STATUS_TO_DOT_TONE = {
  success: 'signal' as const,
  running: 'info' as const,
  failed: 'danger' as const,
};

const STATUS_TO_PILL_TONE = {
  success: 'signal' as const,
  running: 'info' as const,
  failed: 'danger' as const,
};

export function RecentActivity({ events }: { events: ActivityEvent[] }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <h2 style={{ fontSize: 18, fontWeight: 350, margin: 0, color: 'var(--ink)', fontFamily: 'var(--sans)' }}>
            Recent pipeline activity
          </h2>
          <Eyebrow>· last 24 hours</Eyebrow>
        </div>
        <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
          <Mono style={{ fontSize: 10, color: 'var(--ink-3)' }}>View all</Mono>
        </button>
      </div>
      <div style={{ position: 'relative' }}>
        {events.map((event, index) => (
          <div key={event.id} style={{ display: 'flex', padding: '8px 0', alignItems: 'center' }}>
            <div
              style={{
                width: 20,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'relative',
              }}
            >
              {index > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: -8,
                    width: 1,
                    height: 16,
                    background: 'var(--line-2)',
                  }}
                />
              )}
              {index < events.length - 1 && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: -8,
                    width: 1,
                    height: 16,
                    background: 'var(--line-2)',
                  }}
                />
              )}
              <div style={{ position: 'relative', zIndex: 1 }}>
                <Dot tone={STATUS_TO_DOT_TONE[event.status]} size={9} />
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Mono style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>{event.stage}</Mono>
                <Mono style={{ fontSize: 10, color: 'var(--ink-3)' }}>{event.workspace}</Mono>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Pill tone={STATUS_TO_PILL_TONE[event.status]}>{event.status}</Pill>
                <Mono style={{ fontSize: 10, color: 'var(--ink-3)' }}>{event.time}</Mono>
                <Mono style={{ fontSize: 10, color: 'var(--ink-3)' }}>{event.duration}</Mono>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
