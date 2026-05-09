import { Avatar, Dot, Pill, Mono } from '@/shared/ui/ostone/atoms';

export interface QueueCustomer {
  id: string;
  name: string;
  channel: string;
  waitMinutes: number;
  preview: string;
  topic: string;
  urgent?: boolean;
}

export function Queue({
  items,
  activeId,
  onSelect,
}: {
  items: QueueCustomer[];
  activeId?: string;
  onSelect?: (id: string) => void;
}) {
  return (
    <div>
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <div
            key={item.id}
            onClick={() => onSelect?.(item.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(item.id); } }}
            role="button"
            tabIndex={0}
            style={{
              padding: '12px 14px 12px 16px',
              borderBottom: '1px solid var(--line)',
              background: isActive ? 'var(--paper-3)' : undefined,
              borderLeft: isActive ? '3px solid var(--signal)' : '3px solid transparent',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Avatar initial={item.name.charAt(0)} size={28} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{item.name}</span>
              <Mono style={{ fontSize: 10, color: 'var(--ink-3)' }}>{item.channel}</Mono>
              <Mono style={{ fontSize: 10, color: 'var(--ink-3)', marginLeft: 'auto' }}>
                {item.waitMinutes}분
              </Mono>
              {item.urgent && <Dot tone="signal" />}
            </div>
            <div
              style={{
                marginBottom: 6,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              <Mono style={{ fontSize: 10, color: 'var(--ink-3)' }}>“{item.preview}”</Mono>
            </div>
            <Pill tone="signal">{item.topic}</Pill>
          </div>
        );
      })}
    </div>
  );
}
