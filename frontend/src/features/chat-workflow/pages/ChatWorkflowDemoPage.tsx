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
            paddingBottom: 'var(--s-3)',
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
            </div>
          )}
          {scenario && (
            <span style={{ fontSize: 'var(--fs-body-2)', color: 'var(--ink-2)' }}>
              {scenario.name}
            </span>
          )}
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
