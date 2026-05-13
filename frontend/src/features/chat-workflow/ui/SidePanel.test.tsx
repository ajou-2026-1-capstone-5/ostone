import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SidePanel } from './SidePanel';
import {
  demoWorkflow,
  demoExecution,
  demoDecisionLogs,
  demoDomainPack,
} from '../model/chatWorkflowDemo.mock';
import type { DemoExecution } from '../model/chatWorkflow.types';

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
        execution={null as unknown as DemoExecution}
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
