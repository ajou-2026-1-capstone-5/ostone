import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChatWorkflowDemoPage } from './ChatWorkflowDemoPage';
import type { ChatWorkflowDemoState } from '@/features/chat-workflow';

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

function fullState(): ChatWorkflowDemoState {
  return { response: mockResponse, selectedMessageId: null, loading: false, error: null };
}

function emptyState(): ChatWorkflowDemoState {
  return { response: null, selectedMessageId: null, loading: false, error: null };
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('ChatWorkflowDemoPage', () => {
  it('renders header with domain pack name', () => {
    render(<ChatWorkflowDemoPage state={fullState()} />, { wrapper: Wrapper });
    const headers = screen.getAllByTestId('header-domain-name');
    expect(headers.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('page-container')).toBeInTheDocument();
  });

  it('renders timeline and side panel containers', () => {
    render(<ChatWorkflowDemoPage state={fullState()} />, { wrapper: Wrapper });
    expect(screen.getByTestId('chat-timeline')).toBeInTheDocument();
    expect(screen.getByTestId('side-panel-container')).toBeInTheDocument();
  });

  it('renders empty state when no workflow data', () => {
    render(<ChatWorkflowDemoPage state={emptyState()} />, { wrapper: Wrapper });
    expect(screen.getByText('No workflow data available')).toBeInTheDocument();
  });

  it('renders side panel when workflow data provided', () => {
    render(<ChatWorkflowDemoPage state={fullState()} />, { wrapper: Wrapper });
    expect(screen.getByRole('button', { name: /decision log/i })).toBeInTheDocument();
  });

  it('renders timeline messages with initial null selectedMessageId', () => {
    render(<ChatWorkflowDemoPage state={fullState()} />, { wrapper: Wrapper });
    expect(screen.getByTestId('chat-message-msg-1')).toBeInTheDocument();
  });

  it('header shows domain pack name from response', () => {
    render(<ChatWorkflowDemoPage state={fullState()} />, { wrapper: Wrapper });
    const headers = screen.getAllByTestId('header-domain-name');
    expect(headers[0]).toHaveTextContent('Test Domain Pack');
  });
});
