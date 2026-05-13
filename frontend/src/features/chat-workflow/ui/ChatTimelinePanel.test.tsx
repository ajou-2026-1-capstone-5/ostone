import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatTimelinePanel } from './ChatTimelinePanel';
import type { DemoChatMessage } from '../model/chatWorkflow.types';

describe('ChatTimelinePanel', () => {
  it('renders title "Chat Timeline"', () => {
    render(<ChatTimelinePanel messages={[]} />);
    expect(screen.getByText('Chat Timeline')).toBeInTheDocument();
  });

  it('renders messages with timestamps', () => {
    const messages: DemoChatMessage[] = [
      { id: '1', role: 'user', content: 'Hello', timestamp: '2026-01-01T00:00:00Z' },
      { id: '2', role: 'assistant', content: 'Hi there', timestamp: '2026-01-01T00:00:01Z' },
    ];
    render(<ChatTimelinePanel messages={messages} />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there')).toBeInTheDocument();
    expect(screen.getByText('00:00:00')).toBeInTheDocument();
    expect(screen.getByText('00:00:01')).toBeInTheDocument();
  });

  it('calls onMessageSelect on message click', () => {
    const onSelect = vi.fn();
    const messages: DemoChatMessage[] = [
      { id: 'msg-1', role: 'user', content: 'Click me', timestamp: '2026-01-01T00:00:00Z' },
    ];
    render(<ChatTimelinePanel messages={messages} onMessageSelect={onSelect} />);
    fireEvent.click(screen.getByText('Click me'));
    expect(onSelect).toHaveBeenCalledWith('msg-1');
  });

  it('highlights selected message', () => {
    const messages: DemoChatMessage[] = [
      { id: 'msg-1', role: 'user', content: 'Selected', timestamp: '2026-01-01T00:00:00Z' },
      { id: 'msg-2', role: 'assistant', content: 'Not selected', timestamp: '2026-01-01T00:00:01Z' },
    ];
    render(<ChatTimelinePanel messages={messages} selectedMessageId="msg-1" />);
    const selectedMsg = screen.getByTestId('chat-message-msg-1');
    const unselectedMsg = screen.getByTestId('chat-message-msg-2');
    expect(selectedMsg).toHaveClass('border-l-blue-500');
    expect(selectedMsg).toHaveClass('bg-blue-50');
    expect(unselectedMsg).not.toHaveClass('border-l-blue-500');
  });

  it('shows empty state when no messages', () => {
    render(<ChatTimelinePanel messages={[]} />);
    expect(screen.getByText('대화 내역이 없습니다.')).toBeInTheDocument();
  });

  it('has scrollable container', () => {
    const { container } = render(<ChatTimelinePanel messages={[]} />);
    const scrollable = container.querySelector('[data-scrollable]');
    expect(scrollable).toBeInTheDocument();
  });
});
