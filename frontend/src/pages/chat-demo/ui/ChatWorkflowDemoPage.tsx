import { useState, useMemo, useCallback } from 'react';
import { OstoneShell } from '@/widgets/ostone-shell';
import type {
  ChatWorkflowDemoState,
  DemoChatMessage,
  DemoDecisionLogEntry,
} from '@/features/chat-workflow';
import { ChatTimelinePanel } from '@/features/chat-workflow/ui/ChatTimelinePanel';
import { SidePanel } from '@/features/chat-workflow/ui/SidePanel';
import { getMessageIdByNodeId } from '@/features/chat-workflow/lib/messageNodeMapping';
import { adaptDemoWorkflow } from '@/features/chat-workflow/lib/workflowAdapter';
import styles from '@/features/chat-workflow/ui/chat-workflow-demo.module.css';

export interface ChatWorkflowDemoPageProps {
  state: ChatWorkflowDemoState;
}

export function ChatWorkflowDemoPage({ state }: ChatWorkflowDemoPageProps) {
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(state.selectedMessageId);

  const { loading, error } = state;
  const response = state.response;
  const messages: DemoChatMessage[] = useMemo(() => response?.messages ?? [], [response?.messages]);
  const execution = response?.execution ?? null;
  const decisionLogs: DemoDecisionLogEntry[] = useMemo(() => response?.decisionLogs ?? [], [response?.decisionLogs]);
  const domainPack = response?.domainPack ?? null;
  const workflow = response?.workflow ?? null;
  const activeMessageId = useMemo(() => {
    if (selectedMessageId) return selectedMessageId;
    const lastLogWithMessage = [...decisionLogs].reverse().find((log) => log.messageId);
    return lastLogWithMessage?.messageId ?? messages.at(-1)?.id ?? null;
  }, [decisionLogs, messages, selectedMessageId]);

  const workflowGraph = useMemo(
    () => (workflow ? adaptDemoWorkflow(workflow) : null),
    [workflow],
  );

  const handleNodeSelect = useCallback(
    (nodeId: string) => {
      if (workflowGraph) {
        const messageId = getMessageIdByNodeId(nodeId, decisionLogs, workflowGraph);
        if (messageId) {
          setSelectedMessageId(messageId);
        }
      }
    },
    [workflowGraph, decisionLogs],
  );

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
        className={styles.page}
      >
        <div className={styles.workspace}>
          <div
            data-testid="chat-timeline"
            className={styles.panel}
          >
            <ChatTimelinePanel
              messages={messages}
              activeMessageId={activeMessageId}
              selectedMessageId={selectedMessageId}
              onMessageSelect={(id) => setSelectedMessageId(id)}
            />
          </div>

          <div
            data-testid="side-panel-container"
            className={styles.panel}
          >
            {workflow ? (
              <SidePanel
                workflow={workflow}
                execution={execution}
                decisionLogs={decisionLogs}
                selectedMessageId={selectedMessageId}
                activeMessageId={activeMessageId}
                messages={messages}
                domainPack={domainPack}
                onNodeSelect={handleNodeSelect}
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
