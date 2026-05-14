import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HandoffNode } from './HandoffNode';

vi.mock('@xyflow/react', () => ({
  Handle: () => <div data-testid="handle" />,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
}));

const defaultProps = {
  id: "test",
  type: "handoff" as const,
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

describe('HandoffNode', () => {
  it('renders with label', () => {
    render(<HandoffNode {...defaultProps} data={{ label: "전달" }} />);
    expect(screen.getByText('전달')).toBeInTheDocument();
  });

  it('renders with IDLE status by default', () => {
    render(<HandoffNode {...defaultProps} data={{ label: "전달" }} />);
    const container = screen.getByText('전달').parentElement;
    expect(container?.className).toContain('statusIdle');
  });

  it('renders with ACTIVE status when specified', () => {
    render(<HandoffNode {...defaultProps} data={{ label: "전달", status: "ACTIVE" }} />);
    const container = screen.getByText('전달').parentElement;
    expect(container?.className).toContain('statusActive');
  });
});
