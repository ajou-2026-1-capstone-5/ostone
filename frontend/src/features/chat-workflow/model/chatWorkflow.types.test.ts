import { describe, expect, it } from 'vitest';
import type {
  ChatMessage,
  ChatWorkflowDemoState,
  DecisionLogEntry,
  WorkflowState,
} from './chatWorkflow.types';

describe('chatWorkflow types', () => {
  it('ChatMessage는 허용된 role과 문자열 필드를 가진다', () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: '문의', timestamp: '2026-05-12T09:00:00.000Z' },
      { id: '2', role: 'assistant', content: '답변', timestamp: '2026-05-12T09:00:01.000Z' },
      { id: '3', role: 'system', content: '상태', timestamp: '2026-05-12T09:00:02.000Z' },
    ];

    expect(messages.map((message) => message.role)).toEqual(['user', 'assistant', 'system']);
    expect(messages.every(({ id, content, timestamp }) => [id, content, timestamp].every((value) => typeof value === 'string'))).toBe(true);
  });

  it('WorkflowState는 허용된 status와 실행 컨텍스트를 가진다', () => {
    const states: WorkflowState[] = [
      { currentNodeId: null, status: 'idle', context: {} },
      { currentNodeId: 'node-1', status: 'running', context: { step: 1 } },
      { currentNodeId: 'node-2', status: 'completed', context: { done: true } },
      { currentNodeId: 'node-3', status: 'error', context: { code: 'FAILED' } },
    ];

    expect(states.map((state) => state.status)).toEqual(['idle', 'running', 'completed', 'error']);
    expect(states.every((state) => typeof state.context === 'object')).toBe(true);
  });

  it('DecisionLogEntry는 모든 표시 필드가 문자열이다', () => {
    const entry: DecisionLogEntry = {
      id: 'decision-1',
      step: 'intent-routing',
      action: 'select-workflow',
      reason: '의도가 일치합니다.',
      timestamp: '2026-05-12T09:00:00.000Z',
    };

    expect(Object.values(entry).every((value) => typeof value === 'string')).toBe(true);
  });

  it('ChatWorkflowDemoState는 메시지, 워크플로우, 결정 로그를 포함한다', () => {
    const state: ChatWorkflowDemoState = {
      messages: [],
      workflow: { currentNodeId: null, status: 'idle', context: {} },
      decisionLog: [],
      domainPack: null,
      scenario: null,
    };

    expect(state).toHaveProperty('messages');
    expect(state).toHaveProperty('workflow');
    expect(state).toHaveProperty('decisionLog');
  });
});
