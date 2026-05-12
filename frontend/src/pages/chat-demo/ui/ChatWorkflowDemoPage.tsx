import { OstoneShell } from '@/widgets/ostone-shell';
import type {
  ChatMessage,
  DecisionLogEntry,
  DomainPackInfo,
  ScenarioInfo,
  WorkflowState,
} from '@/features/chat-workflow';
import { ChatTimelinePanel } from '@/features/chat-workflow/ui/ChatTimelinePanel';
import { WorkflowGraphPanel } from '@/features/chat-workflow/ui/WorkflowGraphPanel';
import { ExecutionDetailPanel } from '@/features/chat-workflow/ui/ExecutionDetailPanel';
import { DecisionLogDrawer } from '@/features/chat-workflow/ui/DecisionLogDrawer';
import { ChatWorkflowHeader } from '@/features/chat-workflow/ui/ChatWorkflowHeader';

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
        <ChatWorkflowHeader domainPack={domainPack} scenario={scenario} />

        <div
          style={{
            display: 'flex',
            gap: 'var(--s-3)',
            flex: 1,
            minHeight: 0,
          }}
        >
          <div
            style={{
              flex: '0.38 0 0',
              background: 'var(--paper-2)',
              borderRadius: 'var(--r-2)',
              overflow: 'hidden',
            }}
          >
            <ChatTimelinePanel messages={messages} />
          </div>
          <div
            style={{
              flex: '0.37 0 0',
              background: 'var(--paper-2)',
              borderRadius: 'var(--r-2)',
              overflow: 'hidden',
            }}
          >
            <WorkflowGraphPanel workflowState={workflow} />
          </div>
          <div
            style={{
              flex: '0.25 0 0',
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
