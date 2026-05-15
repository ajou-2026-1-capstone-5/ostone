import { describe, it, expect } from 'vitest';
import { adaptDemoWorkflow } from './workflowAdapter';
import { demoWorkflow } from '../model/chatWorkflowDemo.mock';

describe('adaptDemoWorkflow', () => {
  it('converts DemoWorkflow to WorkflowGraph with nodes and edges', () => {
    const result = adaptDemoWorkflow(demoWorkflow);
    expect(result.nodes.length).toBe(demoWorkflow.states.length);
    expect(result.edges.length).toBe(demoWorkflow.transitions.length);
    expect(result.direction).toBe('LR');
  });

  it('each node has id, label, type', () => {
    const result = adaptDemoWorkflow(demoWorkflow);
    for (const node of result.nodes) {
      expect(node.id).toBeTruthy();
      expect(node.label).toBeTruthy();
      expect(node.type).toBeDefined();
    }
  });

  it('each edge references valid node ids', () => {
    const result = adaptDemoWorkflow(demoWorkflow);
    const nodeIds = new Set(result.nodes.map((n) => n.id));
    for (const edge of result.edges) {
      expect(nodeIds.has(edge.from)).toBe(true);
      expect(nodeIds.has(edge.to)).toBe(true);
    }
  });

  it('returns empty nodes/edges for null/undefined input', () => {
    expect(adaptDemoWorkflow(null)).toEqual({ direction: 'LR', nodes: [], edges: [] });
    expect(adaptDemoWorkflow(undefined)).toEqual({ direction: 'LR', nodes: [], edges: [] });
  });

  it('returns empty nodes/edges for empty states array', () => {
    const empty = { id: '', name: '', description: '', states: [], transitions: [] };
    const result = adaptDemoWorkflow(empty);
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it('handles transitions referencing non-existent states', () => {
    const wk = {
      id: 'test',
      name: 'test',
      description: '',
      states: ['A', 'B'],
      transitions: [{ from: 'A', to: 'Z', on: 'unknown' }],
    };
    const result = adaptDemoWorkflow(wk);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].to).toBe('Z');
    expect(result.nodes).toHaveLength(2);
  });

  it('handles states that appear in transitions but not in states array', () => {
    const wk = {
      id: 'test',
      name: 'test',
      description: '',
      states: ['A', 'B'],
      transitions: [{ from: 'A', to: 'C', on: 'go' }],
    };
    const result = adaptDemoWorkflow(wk);
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
  });

  it('handles empty transitions array', () => {
    const wk = {
      id: 'test',
      name: 'test',
      description: '',
      states: ['A', 'B'],
      transitions: [],
    };
    const result = adaptDemoWorkflow(wk);
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(0);
  });

  it('handles large workflow without error', () => {
    const manyStates = Array.from({ length: 100 }, (_, i) => `STATE_${i}`);
    const manyTransitions = Array.from({ length: 50 }, (_, i) => ({
      from: `STATE_${i}`,
      to: `STATE_${i + 1}`,
      on: `transition_${i}`,
    }));
    const wk = {
      id: 'large',
      name: 'large',
      description: '',
      states: manyStates,
      transitions: manyTransitions,
    };
    const result = adaptDemoWorkflow(wk);
    expect(result.nodes).toHaveLength(100);
    expect(result.edges).toHaveLength(50);
  });

  it('handles transition with empty on value', () => {
    const wk = {
      id: 'test',
      name: 'test',
      description: '',
      states: ['A', 'B'],
      transitions: [{ from: 'A', to: 'B', on: '' }],
    };
    const result = adaptDemoWorkflow(wk);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].label).toBe('');
  });
});
