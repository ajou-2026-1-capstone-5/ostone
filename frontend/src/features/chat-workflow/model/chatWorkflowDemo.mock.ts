import type {
  ChatMessage,
  ChatWorkflowDemoState,
  DecisionLogEntry,
  DomainPackInfo,
  ScenarioInfo,
  WorkflowState,
} from './chatWorkflow.types';

export const mockTimestamps = {
  firstMessage: '2026-05-12T09:00:00.000Z',
  firstDecision: '2026-05-12T09:00:01.000Z',
  secondMessage: '2026-05-12T09:00:05.000Z',
  secondDecision: '2026-05-12T09:00:06.000Z',
  thirdMessage: '2026-05-12T09:00:20.000Z',
  publishedAt: '2026-05-10T12:00:00.000Z',
} as const;

export const demoMessages: ChatMessage[] = [
  { id: 'msg-001', role: 'user', content: '배송 상태를 확인하고 싶어요.', timestamp: mockTimestamps.firstMessage },
  {
    id: 'msg-002',
    role: 'assistant',
    content: '주문 번호를 알려주시면 배송 상태를 확인해드릴게요.',
    timestamp: mockTimestamps.secondMessage,
  },
  { id: 'msg-003', role: 'user', content: '주문 번호는 ORDER-2026-0512입니다.', timestamp: mockTimestamps.thirdMessage },
];

export const demoWorkflowState: WorkflowState = {
  currentNodeId: 'collect-order-number',
  status: 'running',
  context: { intent: 'delivery_status_check', orderNumber: 'ORDER-2026-0512' },
};

export const demoDecisionLog: DecisionLogEntry[] = [
  {
    id: 'decision-001',
    step: 'intent-routing',
    action: 'select-delivery-workflow',
    reason: '사용자 발화가 배송 상태 확인 의도와 일치합니다.',
    timestamp: mockTimestamps.firstDecision,
  },
  {
    id: 'decision-002',
    step: 'slot-collection',
    action: 'request-order-number',
    reason: '배송 조회를 위해 주문 번호 슬롯이 필요합니다.',
    timestamp: mockTimestamps.secondDecision,
  },
];

export const demoDomainPack: DomainPackInfo = {
  name: '커머스 배송 문의 팩',
  version: '1.2.0',
  publishedAt: mockTimestamps.publishedAt,
};

export const demoScenario: ScenarioInfo = {
  name: '배송 상태 확인',
  description: '고객이 주문 번호를 제공하면 배송 진행 상태를 안내하는 시나리오입니다.',
};

export const demoChatWorkflowState: ChatWorkflowDemoState = {
  messages: demoMessages,
  workflow: demoWorkflowState,
  decisionLog: demoDecisionLog,
  domainPack: demoDomainPack,
  scenario: demoScenario,
};

export const emptyChatWorkflowState: ChatWorkflowDemoState = {
  messages: [],
  workflow: { currentNodeId: null, status: 'idle', context: {} },
  decisionLog: [],
  domainPack: null,
  scenario: null,
};
