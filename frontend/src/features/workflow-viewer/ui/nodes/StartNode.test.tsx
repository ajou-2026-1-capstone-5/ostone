import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StartNode } from './StartNode';

vi.mock('@xyflow/react', () => ({
  Handle: () => <div data-testid="handle" />,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
}));

const defaultProps = {
  id: "test",
  type: "start" as const,
  selected: false,
  dragging: false,
  zIndex: 0,
  selectable: true,
  deletable: false,
  draggable: true,
  isConnectable: false,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
};

describe('StartNode', () => {
  it('renders with label text', () => {
    render(<StartNode {...defaultProps} data={{ label: "시작" }} />);
    expect(screen.getByText('시작')).toBeInTheDocument();
  });

  it('renders with IDLE status by default', () => {
    render(<StartNode {...defaultProps} data={{ label: "시작" }} />);
    const container = screen.getByText('시작').parentElement;
    expect(container?.className).toContain('statusIdle');
  });

  it('renders with ACTIVE status', () => {
    render(<StartNode {...defaultProps} data={{ label: "시작", status: "ACTIVE" }} />);
    const container = screen.getByText('시작').parentElement;
    expect(container?.className).toContain('statusActive');
  });

  it('renders with COMPLETED status', () => {
    render(<StartNode {...defaultProps} data={{ label: "시작", status: "COMPLETED" }} />);
    const container = screen.getByText('시작').parentElement;
    expect(container?.className).toContain('statusCompleted');
  });

  it('renders with FAILED status', () => {
    render(<StartNode {...defaultProps} data={{ label: "시작", status: "FAILED" }} />);
    const container = screen.getByText('시작').parentElement;
    expect(container?.className).toContain('statusFailed');
  });

  it('shows empty label when data.label is undefined', () => {
    render(<StartNode {...defaultProps} data={{}} />);
    const spans = screen.getAllByText('');
    expect(spans.length).toBeGreaterThanOrEqual(1);
  });
});
