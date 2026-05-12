import { OstoneShell } from '@/widgets/ostone-shell';
import type {
  ChatMessage,
  DecisionLogEntry,
  DomainPackInfo,
  ScenarioInfo,
  WorkflowState,
} from '../model/chatWorkflow.types';
import { ChatTimelinePanel } from '../ui/ChatTimelinePanel';
import { WorkflowGraphPanel } from '../ui/WorkflowGraphPanel';
import { ExecutionDetailPanel } from '../ui/ExecutionDetailPanel';
import { DecisionLogDrawer } from '../ui/DecisionLogDrawer';

export interface ChatWorkflowDemoPageProps {
  domainPack: DomainPackInfo | null;
  scenario: ScenarioInfo | null;
  messages: ChatMessage[];
  workflow: WorkflowState;
  decisionLog: DecisionLogEntry[];
}

export function ChatWorkflowDemoPage({
  domainPack,
  scenario,
  messages,
  workflow,
  decisionLog,
}: ChatWorkflowDemoPageProps) {
  return (
    <OstoneShell active="chat-demo" crumbs={['Chat Workflow Demo']}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: 'var(--s-4)',
          gap: 'var(--s-4)',
        }}
      >
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

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '38% 37% 25%',
            gap: 'var(--s-3)',
            flex: 1,
            minHeight: 0,
          }}
        >
          <div
            style={{
              background: 'var(--paper-2)',
              borderRadius: 'var(--r-2)',
              overflow: 'hidden',
            }}
          >
            <ChatTimelinePanel messages={messages} />
          </div>
          <div
            style={{
              background: 'var(--paper-2)',
              borderRadius: 'var(--r-2)',
              overflow: 'hidden',
            }}
          >
            <WorkflowGraphPanel workflowState={workflow} />
          </div>
          <div
            style={{
              background: 'var(--paper-2)',
              borderRadius: 'var(--r-2)',
              overflow: 'hidden',
            }}
          >
            <ExecutionDetailPanel status={workflow.status} context={workflow.context} />
          </div>
        </div>

        <div>
          <DecisionLogDrawer entries={decisionLog} />
        </div>
      </div>
    </OstoneShell>
  );
}
