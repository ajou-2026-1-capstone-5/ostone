import { describe, expect, it } from 'vitest';
import type {
  ChatWorkflowDemoState,
  DemoChatMessage,
  DemoChatWorkflowResponse,
  DemoDecisionLogEntry,
  DemoExecution,
} from './chatWorkflow.types';

describe('chatWorkflow types', () => {
  it('DemoChatMessage는 메시지 식별자, 역할, 본문, 시간을 가진다', () => {
    const messages: DemoChatMessage[] = [
      { id: 'msg-1', role: 'user', content: '문의', timestamp: '2026-05-10T09:00:00Z' },
      { id: 'msg-2', role: 'assistant', content: '답변', timestamp: '2026-05-10T09:00:15Z' },
    ];

    expect(messages.map((message) => Object.keys(message))).toEqual([
      ['id', 'role', 'content', 'timestamp'],
      ['id', 'role', 'content', 'timestamp'],
    ]);
    expect(messages.map((message) => message.role)).toEqual(['user', 'assistant']);
    expect(messages.every(({ id, content, timestamp }) => [id, content, timestamp].every((value) => typeof value === 'string'))).toBe(true);
  });

  it('DemoDecisionLogEntry는 상태 전이와 판단 근거 필드를 가진다', () => {
    const entry: DemoDecisionLogEntry = {
      id: 'log-1',
      step: 1,
      messageId: 'msg-1',
      eventType: 'INTENT_DETECTED',
      stateFrom: 'INITIAL',
      stateTo: 'INTENT_DETECTED',
      decision: 'ALLOW',
      confidence: 0.95,
      reason: '환불 요청 패턴 감지',
    };

    expect(Object.keys(entry)).toEqual([
      'id',
      'step',
      'messageId',
      'eventType',
      'stateFrom',
      'stateTo',
      'decision',
      'confidence',
      'reason',
    ]);
    expect(typeof entry.step).toBe('number');
    expect(typeof entry.confidence).toBe('number');
  });

  it('DemoExecution은 slot, policy hit, risk hit 실행 결과를 포함한다', () => {
    const execution: DemoExecution = {
      id: 'exec-1',
      status: 'COMPLETED',
      currentState: 'COMPLETED',
      currentNodeId: 'wf-node-final',
      intent: '환불 요청',
      slotValues: { orderNumber: 'ORD-12345', refundAmount: 59000 },
      missingSlots: [],
      policyHits: [
        {
          policyId: 'policy-1',
          policyName: '환불 가능 기간',
          result: 'PASS',
          detail: '구매일로부터 14일 이내',
        },
      ],
      riskHits: [
        {
          riskId: 'risk-1',
          riskName: '고액 환불',
          result: 'LOW',
          detail: '고액 환불 기준 미만',
        },
      ],
    };

    expect(Array.isArray(execution.missingSlots)).toBe(true);
    expect(execution.policyHits[0]).toHaveProperty('policyId');
    expect(execution.riskHits[0]).toHaveProperty('riskId');
  });

  it('DemoChatWorkflowResponse는 4.1.5 응답의 6개 하위 필드를 가진다', () => {
    const response: DemoChatWorkflowResponse = {
      domainPack: {
        id: 'demo-pack-1',
        name: 'CS Support Domain Pack',
        version: '1.0.0',
        status: 'PUBLISHED',
        intents: [{ id: 'intent-1', name: '환불 요청', description: '고객이 제품 환불을 요청하는 경우' }],
        policies: [{ id: 'policy-1', name: '환불 가능 기간', description: '14일 이내 환불 가능', severity: 'HARD' }],
        risks: [{ id: 'risk-1', name: '고액 환불', description: '100만원 이상 환불 요청', level: 'HIGH' }],
      },
      workflow: {
        id: 'workflow-1',
        name: '환불 처리 워크플로우',
        description: '고객 환불 요청을 처리하는 워크플로우',
        states: ['INITIAL', 'COMPLETED'],
        transitions: [{ from: 'INITIAL', to: 'COMPLETED', on: 'ANSWER_GENERATED' }],
      },
      chatSession: {
        id: 'session-1',
        status: 'completed',
        startedAt: '2026-05-10T09:00:00Z',
        completedAt: '2026-05-10T09:05:30Z',
      },
      messages: [{ id: 'msg-1', role: 'user', content: '제품 환불하고 싶습니다', timestamp: '2026-05-10T09:00:00Z' }],
      execution: {
        id: 'exec-1',
        status: 'COMPLETED',
        currentState: 'COMPLETED',
        currentNodeId: 'wf-node-final',
        intent: '환불 요청',
        slotValues: {},
        missingSlots: [],
        policyHits: [],
        riskHits: [],
      },
      decisionLogs: [],
    };

    expect(Object.keys(response)).toEqual(['domainPack', 'workflow', 'chatSession', 'messages', 'execution', 'decisionLogs']);
  });

  it('ChatWorkflowDemoState는 응답 선택 상태와 로딩 상태를 가진다', () => {
    const state: ChatWorkflowDemoState = {
      response: null,
      selectedMessageId: null,
      loading: false,
      error: null,
    };

    expect(Object.keys(state)).toEqual(['response', 'selectedMessageId', 'loading', 'error']);
  });

  it('ScenarioInfo는 더 이상 export하지 않는다', async () => {
    const module = await import('./chatWorkflow.types');

    expect(module).not.toHaveProperty('ScenarioInfo');
  });
});
