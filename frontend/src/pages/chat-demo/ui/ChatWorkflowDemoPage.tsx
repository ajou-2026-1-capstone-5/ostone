import { useState } from 'react';
import { OstoneShell } from '@/widgets/ostone-shell';
import type {
  ChatWorkflowDemoState,
  DemoChatMessage,
  DemoDecisionLogEntry,
} from '@/features/chat-workflow';
import { ChatTimelinePanel } from '@/features/chat-workflow/ui/ChatTimelinePanel';
import { SidePanel } from '@/features/chat-workflow/ui/SidePanel';

export interface ChatWorkflowDemoPageProps {
  state: ChatWorkflowDemoState;
}

export function ChatWorkflowDemoPage({ state }: ChatWorkflowDemoPageProps) {
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(state.selectedMessageId);

  const { loading, error } = state;
  const response = state.response;
  const messages: DemoChatMessage[] = response?.messages ?? [];
  const execution = response?.execution ?? null;
  const decisionLogs: DemoDecisionLogEntry[] = response?.decisionLogs ?? [];
  const domainPack = response?.domainPack ?? null;
  const workflow = response?.workflow ?? null;

  if (loading) {
    return (
      <OstoneShell active="chat-demo" crumbs={['Chat Workflow Demo']}>
        <div data-testid="loading-state" style={{ padding: 'var(--s-8)', textAlign: 'center', color: 'var(--text-3)' }}>
          Loading workflow data...
        </div>
      </OstoneShell>
    );
  }

  if (error) {
    return (
      <OstoneShell active="chat-demo" crumbs={['Chat Workflow Demo']}>
        <div data-testid="error-state" style={{ padding: 'var(--s-8)', textAlign: 'center', color: 'var(--danger)' }}>
          Error: {error}
        </div>
      </OstoneShell>
    );
  }

  return (
    <OstoneShell active="chat-demo" crumbs={['Chat Workflow Demo']}>
      <div
        data-testid="page-container"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: 'var(--s-4)',
          gap: 'var(--s-4)',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 'var(--s-3)',
            flex: 1,
            minHeight: 0,
          }}
        >
          <div
            data-testid="chat-timeline"
            style={{
              flex: '0.35 0 0',
              background: 'var(--paper-2)',
              borderRadius: 'var(--r-2)',
              overflow: 'hidden',
            }}
          >
            <ChatTimelinePanel
              messages={messages}
              selectedMessageId={selectedMessageId}
              onMessageSelect={(id) => setSelectedMessageId(id)}
            />
          </div>

          <div
            data-testid="side-panel-container"
            style={{
              flex: '0.65 0 0',
              background: 'var(--paper-2)',
              borderRadius: 'var(--r-2)',
              overflow: 'hidden',
            }}
          >
            {workflow ? (
              <SidePanel
                workflow={workflow}
                execution={execution}
                decisionLogs={decisionLogs}
                selectedMessageId={selectedMessageId}
                domainPack={domainPack}
              />
            ) : (
              <div
                style={{
                  padding: 'var(--s-8)',
                  textAlign: 'center',
                  color: 'var(--text-3)',
                }}
              >
                No workflow data available
              </div>
            )}
          </div>
        </div>
      </div>
    </OstoneShell>
  );
}
