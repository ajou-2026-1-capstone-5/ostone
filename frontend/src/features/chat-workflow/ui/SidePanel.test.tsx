import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SidePanel } from './SidePanel';
import {
  demoWorkflow,
  demoExecution,
  demoDecisionLogs,
  demoDomainPack,
} from '../model/chatWorkflowDemo.mock';

vi.mock('../lib/workflowAdapter', () => ({
  adaptDemoWorkflow: vi.fn(() => ({ direction: 'LR' as const, nodes: [], edges: [] })),
}));

vi.mock('../lib/messageNodeMapping', () => ({
  getNodeIdsByMessageId: vi.fn(() => []),
  getMessageIdByNodeId: vi.fn(() => null),
}));

vi.mock('@/entities/workflow', () => ({
  GraphRenderer: vi.fn(({ selectedNodeIds, onNodeSelect, currentNodeId }) => (
    <div data-testid="graph-renderer">
      <span data-testid="selected-node-count">{selectedNodeIds?.length ?? 0}</span>
      <span data-testid="current-node-id">{currentNodeId}</span>
      <button data-testid="node-select-btn" onClick={() => onNodeSelect?.('test-node')}>
        Select Node
      </button>
    </div>
  )),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('SidePanel', () => {
  it('renders all sections with data', () => {
    render(
      <SidePanel
        workflow={demoWorkflow}
        execution={demoExecution}
        decisionLogs={demoDecisionLogs}
        selectedMessageId={null}
        domainPack={demoDomainPack}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByTestId('side-panel')).toBeInTheDocument();
    expect(screen.getByTestId('side-panel-workflow-header')).toBeInTheDocument();
    expect(screen.getByTestId('header-domain-name')).toBeInTheDocument();
    expect(screen.getByTestId('graph-container')).toBeInTheDocument();
    expect(screen.getByTestId('execution-status')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /decision log/i })).toBeInTheDocument();
  });

  it('renders correctly when no message selected (null)', () => {
    render(
      <SidePanel
        workflow={demoWorkflow}
        execution={demoExecution}
        decisionLogs={demoDecisionLogs}
        selectedMessageId={null}
        domainPack={demoDomainPack}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByTestId('side-panel')).toBeInTheDocument();
    expect(screen.getByTestId('graph-container')).toBeInTheDocument();
    expect(screen.getByTestId('execution-status')).toBeInTheDocument();
  });

  it('renders with selected message', () => {
    render(
      <SidePanel
        workflow={demoWorkflow}
        execution={demoExecution}
        decisionLogs={demoDecisionLogs}
        selectedMessageId="msg-1"
        domainPack={demoDomainPack}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByTestId('side-panel')).toBeInTheDocument();
    expect(screen.getByTestId('graph-container')).toBeInTheDocument();
    expect(screen.getByTestId('execution-status')).toBeInTheDocument();
    expect(screen.getByTestId('header-domain-name')).toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: /decision log/i });
    expect(toggle).toBeInTheDocument();
  });

  it('renders with null domainPack', () => {
    render(
      <SidePanel
        workflow={demoWorkflow}
        execution={demoExecution}
        decisionLogs={demoDecisionLogs}
        selectedMessageId={null}
        domainPack={null}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByTestId('side-panel')).toBeInTheDocument();
    expect(screen.getByTestId('side-panel-workflow-header')).toBeInTheDocument();
    expect(screen.queryByTestId('header-domain-name')).not.toBeInTheDocument();
  });

  it('renders with null execution', () => {
    render(
      <SidePanel
        workflow={demoWorkflow}
        execution={null}
        decisionLogs={demoDecisionLogs}
        selectedMessageId={null}
        domainPack={demoDomainPack}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByTestId('side-panel')).toBeInTheDocument();
    expect(screen.getByText('Waiting for execution...')).toBeInTheDocument();
  });

  it('renders scrollable container when content overflows', () => {
    const { container } = render(
      <SidePanel
        workflow={demoWorkflow}
        execution={demoExecution}
        decisionLogs={demoDecisionLogs}
        selectedMessageId={null}
        domainPack={demoDomainPack}
      />,
      { wrapper: Wrapper },
    );

    const scrollable = container.querySelector('[class*="overflow"]') || container.querySelector('[style*="overflow"]');
    expect(scrollable).toBeInTheDocument();
  });
});

describe('SidePanel with GraphRenderer', () => {
  it('renders graph-container when workflow is provided', () => {
    render(
      <SidePanel
        workflow={demoWorkflow}
        execution={demoExecution}
        decisionLogs={demoDecisionLogs}
        selectedMessageId={null}
        domainPack={demoDomainPack}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByTestId('graph-container')).toBeInTheDocument();
    expect(screen.getByTestId('current-node-id')).toHaveTextContent(demoExecution.currentState || '');
  });

  it('passes onNodeSelect when provided', async () => {
    const user = userEvent.setup();
    const onNodeSelect = vi.fn();
    render(
      <SidePanel
        workflow={demoWorkflow}
        execution={demoExecution}
        decisionLogs={demoDecisionLogs}
        selectedMessageId={null}
        domainPack={demoDomainPack}
        onNodeSelect={onNodeSelect}
      />,
      { wrapper: Wrapper },
    );
    
    await user.click(screen.getByTestId('node-select-btn'));
    expect(onNodeSelect).toHaveBeenCalledWith('test-node');
  });
});
