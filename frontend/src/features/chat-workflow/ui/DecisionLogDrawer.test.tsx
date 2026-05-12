import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DecisionLogDrawer } from './DecisionLogDrawer';

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('DecisionLogDrawer', () => {
  it('is collapsed by default', () => {
    render(<DecisionLogDrawer entries={[]} />, { wrapper: Wrapper });
    expect(screen.queryByRole('heading', { name: /decision log/i })).not.toBeInTheDocument();
  });

  it('opens on trigger click', () => {
    render(<DecisionLogDrawer entries={[]} />, { wrapper: Wrapper });
    const trigger = screen.getByRole('button', { name: /decision log/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('heading', { name: /decision log/i })).toBeInTheDocument();
  });

  it('shows entries when open', () => {
    const entries = [
      { id: 'd1', step: 'intent-routing', action: 'select-workflow', reason: 'Intent matched', timestamp: '2026-01-01T00:00:00Z' },
    ];
    render(<DecisionLogDrawer entries={entries} />, { wrapper: Wrapper });
    const trigger = screen.getByRole('button', { name: /decision log/i });
    fireEvent.click(trigger);
    expect(screen.getByText('select-workflow')).toBeInTheDocument();
    expect(screen.getByText('Intent matched')).toBeInTheDocument();
  });

  it('shows empty state placeholder when no entries', () => {
    render(<DecisionLogDrawer entries={[]} />, { wrapper: Wrapper });
    const trigger = screen.getByRole('button', { name: /decision log/i });
    fireEvent.click(trigger);
    expect(screen.getByText('기록된 결정이 없습니다.')).toBeInTheDocument();
  });
});
