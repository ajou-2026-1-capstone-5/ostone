import { useState } from 'react';
import type { DemoDecisionLogEntry } from '../model/chatWorkflow.types';

interface DecisionLogDrawerProps {
  entries: DemoDecisionLogEntry[];
  selectedMessageId: string | null;
}

const confidenceBarColor = (value: number): string => {
  if (value > 80) return '#22c55e';
  if (value >= 50) return '#eab308';
  return '#ef4444';
};

const decisionBadgeColor = (decision: string): string => {
  switch (decision) {
    case 'ALLOW':
      return '#22c55e';
    case 'DENY':
      return '#ef4444';
    case 'ESCALATE':
      return '#eab308';
    default:
      return '#6b7280';
  }
};

export function DecisionLogDrawer({ entries, selectedMessageId }: DecisionLogDrawerProps) {
  const [open, setOpen] = useState(false);
  const sorted = [...entries].sort((a, b) => a.step - b.step);

  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
        Decision Log {open ? '\u25B2' : '\u25BC'}
      </button>
      {open && (
        <div style={{ maxHeight: '260px', overflow: 'auto' }}>
          <h3>Decision Log</h3>
          {sorted.length === 0 ? (
            <p>기록된 결정이 없습니다.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {sorted.map((entry) => {
                const highlighted =
                  selectedMessageId != null && entry.messageId === selectedMessageId;
                return (
                  <li
                    key={entry.id}
                    data-testid={`decision-entry-${entry.id}`}
                    style={{
                      padding: '8px',
                      marginBottom: '4px',
                      borderLeft: highlighted ? '3px solid #3b82f6' : '3px solid transparent',
                      background: highlighted ? '#eff6ff' : undefined,
                      borderRadius: '4px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '4px',
                      }}
                    >
                      <span>{entry.step}.</span>
                      <span data-testid="decision-transition">
                        {entry.stateFrom} → {entry.stateTo}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '1px 6px',
                          borderRadius: '8px',
                          background: '#e5e7eb',
                          color: '#374151',
                        }}
                      >
                        {entry.eventType}
                      </span>
                      <span
                        data-testid="decision-decision"
                        style={{
                          fontSize: '11px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          color: '#fff',
                          fontWeight: 600,
                          background: decisionBadgeColor(entry.decision),
                        }}
                      >
                        {entry.decision}
                      </span>
                    </div>
                    <div
                      data-testid="decision-confidence"
                      style={{
                        width: '100%',
                        height: '8px',
                        background: '#e5e7eb',
                        borderRadius: '4px',
                        marginBottom: '4px',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, Math.max(0, entry.confidence))}%`,
                          height: '100%',
                          background: confidenceBarColor(entry.confidence),
                          borderRadius: '4px',
                          transition: 'width 0.3s',
                        }}
                      />
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                      {entry.reason}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
