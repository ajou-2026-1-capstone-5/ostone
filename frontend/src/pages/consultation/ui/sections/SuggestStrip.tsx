import { Icon, Mono } from '@/shared/ui/ostone/atoms';

const PILLS = [
  '부분환불 가능합니다',
  '환불 처리 중입니다',
  '카드사 확인이 필요합니다',
];

export function SuggestStrip({ onSelect }: { onSelect?: (text: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '8px 0', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <span style={{ color: 'var(--signal-ink)', display: 'inline-flex' }}>
          <Icon name="spark" size={14} />
        </span>
        <Mono style={{ fontSize: 10, color: 'var(--signal-ink)' }}>추천 답변</Mono>
      </div>
      {PILLS.map((text) => (
        <span
          key={text}
          onClick={() => onSelect?.(text)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(text); } }}
          role="button"
          tabIndex={0}
          style={{
            padding: '5px 11px',
            borderRadius: 'var(--r-pill)',
            border: '1px solid var(--line)',
            background: 'var(--paper-3)',
            fontSize: 12,
            cursor: 'pointer',
            color: 'var(--ink)',
            whiteSpace: 'nowrap',
          }}
        >
          {text}
        </span>
      ))}
    </div>
  );
}
