import type {
  ChatWorkflowDemoState,
  DemoChatMessage,
  DemoChatSession,
  DemoChatWorkflowResponse,
  DemoDecisionLogEntry,
  DemoDomainPack,
  DemoExecution,
  DemoPolicyHit,
  DemoRiskHit,
  DemoWorkflow,
  DemoWorkflowTransition,
} from './chatWorkflow.types';

export const mockTimestamps = {
  startedAt: '2026-05-10T09:00:00Z',
  firstMessage: '2026-05-10T09:00:00Z',
  secondMessage: '2026-05-10T09:00:15Z',
  thirdMessage: '2026-05-10T09:01:00Z',
  fourthMessage: '2026-05-10T09:05:30Z',
  completedAt: '2026-05-10T09:05:30Z',
} as const;

export const demoDomainPack: DemoDomainPack = {
  id: 'demo-pack-1',
  name: 'CS Support Domain Pack',
  version: '1.0.0',
  status: 'PUBLISHED',
  intents: [
    {
      id: 'intent-1',
      name: '환불 요청',
      description: '고객이 제품 환불을 요청하는 경우',
    },
    {
      id: 'intent-2',
      name: '배송 조회',
      description: '고객이 배송 상태를 문의하는 경우',
    },
  ],
  policies: [
    {
      id: 'policy-1',
      name: '환불 가능 기간',
      description: '구매일로부터 14일 이내 환불 가능',
      severity: 'HARD',
    },
  ],
  risks: [
    {
      id: 'risk-1',
      name: '고액 환불',
      description: '100만원 이상 환불 요청 시 리뷰 필요',
      level: 'HIGH',
    },
  ],
};

const demoWorkflowTransitions: DemoWorkflowTransition[] = [
  { from: 'INITIAL', to: 'INTENT_DETECTED', on: 'INTENT_DETECTED' },
  { from: 'INTENT_DETECTED', to: 'SLOT_COLLECTING', on: 'SLOT_FILLED' },
  { from: 'SLOT_COLLECTING', to: 'POLICY_CHECKING', on: 'POLICY_CHECKED' },
  { from: 'POLICY_CHECKING', to: 'RISK_CHECKING', on: 'RISK_CHECKED' },
  { from: 'RISK_CHECKING', to: 'DECIDING', on: 'STATE_TRANSITIONED' },
  { from: 'DECIDING', to: 'COMPLETED', on: 'ANSWER_GENERATED' },
  { from: 'DECIDING', to: 'HANDOFF', on: 'HANDOFF_TRIGGERED' },
];

export const demoWorkflow: DemoWorkflow = {
  id: 'workflow-1',
  name: '환불 처리 워크플로우',
  description: '고객 환불 요청을 처리하는 워크플로우',
  states: [
    'INITIAL',
    'INTENT_DETECTED',
    'SLOT_COLLECTING',
    'POLICY_CHECKING',
    'RISK_CHECKING',
    'DECIDING',
    'COMPLETED',
    'HANDOFF',
  ],
  transitions: demoWorkflowTransitions,
};

export const demoChatSession: DemoChatSession = {
  id: 'session-1',
  status: 'completed',
  startedAt: mockTimestamps.startedAt,
  completedAt: mockTimestamps.completedAt,
};

export const demoMessages: DemoChatMessage[] = [
  {
    id: 'msg-1',
    role: 'user',
    content: '제품 환불하고 싶습니다',
    timestamp: mockTimestamps.firstMessage,
  },
  {
    id: 'msg-2',
    role: 'assistant',
    content: '네, 환불 도와드리겠습니다. 주문번호를 알려주세요.',
    timestamp: mockTimestamps.secondMessage,
  },
  {
    id: 'msg-3',
    role: 'user',
    content: '주문번호는 ORD-12345입니다',
    timestamp: mockTimestamps.thirdMessage,
  },
  {
    id: 'msg-4',
    role: 'assistant',
    content: 'ORD-12345 주문에 대한 환불이 완료되었습니다. 14일 이내에 계좌로 입금됩니다.',
    timestamp: mockTimestamps.fourthMessage,
  },
];

const demoPolicyHits: DemoPolicyHit[] = [
  {
    policyId: 'policy-1',
    policyName: '환불 가능 기간',
    result: 'PASS',
    detail: '구매일로부터 14일 이내',
  },
];

const demoRiskHits: DemoRiskHit[] = [
  {
    riskId: 'risk-1',
    riskName: '고액 환불',
    result: 'LOW',
    detail: '환불 금액 59,000원 — 고액 환불 기준 미만',
  },
];

export const demoExecution: DemoExecution = {
  id: 'exec-1',
  status: 'COMPLETED',
  currentState: 'COMPLETED',
  currentNodeId: 'wf-node-final',
  intent: '환불 요청',
  slotValues: {
    orderNumber: 'ORD-12345',
    refundAmount: 59000,
  },
  missingSlots: [],
  policyHits: demoPolicyHits,
  riskHits: demoRiskHits,
};

export const demoDecisionLogs: DemoDecisionLogEntry[] = [
  {
    id: 'log-1',
    step: 1,
    messageId: 'msg-1',
    eventType: 'INTENT_DETECTED',
    stateFrom: 'INITIAL',
    stateTo: 'INTENT_DETECTED',
    decision: 'ALLOW',
    confidence: 0.95,
    reason: '환불 요청 패턴 감지',
  },
  {
    id: 'log-2',
    step: 2,
    messageId: 'msg-3',
    eventType: 'SLOT_FILLED',
    stateFrom: 'INTENT_DETECTED',
    stateTo: 'SLOT_COLLECTING',
    decision: 'ALLOW',
    confidence: 0.88,
    reason: '주문번호 slot 수집 완료',
  },
  {
    id: 'log-3',
    step: 3,
    messageId: 'msg-3',
    eventType: 'POLICY_CHECKED',
    stateFrom: 'SLOT_COLLECTING',
    stateTo: 'POLICY_CHECKING',
    decision: 'ALLOW',
    confidence: 1,
    reason: '환불 가능 기간 정책 통과',
  },
  {
    id: 'log-4',
    step: 4,
    messageId: 'msg-3',
    eventType: 'RISK_CHECKED',
    stateFrom: 'POLICY_CHECKING',
    stateTo: 'RISK_CHECKING',
    decision: 'ALLOW',
    confidence: 0.75,
    reason: '고액 환불 위험 낮음',
  },
  {
    id: 'log-5',
    step: 5,
    messageId: 'msg-4',
    eventType: 'ANSWER_GENERATED',
    stateFrom: 'DECIDING',
    stateTo: 'COMPLETED',
    decision: 'ALLOW',
    confidence: 0.92,
    reason: '환불 완료 안내 생성',
  },
];

export const demoChatWorkflowResponse: DemoChatWorkflowResponse = {
  domainPack: demoDomainPack,
  workflow: demoWorkflow,
  chatSession: demoChatSession,
  messages: demoMessages,
  execution: demoExecution,
  decisionLogs: demoDecisionLogs,
};

export const demoChatWorkflowState: ChatWorkflowDemoState = {
  response: demoChatWorkflowResponse,
  selectedMessageId: null,
  loading: false,
  error: null,
};

export const emptyChatWorkflowState: ChatWorkflowDemoState = {
  response: null,
  selectedMessageId: null,
  loading: false,
  error: null,
};
