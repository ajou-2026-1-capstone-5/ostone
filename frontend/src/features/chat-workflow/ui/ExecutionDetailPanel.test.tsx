import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ExecutionDetailPanel } from './ExecutionDetailPanel';

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('ExecutionDetailPanel', () => {
  it('renders title "Execution Detail"', () => {
    render(<ExecutionDetailPanel status="idle" context={{}} />, { wrapper: Wrapper });
    expect(screen.getByText('Execution Detail')).toBeInTheDocument();
  });

  it('displays current status', () => {
    render(<ExecutionDetailPanel status="running" context={{}} />, { wrapper: Wrapper });
    expect(screen.getByText(/running/i)).toBeInTheDocument();
  });

  it('renders context entries', () => {
    const context = { intent: 'delivery_status_check', orderNumber: 'ORDER-001' };
    render(<ExecutionDetailPanel status="running" context={context} />, { wrapper: Wrapper });
    expect(screen.getByText(/delivery_status_check/i)).toBeInTheDocument();
  });

  it('shows placeholder when idle with no context', () => {
    render(<ExecutionDetailPanel status="idle" context={{}} />, { wrapper: Wrapper });
    expect(screen.getByText(/waiting/i)).toBeInTheDocument();
  });
});
