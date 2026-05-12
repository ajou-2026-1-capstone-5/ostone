import { ChatWorkflowDemoPage } from './ChatWorkflowDemoPage';
import type { ChatMessage, DecisionLogEntry, DomainPackInfo, ScenarioInfo, WorkflowState } from '@/features/chat-workflow';

const mockDomainPack: DomainPackInfo = {
  name: '커머스 배송 문의 팩',
  version: '1.2.0',
  publishedAt: '2026-05-10T12:00:00.000Z',
};
const mockScenario: ScenarioInfo = { name: '배송 상태 확인' };
const mockMessages: ChatMessage[] = [];
const mockWorkflow: WorkflowState = {
  currentNodeId: null,
  status: 'idle',
  context: {},
};
const mockDecisionLog: DecisionLogEntry[] = [];

export function ChatWorkflowDemoPageWrapper() {
  return (
    <ChatWorkflowDemoPage
      domainPack={mockDomainPack}
      scenario={mockScenario}
      messages={mockMessages}
      workflow={mockWorkflow}
      decisionLog={mockDecisionLog}
    />
  );
}
