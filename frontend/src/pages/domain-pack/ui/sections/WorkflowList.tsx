import { Pill, Mono, Bar } from '@/shared/ui/ostone/atoms';

interface WorkflowItem {
  id: string;
  name: string;
  score: number;
  kind: string;
  convCount: number;
  selected?: boolean;
}

const WORKFLOWS: WorkflowItem[] = [
  { id: '1', name: 'refund.standard', score: 0.96, kind: 'standard', convCount: 1389, selected: true },
  { id: '2', name: 'refund.partial_v2', score: 0.88, kind: 'partial', convCount: 642 },
  { id: '3', name: 'refund.fraud_review', score: 0.74, kind: 'risk', convCount: 312 },
];

export function WorkflowList() {
  return (
    <div style={{ padding: '12px' }}>
      {WORKFLOWS.map((wf) => (
        <div
          key={wf.id}
          style={{
            padding: '10px 14px',
            background: wf.selected ? 'var(--paper-3)' : 'transparent',
            borderLeft: wf.selected ? '3px solid var(--signal)' : '3px solid transparent',
            borderRadius: '0 var(--r-2) var(--r-2) 0',
            marginBottom: '4px',
            cursor: 'pointer',
          }}
        >
          <Mono style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
            {wf.name}
          </Mono>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Bar value={wf.score} tone="signal" w={60} h={3} />
            <Mono style={{ fontSize: '10px', color: 'var(--ink-3)' }}>
              {Math.round(wf.score * 100)}%
            </Mono>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Pill tone="mute">{wf.kind}</Pill>
            <Mono style={{ fontSize: '10px', color: 'var(--ink-3)' }}>
              {wf.convCount.toLocaleString()} conv
            </Mono>
          </div>
        </div>
      ))}
    </div>
  );
}
