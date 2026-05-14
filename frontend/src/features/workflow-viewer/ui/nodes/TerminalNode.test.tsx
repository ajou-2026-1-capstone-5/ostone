import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TerminalNode } from './TerminalNode';

vi.mock('@xyflow/react', () => ({
  Handle: () => <div data-testid="handle" />,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
}));

const defaultProps = {
  id: "test",
  type: "terminal" as const,
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

describe('TerminalNode', () => {
  it('renders with label', () => {
    render(<TerminalNode {...defaultProps} data={{ label: "종료" }} />);
    expect(screen.getByText('종료')).toBeInTheDocument();
  });

  it('renders with COMPLETED status', () => {
    render(<TerminalNode {...defaultProps} data={{ label: "종료", status: "COMPLETED" }} />);
    const container = screen.getByText('종료').parentElement;
    expect(container?.className).toContain('statusCompleted');
  });

  it('renders with IDLE status by default', () => {
    render(<TerminalNode {...defaultProps} data={{ label: "종료" }} />);
    const container = screen.getByText('종료').parentElement;
    expect(container?.className).toContain('statusIdle');
  });
});
