import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChatWorkflowDemoPage } from './ChatWorkflowDemoPage';
import type { ChatWorkflowDemoState } from '@/features/chat-workflow';

// Mocks must be at top level — hoisted before imports
vi.mock('@/features/chat-workflow/ui/ChatTimelinePanel', () => ({
  ChatTimelinePanel: vi.fn(({ onMessageSelect, selectedMessageId }) => (
    <div data-testid="chat-timeline">
      <span data-testid="selected-message">{selectedMessageId ?? 'none'}</span>
      <button
        data-testid="mock-message-btn"
        onClick={() => onMessageSelect?.('msg-1')}
      >
        Select Message
      </button>
    </div>
  )),
}));

vi.mock('@/features/chat-workflow/ui/SidePanel', () => ({
  SidePanel: vi.fn(({ onNodeSelect, selectedMessageId }) => (
    <div data-testid="side-panel">
      <span data-testid="selected-node-message">{selectedMessageId ?? 'none'}</span>
      <button
        data-testid="mock-node-btn"
        onClick={() => onNodeSelect?.('INITIAL')}
      >
        Select Node
      </button>
    </div>
  )),
}));

vi.mock('@/features/chat-workflow/lib/messageNodeMapping', () => ({
  getMessageIdByNodeId: vi.fn((nodeId: string) => {
    if (nodeId === 'INITIAL') return 'msg-1';
    return null;
  }),
  getNodeIdsByMessageId: vi.fn(() => []),
}));

vi.mock('@/features/chat-workflow/lib/workflowAdapter', () => ({
  adaptDemoWorkflow: vi.fn(() => ({
    direction: 'LR' as const,
    nodes: [{ id: 'INITIAL', label: 'INITIAL', type: 'ACTION' as const }],
    edges: [],
  })),
}));

const mockDomainPack = {
  id: 'dp-1',
  name: 'Test Domain Pack',
  version: '1.0.0',
  status: 'PUBLISHED',
  intents: [],
  policies: [],
  risks: [],
};

const mockWorkflow = {
  id: 'wf-1',
  name: 'Test Workflow',
  description: 'A test workflow',
  states: ['INITIAL', 'COMPLETED'],
  transitions: [{ from: 'INITIAL', to: 'COMPLETED', on: 'done' }],
};

const mockMessages = [
  {
    id: 'msg-1',
    role: 'user' as const,
    content: 'Hello',
    timestamp: '2026-05-13T10:00:00.000Z',
  },
];

const mockExecution = {
  id: 'exec-1',
  status: 'completed',
  currentState: 'COMPLETED',
  currentNodeId: 'node-1',
  intent: 'test',
  slotValues: {},
  missingSlots: [],
  policyHits: [],
  riskHits: [],
};

const mockDecisionLogs = [
  {
    id: 'log-1',
    step: 1,
    messageId: 'msg-1',
    eventType: 'state_change',
    stateFrom: 'INITIAL',
    stateTo: 'COMPLETED',
    decision: 'ALLOW',
    confidence: 95,
    reason: 'ok',
  },
];

const mockResponse = {
  domainPack: mockDomainPack,
  workflow: mockWorkflow,
  messages: mockMessages,
  execution: mockExecution,
  decisionLogs: mockDecisionLogs,
  chatSession: { id: 'cs-1', status: 'active', startedAt: '', completedAt: undefined },
};

function syncState(): ChatWorkflowDemoState {
  return { response: mockResponse, selectedMessageId: null, loading: false, error: null };
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('ChatWorkflowDemoPage bidirectional sync', () => {
  it('node click updates selectedMessageId via getMessageIdByNodeId', () => {
    render(<ChatWorkflowDemoPage state={syncState()} />, { wrapper: Wrapper });

    expect(screen.getByTestId('selected-node-message')).toHaveTextContent('none');
    expect(screen.getByTestId('selected-message')).toHaveTextContent('none');

    fireEvent.click(screen.getByTestId('mock-node-btn'));

    expect(screen.getByTestId('selected-node-message')).toHaveTextContent('msg-1');
    expect(screen.getByTestId('selected-message')).toHaveTextContent('msg-1');
  });

  it('message click updates selectedMessageId in side panel', () => {
    render(<ChatWorkflowDemoPage state={syncState()} />, { wrapper: Wrapper });

    expect(screen.getByTestId('selected-message')).toHaveTextContent('none');
    expect(screen.getByTestId('selected-node-message')).toHaveTextContent('none');

    fireEvent.click(screen.getByTestId('mock-message-btn'));

    expect(screen.getByTestId('selected-message')).toHaveTextContent('msg-1');
    expect(screen.getByTestId('selected-node-message')).toHaveTextContent('msg-1');
  });

  it('maintains consistent state after multiple selections', () => {
    render(<ChatWorkflowDemoPage state={syncState()} />, { wrapper: Wrapper });

    // Initial: no selection
    expect(screen.getByTestId('selected-message')).toHaveTextContent('none');
    expect(screen.getByTestId('selected-node-message')).toHaveTextContent('none');

    // Click message → both show msg-1
    fireEvent.click(screen.getByTestId('mock-message-btn'));
    expect(screen.getByTestId('selected-message')).toHaveTextContent('msg-1');
    expect(screen.getByTestId('selected-node-message')).toHaveTextContent('msg-1');

    // Click node → still msg-1 (same mapping)
    fireEvent.click(screen.getByTestId('mock-node-btn'));
    expect(screen.getByTestId('selected-message')).toHaveTextContent('msg-1');
    expect(screen.getByTestId('selected-node-message')).toHaveTextContent('msg-1');

    // Click message again → no crash, state consistent
    fireEvent.click(screen.getByTestId('mock-message-btn'));
    expect(screen.getByTestId('selected-message')).toHaveTextContent('msg-1');
    expect(screen.getByTestId('selected-node-message')).toHaveTextContent('msg-1');

    // Page container still renders — no error state
    expect(screen.getByTestId('page-container')).toBeInTheDocument();
  });
});
