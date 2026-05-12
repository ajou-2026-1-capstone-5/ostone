import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkflowGraphPanel } from './WorkflowGraphPanel';

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('WorkflowGraphPanel', () => {
  it('renders title "Workflow Graph"', () => {
    render(<WorkflowGraphPanel workflowState={{ currentNodeId: null, status: 'idle', context: {} }} />, { wrapper: Wrapper });
    expect(screen.getByText('Workflow Graph')).toBeInTheDocument();
  });

  it('renders placeholder when no active node', () => {
    render(<WorkflowGraphPanel workflowState={{ currentNodeId: null, status: 'idle', context: {} }} />, { wrapper: Wrapper });
    expect(screen.getByText(/no active node/i)).toBeInTheDocument();
  });

  it('renders current node when provided', () => {
    const workflowState = { currentNodeId: 'collect-order-number', status: 'running' as const, context: {} };
    render(<WorkflowGraphPanel workflowState={workflowState} />, { wrapper: Wrapper });
    expect(screen.getByText('collect-order-number')).toBeInTheDocument();
  });
});
