import { ChatWorkflowDemoPage } from './ChatWorkflowDemoPage';

const mockDomainPack = {
  name: '커머스 배송 문의 팩',
  version: '1.2.0',
  publishedAt: '2026-05-10T12:00:00.000Z',
};
const mockScenario = { name: '배송 상태 확인', description: '배송 진행 상태를 안내하는 시나리오' };
const mockMessages: import('../model/chatWorkflow.types').ChatMessage[] = [];
const mockWorkflow: import('../model/chatWorkflow.types').WorkflowState = {
  currentNodeId: null,
  status: 'idle',
  context: {},
};
const mockDecisionLog: import('../model/chatWorkflow.types').DecisionLogEntry[] = [];

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
