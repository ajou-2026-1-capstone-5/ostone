import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockUseGetChatWorkflow = vi.hoisted(() => vi.fn());
const mockUseParams = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: mockUseParams,
  };
});

vi.mock('@/shared/api/generated/endpoints/demo-runtime-controller/demo-runtime-controller', () => ({
  useGetChatWorkflow: mockUseGetChatWorkflow,
}));

vi.mock('./ChatWorkflowDemoPage', () => ({
  ChatWorkflowDemoPage: vi.fn(
    ({ state }: { state: { loading: boolean; error: string | null; response: unknown } }) => (
      <div data-testid="chat-workflow-demo-page">
        {state.loading && <div data-testid="loading-state">Loading...</div>}
        {state.error && <div data-testid="error-state">{state.error}</div>}
        {!state.loading && !state.error && !!state.response && (
          <div data-testid="page-container" />
        )}
      </div>
    ),
  ),
}));

import { ChatWorkflowDemoPageWrapper } from './ChatWorkflowDemoPageWrapper';

function renderPage() {
  return render(
    <MemoryRouter>
      <ChatWorkflowDemoPageWrapper />
    </MemoryRouter>,
  );
}

describe('ChatWorkflowDemoPageWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders error when workspaceId is invalid (null/undefined)', () => {
    mockUseParams.mockReturnValue({ workspaceId: undefined });
    renderPage();

    expect(screen.getByTestId('chat-workflow-demo-page')).toBeInTheDocument();
    expect(screen.getByTestId('error-state')).toHaveTextContent(
      '유효하지 않은 workspaceId입니다.',
    );
  });

  it('renders loading state when hook is loading', () => {
    mockUseParams.mockReturnValue({ workspaceId: '123' });
    mockUseGetChatWorkflow.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    renderPage();

    expect(screen.getByTestId('chat-workflow-demo-page')).toBeInTheDocument();
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
  });

  it('renders error state when hook returns error', () => {
    mockUseParams.mockReturnValue({ workspaceId: '123' });
    mockUseGetChatWorkflow.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('API error'),
    });
    renderPage();

    expect(screen.getByTestId('chat-workflow-demo-page')).toBeInTheDocument();
    expect(screen.getByTestId('error-state')).toHaveTextContent('Error: API error');
  });

  it('renders with response data on successful fetch', () => {
    mockUseParams.mockReturnValue({ workspaceId: '123' });
    const mockResponseData = {
      domainPack: {
        id: 'dp-1',
        name: 'Test Domain Pack',
        version: '1.0.0',
        status: 'PUBLISHED',
        intents: [],
        policies: [],
        risks: [],
      },
      workflow: {
        id: 'wf-1',
        name: 'Test Workflow',
        description: 'A test workflow',
        states: ['INITIAL', 'COMPLETED'],
        transitions: [{ from: 'INITIAL', to: 'COMPLETED', on: 'done' }],
      },
      chatSession: { id: 'cs-1', status: 'active', startedAt: '', completedAt: undefined },
      messages: [],
      execution: null,
      decisionLogs: [],
    };

    mockUseGetChatWorkflow.mockReturnValue({
      data: { data: mockResponseData },
      isLoading: false,
      error: null,
    });
    renderPage();

    expect(screen.getByTestId('chat-workflow-demo-page')).toBeInTheDocument();
    expect(screen.getByTestId('page-container')).toBeInTheDocument();
  });
});
