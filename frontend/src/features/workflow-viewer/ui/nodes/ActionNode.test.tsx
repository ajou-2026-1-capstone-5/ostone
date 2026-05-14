import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActionNode } from './ActionNode';

vi.mock('@xyflow/react', () => ({
  Handle: () => <div data-testid="handle" />,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
}));

const defaultProps = {
  id: "test",
  type: "action" as const,
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

describe('ActionNode', () => {
  it('renders with label', () => {
    render(<ActionNode {...defaultProps} data={{ label: "액션" }} />);
    expect(screen.getByText('액션')).toBeInTheDocument();
  });

  it('renders with policyRef text when provided', () => {
    render(<ActionNode {...defaultProps} data={{ label: "액션", policyRef: "POL-001" }} />);
    expect(screen.getByText('POL-001')).toBeInTheDocument();
  });

  it('does NOT render policyRef div when not provided', () => {
    render(<ActionNode {...defaultProps} data={{ label: "액션" }} />);
    expect(screen.getByText('액션')).toBeInTheDocument();
    expect(screen.queryByText('POL-001')).not.toBeInTheDocument();
  });

  it('renders with COMPLETED status', () => {
    render(<ActionNode {...defaultProps} data={{ label: "액션", status: "COMPLETED" }} />);
    const container = screen.getByText('액션').parentElement;
    expect(container?.className).toContain('statusCompleted');
  });

  it('renders with IDLE status by default', () => {
    render(<ActionNode {...defaultProps} data={{ label: "액션" }} />);
    const container = screen.getByText('액션').parentElement;
    expect(container?.className).toContain('statusIdle');
  });
});
