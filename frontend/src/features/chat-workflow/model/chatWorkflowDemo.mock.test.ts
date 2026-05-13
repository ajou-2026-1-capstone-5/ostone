import { describe, expect, it } from 'vitest';
import {
  demoChatWorkflowState,
  demoDecisionLogs,
  demoDomainPack,
  demoMessages,
  demoWorkflow,
  emptyChatWorkflowState,
} from './chatWorkflowDemo.mock';

describe('chatWorkflowDemo mock data', () => {
  it('demoMessages는 4개 메시지를 가지며 첫 메시지는 사용자 발화이다', () => {
    expect(demoMessages).toHaveLength(4);
    expect(demoMessages[0]?.id).toBe('msg-1');
    expect(demoMessages[0]?.role).toBe('user');
  });

  it('demoWorkflow는 8개 상태와 7개 전이를 가진다', () => {
    expect(demoWorkflow.states).toHaveLength(8);
    expect(demoWorkflow.transitions).toHaveLength(7);
    expect(demoWorkflow.states).toContain('COMPLETED');
  });

  it('demoDecisionLogs는 5개 로그와 메시지 및 상태 연결 필드를 가진다', () => {
    expect(demoDecisionLogs).toHaveLength(5);
    expect(demoDecisionLogs.every(({ messageId, stateFrom, stateTo }) => messageId && stateFrom && stateTo)).toBe(true);
  });

  it('demoDomainPack은 intent, policy, risk fixture를 포함한다', () => {
    expect(demoDomainPack.intents.length).toBeGreaterThanOrEqual(1);
    expect(demoDomainPack.policies.length).toBeGreaterThanOrEqual(1);
    expect(demoDomainPack.risks.length).toBeGreaterThanOrEqual(1);
  });

  it('demoChatWorkflowState는 응답과 선택 및 로딩 상태를 포함한다', () => {
    expect(demoChatWorkflowState.response).toBeDefined();
    expect(demoChatWorkflowState.response?.messages).toBe(demoMessages);
    expect(demoChatWorkflowState.response?.decisionLogs).toBe(demoDecisionLogs);
    expect(demoChatWorkflowState.selectedMessageId).toBeNull();
    expect(demoChatWorkflowState.loading).toBe(false);
    expect(demoChatWorkflowState.error).toBeNull();
  });

  it('emptyChatWorkflowState는 비어 있는 응답과 기본 상태를 가진다', () => {
    expect(emptyChatWorkflowState.response).toBeNull();
    expect(emptyChatWorkflowState.selectedMessageId).toBeNull();
    expect(emptyChatWorkflowState.loading).toBe(false);
    expect(emptyChatWorkflowState.error).toBeNull();
  });
});
