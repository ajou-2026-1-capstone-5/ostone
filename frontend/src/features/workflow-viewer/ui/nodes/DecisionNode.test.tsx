import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DecisionNode } from './DecisionNode';

vi.mock('@xyflow/react', () => ({
  Handle: () => <div data-testid="handle" />,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
}));

const defaultProps = {
  id: "test",
  type: "decision" as const,
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

describe('DecisionNode', () => {
  it('renders with label', () => {
    render(<DecisionNode {...defaultProps} data={{ label: "분기점" }} />);
    expect(screen.getByText('분기점')).toBeInTheDocument();
  });

  it('renders with FAILED status', () => {
    render(<DecisionNode {...defaultProps} data={{ label: "분기점", status: "FAILED" }} />);
    const container = screen.getByText('분기점').parentElement;
    expect(container?.className).toContain('statusFailed');
  });

  it('renders with IDLE status by default', () => {
    render(<DecisionNode {...defaultProps} data={{ label: "분기점" }} />);
    const container = screen.getByText('분기점').parentElement;
    expect(container?.className).toContain('statusIdle');
  });
});
