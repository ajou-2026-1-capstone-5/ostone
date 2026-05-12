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
          <span style={{ fontWeight: 600, fontSize: 'var(--fs-body-2)' }}>
            {domainPack.name}
          </span>
          <span
            style={{
              fontSize: 'var(--fs-sm)',
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
                fontSize: 'var(--fs-sm)',
                color: 'var(--positive, #2a9d8f)',
                background: 'color-mix(in srgb, var(--positive, #2a9d8f) 12%, transparent)',
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
        <span style={{ fontSize: 'var(--fs-body-2)', color: 'var(--ink-2)' }}>
          {scenario.name}
        </span>
      )}

      <div style={{ flex: 1 }} />

      <button
        type="button"
        style={{
          fontSize: 'var(--fs-sm)',
          padding: 'var(--s-1) var(--s-3)',
          borderRadius: 'var(--r-1)',
          border: '1px solid var(--negative, #d32f2f)',
          color: 'var(--negative, #d32f2f)',
          background: 'transparent',
          cursor: 'pointer',
        }}
      >
        Reset
      </button>
      <button
        type="button"
        style={{
          fontSize: 'var(--fs-sm)',
          padding: 'var(--s-1) var(--s-3)',
          borderRadius: 'var(--r-1)',
          border: 'none',
          color: '#fff',
          background: 'var(--accent, #2563eb)',
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        Next Step
      </button>
    </header>
  );
}
