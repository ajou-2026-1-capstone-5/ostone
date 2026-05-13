import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StateMachineGraph } from './StateMachineGraph';
import type { DemoWorkflowTransition, DemoDecisionLogEntry } from '../model/chatWorkflow.types';

const states = ["INITIAL", "INTENT_DETECTED", "COMPLETED"];
const transitions: DemoWorkflowTransition[] = [
  { from: "INITIAL", to: "INTENT_DETECTED", on: "message_received" },
  { from: "INTENT_DETECTED", to: "COMPLETED", on: "process_complete" },
];
const decisionLogs: DemoDecisionLogEntry[] = [
  { id: "l1", step: 1, messageId: "m1", eventType: "STATE_CHANGE", stateFrom: "INITIAL", stateTo: "INTENT_DETECTED", decision: "ALLOW", confidence: 0.95, reason: "Intent matched" },
];

describe('StateMachineGraph', () => {
  it('renders all states', () => {
    render(
      <StateMachineGraph
        states={states}
        transitions={transitions}
        decisionLogs={decisionLogs}
        selectedMessageId={null}
        currentState="INITIAL"
      />
    );

    expect(screen.getByTestId('state-node-INITIAL')).toBeInTheDocument();
    expect(screen.getByTestId('state-node-INTENT_DETECTED')).toBeInTheDocument();
    expect(screen.getByTestId('state-node-COMPLETED')).toBeInTheDocument();
  });

  it('renders transitions as arrows', () => {
    render(
      <StateMachineGraph
        states={states}
        transitions={transitions}
        decisionLogs={decisionLogs}
        selectedMessageId={null}
        currentState="INITIAL"
      />
    );

    const arrows = screen.getAllByTestId('transition-arrow');
    expect(arrows).toHaveLength(2);
  });

  it('highlights current state in green', () => {
    render(
      <StateMachineGraph
        states={states}
        transitions={transitions}
        decisionLogs={decisionLogs}
        selectedMessageId={null}
        currentState="COMPLETED"
      />
    );

    const currentStateNode = screen.getByTestId('state-node-COMPLETED');
    expect(currentStateNode.getAttribute('data-current')).toBe('true');
  });

  it('dims non-matching states when a message is selected', () => {
    render(
      <StateMachineGraph
        states={states}
        transitions={transitions}
        decisionLogs={decisionLogs}
        selectedMessageId="m1"
        currentState="INTENT_DETECTED"
      />
    );

    // The path INITIAL→INTENT_DETECTED matches messageId m1, so both states should NOT be dimmed
    const initialNode = screen.getByTestId('state-node-INITIAL');
    const intentNode = screen.getByTestId('state-node-INTENT_DETECTED');
    const completedNode = screen.getByTestId('state-node-COMPLETED');

    expect(initialNode.getAttribute('data-highlighted')).toBe('true');
    expect(intentNode.getAttribute('data-highlighted')).toBe('true');
    // COMPLETED is not in the matched path → dimmed
    expect(completedNode.getAttribute('data-dimmed')).toBe('true');
  });

  it('shows all states active when no message is selected', () => {
    render(
      <StateMachineGraph
        states={states}
        transitions={transitions}
        decisionLogs={decisionLogs}
        selectedMessageId={null}
        currentState="INITIAL"
      />
    );

    const completedNode = screen.getByTestId('state-node-COMPLETED');
    // Not in selected path, but no selection means no dimming
    expect(completedNode.getAttribute('data-dimmed')).toBe('false');
  });

  it('renders graph container', () => {
    render(
      <StateMachineGraph
        states={states}
        transitions={transitions}
        decisionLogs={decisionLogs}
        selectedMessageId={null}
        currentState="INITIAL"
      />
    );

    expect(screen.getByTestId('graph-container')).toBeInTheDocument();
  });
});
