import { type CSSProperties } from 'react';

export type WorkflowSettingValue = string | number;

export interface WorkflowSettingOption {
  value: WorkflowSettingValue;
  label: string;
}

export interface WorkflowSettingEntry {
  key: string;
  label: string;
  value: WorkflowSettingValue;
  options: ReadonlyArray<WorkflowSettingOption>;
  onChange: (next: WorkflowSettingValue) => void;
}

interface WorkflowSettingsPanelProps {
  entries: ReadonlyArray<WorkflowSettingEntry>;
  testId?: string;
}

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--s-2)',
  padding: 'var(--s-2) var(--s-3) var(--s-2) 48px',
  background: 'var(--paper-3)',
  borderLeft: '3px solid transparent',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--s-2)',
  fontFamily: 'var(--sans)',
  fontSize: '11px',
  color: 'var(--ink-3)',
};

const labelStyle: CSSProperties = {
  flex: '0 0 auto',
  minWidth: '48px',
  letterSpacing: '-0.1px',
};

const chipsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px',
};

function chipStyle(active: boolean): CSSProperties {
  return {
    padding: '2px 8px',
    borderRadius: '999px',
    border: `1px solid ${active ? 'var(--ink)' : 'var(--line)'}`,
    background: active ? 'var(--ink)' : 'var(--paper)',
    color: active ? 'var(--paper)' : 'var(--ink-3)',
    fontSize: '11px',
    fontFamily: 'var(--mono)',
    cursor: 'pointer',
    lineHeight: 1.2,
  };
}

export function WorkflowSettingsPanel({ entries, testId }: WorkflowSettingsPanelProps) {
  return (
    <div data-testid={testId ?? 'workflow-settings-panel'} style={containerStyle}>
      {entries.map((entry) => (
        <div key={entry.key} style={rowStyle} data-testid={`${testId ?? 'workflow-settings-panel'}-${entry.key}`}>
          <span style={labelStyle}>{entry.label}</span>
          <div style={chipsStyle}>
            {entry.options.map((opt) => {
              const active = opt.value === entry.value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => entry.onChange(opt.value)}
                  style={chipStyle(active)}
                  data-active={active ? 'true' : 'false'}
                  data-testid={`${testId ?? 'workflow-settings-panel'}-${entry.key}-${opt.value}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
