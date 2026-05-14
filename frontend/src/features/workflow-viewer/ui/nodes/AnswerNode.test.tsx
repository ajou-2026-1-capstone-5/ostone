import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnswerNode } from './AnswerNode';

vi.mock('@xyflow/react', () => ({
  Handle: () => <div data-testid="handle" />,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
}));

const defaultProps = {
  id: "test",
  type: "answer" as const,
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

describe('AnswerNode', () => {
  it('renders with label', () => {
    render(<AnswerNode {...defaultProps} data={{ label: "답변" }} />);
    expect(screen.getByText('답변')).toBeInTheDocument();
  });

  it('renders with ACTIVE status', () => {
    render(<AnswerNode {...defaultProps} data={{ label: "답변", status: "ACTIVE" }} />);
    const container = screen.getByText('답변').parentElement;
    expect(container?.className).toContain('statusActive');
  });

  it('renders with IDLE status by default', () => {
    render(<AnswerNode {...defaultProps} data={{ label: "답변" }} />);
    const container = screen.getByText('답변').parentElement;
    expect(container?.className).toContain('statusIdle');
  });
});
