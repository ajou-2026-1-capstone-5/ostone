import { describe, expect, it } from 'vitest';
import {
  demoChatWorkflowState,
  demoDecisionLog,
  demoMessages,
  demoWorkflowState,
  emptyChatWorkflowState,
} from './chatWorkflowDemo.mock';

describe('chatWorkflowDemo mock data', () => {
  it('demoMessages는 최소 3개 메시지를 가지며 첫 메시지는 사용자 발화이다', () => {
    expect(demoMessages.length).toBeGreaterThanOrEqual(3);
    expect(demoMessages[0]?.role).toBe('user');
  });

  it('demoWorkflowState는 실행 중인 워크플로우 노드를 가진다', () => {
    expect(demoWorkflowState.status).toBe('running');
    expect(demoWorkflowState.currentNodeId).not.toBeNull();
  });

  it('demoDecisionLog는 최소 2개 엔트리와 문자열 설명 필드를 가진다', () => {
    expect(demoDecisionLog.length).toBeGreaterThanOrEqual(2);
    expect(demoDecisionLog.every(({ step, action, reason }) => [step, action, reason].every((value) => typeof value === 'string'))).toBe(true);
  });

  it('demoChatWorkflowState는 모든 하위 필드를 포함한다', () => {
    expect(demoChatWorkflowState.messages).toBeDefined();
    expect(demoChatWorkflowState.workflow).toBeDefined();
    expect(demoChatWorkflowState.decisionLog).toBeDefined();
    expect(demoChatWorkflowState.domainPack).toBeDefined();
    expect(demoChatWorkflowState.scenario).toBeDefined();
  });

  it('emptyChatWorkflowState는 빈 대화와 idle 워크플로우를 가진다', () => {
    expect(emptyChatWorkflowState.messages).toEqual([]);
    expect(emptyChatWorkflowState.workflow.status).toBe('idle');
    expect(emptyChatWorkflowState.decisionLog).toEqual([]);
  });
});
