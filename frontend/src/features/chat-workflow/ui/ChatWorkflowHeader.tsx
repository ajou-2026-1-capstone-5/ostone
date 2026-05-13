import type { DomainPackInfo, ScenarioInfo } from '../model/chatWorkflow.types';

export interface ChatWorkflowHeaderProps {
  domainPack?: DomainPackInfo | null;
  scenario?: ScenarioInfo | null;
}

export function ChatWorkflowHeader({ domainPack, scenario }: ChatWorkflowHeaderProps) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--s-4)',
        minHeight: '56px',
        padding: 'var(--s-2) var(--s-1)',
        borderBottom: '1px solid var(--line)',
      }}
    >
      {domainPack && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)' }}>
          <span style={{ fontWeight: 600, fontSize: 'var(--font-size-base)' }}>
            {domainPack.name}
          </span>
          <span
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--ink-3)',
              background: 'var(--paper-2)',
              borderRadius: 'var(--r-1)',
              padding: '0 var(--s-1)',
            }}
          >
            v{domainPack.version}
          </span>
          {domainPack.publishedAt && (
            <span
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--signal-ink)',
                background: 'var(--signal-bg)',
                borderRadius: 'var(--r-1)',
                padding: '0 var(--s-1)',
                fontWeight: 500,
              }}
            >
              Published
            </span>
          )}
        </div>
      )}
      {scenario && (
        <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--ink-2)' }}>
          {scenario.name}
        </span>
      )}

      <div style={{ flex: 1 }} />

      <button
        type="button"
        disabled
        style={{
          fontSize: 'var(--font-size-sm)',
          padding: 'var(--s-1) var(--s-3)',
          borderRadius: 'var(--r-1)',
          border: '1px solid var(--line)',
          color: 'var(--ink-4)',
          background: 'transparent',
          cursor: 'not-allowed',
        }}
      >
        Reset
      </button>
      <button
        type="button"
        disabled
        style={{
          fontSize: 'var(--font-size-sm)',
          padding: 'var(--s-1) var(--s-3)',
          borderRadius: 'var(--r-1)',
          border: '1px solid var(--line)',
          color: 'var(--ink-3)',
          background: 'var(--paper-3)',
          cursor: 'not-allowed',
          fontWeight: 600,
        }}
      >
        Next Step
      </button>
    </header>
  );
}
