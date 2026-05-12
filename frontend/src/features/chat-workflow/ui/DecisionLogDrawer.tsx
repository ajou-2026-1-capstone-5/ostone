import { useState } from 'react';
import type { DecisionLogEntry } from '../model/chatWorkflow.types';

interface DecisionLogDrawerProps {
  entries: DecisionLogEntry[];
}

export function DecisionLogDrawer({ entries }: DecisionLogDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
        Decision Log
      </button>
      {open && (
        <div style={{ maxHeight: '260px', overflow: 'auto' }}>
          <h3>Decision Log</h3>
          {entries.length === 0 ? (
            <p>기록된 결정이 없습니다.</p>
          ) : (
            <ul>
              {entries.map((entry) => (
                <li key={entry.id}>
                  <span>{entry.step}</span>
                  {' — '}
                  <span>{entry.action}</span>
                  <p>{entry.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
