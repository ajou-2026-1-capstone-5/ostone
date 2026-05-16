import { describe, it, expect } from 'vitest';
import { getNodeIdsByMessageId, getMessageIdByNodeId } from './messageNodeMapping';
import { demoDecisionLogs } from '../model/chatWorkflowDemo.mock';
import type { WorkflowGraph } from '@/entities/workflow';

const stubGraph: WorkflowGraph = {
  direction: 'LR',
  nodes: [
    { id: 'INITIAL', label: 'INITIAL', type: 'ACTION' },
    { id: 'INTENT_DETECTED', label: 'INTENT_DETECTED', type: 'ACTION' },
    { id: 'SLOT_COLLECTING', label: 'SLOT_COLLECTING', type: 'ACTION' },
    { id: 'POLICY_CHECKING', label: 'POLICY_CHECKING', type: 'ACTION' },
    { id: 'RISK_CHECKING', label: 'RISK_CHECKING', type: 'ACTION' },
    { id: 'DECIDING', label: 'DECIDING', type: 'ACTION' },
    { id: 'COMPLETED', label: 'COMPLETED', type: 'ACTION' },
    { id: 'HANDOFF', label: 'HANDOFF', type: 'ACTION' },
  ],
  edges: [],
};

describe('getNodeIdsByMessageId', () => {
  it('returns node ids matching the decision log entry states for a given messageId', () => {
    const result = getNodeIdsByMessageId('msg-1', demoDecisionLogs, stubGraph);
    expect(result).toContain('INITIAL');
    expect(result).toContain('INTENT_DETECTED');
    expect(result.length).toBe(2);
  });

  it('returns multiple nodes when multiple logs reference the same messageId', () => {
    const result = getNodeIdsByMessageId('msg-3', demoDecisionLogs, stubGraph);
    expect(result).toContain('INTENT_DETECTED');
    expect(result).toContain('SLOT_COLLECTING');
    expect(result).toContain('POLICY_CHECKING');
    expect(result).toContain('RISK_CHECKING');
    expect(result.length).toBe(4);
  });

  it('returns empty array for unknown messageId', () => {
    const result = getNodeIdsByMessageId('unknown-msg', demoDecisionLogs, stubGraph);
    expect(result).toEqual([]);
  });

  it('returns empty array for empty logs', () => {
    const result = getNodeIdsByMessageId('msg-1', [], stubGraph);
    expect(result).toEqual([]);
  });
});

describe('getMessageIdByNodeId', () => {
  it('returns messageId for a node that appears as stateFrom in decision logs', () => {
    const result = getMessageIdByNodeId('INITIAL', demoDecisionLogs, stubGraph);
    expect(result).toBe('msg-1');
  });

  it('returns messageId for a node that appears as stateTo in decision logs', () => {
    const result = getMessageIdByNodeId('INTENT_DETECTED', demoDecisionLogs, stubGraph);
    expect(result).toBe('msg-1');
  });

  it('returns null for unknown nodeId', () => {
    const result = getMessageIdByNodeId('UNKNOWN_NODE', demoDecisionLogs, stubGraph);
    expect(result).toBeNull();
  });

  it('returns null for empty logs', () => {
    const result = getMessageIdByNodeId('INITIAL', [], stubGraph);
    expect(result).toBeNull();
  });
});

describe('getNodeIdsByMessageId edge cases', () => {
  const smallGraph: WorkflowGraph = {
    direction: 'LR',
    nodes: [
      { id: 'A', label: 'A', type: 'ACTION' },
      { id: 'B', label: 'B', type: 'ACTION' },
      { id: 'C', label: 'C', type: 'ACTION' },
    ],
    edges: [],
  };

  it('returns unique node ids even when multiple logs match same states', () => {
    const logs = [
      { id: 'l1', step: 1, messageId: 'msg-1', eventType: 'X', stateFrom: 'A', stateTo: 'B', decision: 'ALLOW', confidence: 100, reason: '' },
      { id: 'l2', step: 2, messageId: 'msg-1', eventType: 'X', stateFrom: 'A', stateTo: 'B', decision: 'ALLOW', confidence: 100, reason: '' },
    ];
    const result = getNodeIdsByMessageId('msg-1', logs, smallGraph);
    expect(result.length).toBe(2);
    expect(result).toEqual(['A', 'B']);
  });

  it('returns empty array for empty decision logs regardless of messageId', () => {
    const result = getNodeIdsByMessageId('msg-1', [], smallGraph);
    expect(result).toEqual([]);
  });

  it('filters out states not present in graph', () => {
    const logs = [
      { id: 'l1', step: 1, messageId: 'msg-1', eventType: 'X', stateFrom: 'A', stateTo: 'Z', decision: 'ALLOW', confidence: 100, reason: '' },
    ];
    const result = getNodeIdsByMessageId('msg-1', logs, smallGraph);
    expect(result).toEqual(['A']);
  });
});

describe('getMessageIdByNodeId edge cases', () => {
  const smallGraph: WorkflowGraph = {
    direction: 'LR',
    nodes: [
      { id: 'A', label: 'A', type: 'ACTION' },
      { id: 'B', label: 'B', type: 'ACTION' },
      { id: 'C', label: 'C', type: 'ACTION' },
    ],
    edges: [],
  };

  it('returns null for node existing in graph but not in logs', () => {
    const logs = [
      { id: 'l1', step: 1, messageId: 'msg-1', eventType: 'X', stateFrom: 'A', stateTo: 'B', decision: 'ALLOW', confidence: 100, reason: '' },
    ];
    const result = getMessageIdByNodeId('C', logs, smallGraph);
    expect(result).toBeNull();
  });

  it('returns null for nodeId not in graph even if present in logs', () => {
    const logs = [
      { id: 'l1', step: 1, messageId: 'msg-1', eventType: 'X', stateFrom: 'A', stateTo: 'Z', decision: 'ALLOW', confidence: 100, reason: '' },
    ];
    const result = getMessageIdByNodeId('Z', logs, smallGraph);
    expect(result).toBeNull();
  });
});
