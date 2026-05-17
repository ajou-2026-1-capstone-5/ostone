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
  demoMessages,
} from '../model/chatWorkflowDemo.mock';

vi.mock('../lib/workflowAdapter', () => ({
  adaptDemoWorkflow: vi.fn(() => ({ direction: 'LR' as const, nodes: [], edges: [] })),
}));

vi.mock('../lib/messageNodeMapping', () => ({
  getNodeIdsByMessageId: vi.fn(() => []),
  getMessageIdByNodeId: vi.fn(() => null),
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
        activeMessageId="msg-4"
        messages={demoMessages}
        domainPack={demoDomainPack}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByTestId('side-panel')).toBeInTheDocument();
    expect(screen.getByTestId('side-panel-workflow-header')).toBeInTheDocument();
    expect(screen.getByTestId('header-domain-name')).toBeInTheDocument();
    expect(screen.getByTestId('graph-container')).toBeInTheDocument();
    expect(screen.getByTestId('current-turn-insight')).toBeInTheDocument();
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
        activeMessageId="msg-4"
        messages={demoMessages}
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
        activeMessageId="msg-4"
        messages={demoMessages}
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
        activeMessageId="msg-4"
        messages={demoMessages}
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
        activeMessageId="msg-4"
        messages={demoMessages}
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
        activeMessageId="msg-4"
        messages={demoMessages}
        domainPack={demoDomainPack}
      />,
      { wrapper: Wrapper },
    );

    const scrollable = container.querySelector('[class*="overflow"]') || container.querySelector('[style*="overflow"]');
    expect(scrollable).toBeInTheDocument();
  });
});

describe('SidePanel workflow overview', () => {
  it('renders workflow stages when workflow is provided', () => {
    render(
      <SidePanel
        workflow={demoWorkflow}
        execution={demoExecution}
        decisionLogs={demoDecisionLogs}
        selectedMessageId={null}
        activeMessageId="msg-4"
        messages={demoMessages}
        domainPack={demoDomainPack}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByTestId('graph-container')).toBeInTheDocument();
    expect(screen.getByTestId(`workflow-stage-${demoExecution.currentState}`)).toBeInTheDocument();
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
        activeMessageId="msg-4"
        messages={demoMessages}
        domainPack={demoDomainPack}
        onNodeSelect={onNodeSelect}
      />,
      { wrapper: Wrapper },
    );

    await user.click(screen.getByTestId('workflow-stage-INITIAL'));
    expect(onNodeSelect).toHaveBeenCalledWith('INITIAL');
  });
});
