import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChatTimelinePanel } from './ChatTimelinePanel';

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('ChatTimelinePanel', () => {
  it('renders title "Chat Timeline"', () => {
    render(<ChatTimelinePanel messages={[]} />, { wrapper: Wrapper });
    expect(screen.getByText('Chat Timeline')).toBeInTheDocument();
  });

  it('renders messages from props', () => {
    const messages = [
      { id: '1', role: 'user' as const, content: 'Hello', timestamp: '2026-01-01T00:00:00Z' },
      { id: '2', role: 'assistant' as const, content: 'Hi there', timestamp: '2026-01-01T00:00:01Z' },
    ];
    render(<ChatTimelinePanel messages={messages} />, { wrapper: Wrapper });
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there')).toBeInTheDocument();
  });

  it('has scrollable container', () => {
    const { container } = render(<ChatTimelinePanel messages={[]} />, { wrapper: Wrapper });
    const scrollable = container.querySelector('[data-scrollable]');
    expect(scrollable).toBeInTheDocument();
  });
});
