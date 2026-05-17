import { useState } from 'react';
import type { DemoDecisionLogEntry } from '../model/chatWorkflow.types';
import styles from './chat-workflow-demo.module.css';

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
    <div className={styles.decisionPanel}>
      <h3>Trace</h3>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={styles.decisionToggle}>
        <span>Decision Log</span>
        <span>{open ? 'Close' : `${sorted.length} entries`}</span>
      </button>
      {open && (
        <div className={styles.decisionDrawer}>
          <h3>Decision Log</h3>
          {sorted.length === 0 ? (
            <p className={styles.empty}>기록된 결정이 없습니다.</p>
          ) : (
            <ul className={styles.decisionList}>
              {sorted.map((entry) => {
                const highlighted =
                  selectedMessageId != null && entry.messageId === selectedMessageId;
                return (
                  <li
                    key={entry.id}
                    data-testid={`decision-entry-${entry.id}`}
                    className={`${styles.decisionEntry} ${highlighted ? styles.decisionHighlighted : ''}`}
                    style={{
                      borderLeft: highlighted ? '3px solid #3b82f6' : '3px solid transparent',
                      background: highlighted ? '#eff6ff' : undefined,
                    }}
                  >
                    <div className={styles.decisionMeta}>
                      <span className={styles.decisionStep}>{entry.step}.</span>
                      <span data-testid="decision-transition" className={styles.decisionTransition}>
                        {entry.stateFrom} → {entry.stateTo}
                      </span>
                      <span className={styles.decisionBadge}>
                        {entry.eventType}
                      </span>
                      <span
                        data-testid="decision-decision"
                        className={styles.decisionBadge}
                        style={{
                          color: '#fff',
                          background: decisionBadgeColor(entry.decision),
                        }}
                      >
                        {entry.decision}
                      </span>
                    </div>
                    <div data-testid="decision-confidence" className={styles.confidenceTrack}>
                      <div
                        className={styles.confidenceFill}
                        style={{
                          width: `${Math.min(100, Math.max(0, entry.confidence))}%`,
                          background: confidenceBarColor(entry.confidence),
                        }}
                      />
                    </div>
                    <p className={styles.decisionReason}>
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
