import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DecisionLogDrawer } from './DecisionLogDrawer';
import type { DemoDecisionLogEntry } from '../model/chatWorkflow.types';

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

const allDecisions: DemoDecisionLogEntry[] = [
  {
    id: 'log-1',
    step: 1,
    messageId: 'msg-1',
    eventType: 'INTENT_DETECTED',
    stateFrom: 'INITIAL',
    stateTo: 'INTENT_DETECTED',
    decision: 'ALLOW',
    confidence: 95,
    reason: '환불 요청 패턴 감지',
  },
  {
    id: 'log-2',
    step: 3,
    messageId: 'msg-3',
    eventType: 'SLOT_FILLED',
    stateFrom: 'INTENT_DETECTED',
    stateTo: 'SLOT_COLLECTING',
    decision: 'DENY',
    confidence: 30,
    reason: 'Slot validation failed',
  },
  {
    id: 'log-3',
    step: 2,
    messageId: 'msg-3',
    eventType: 'POLICY_CHECKED',
    stateFrom: 'SLOT_COLLECTING',
    stateTo: 'POLICY_CHECKING',
    decision: 'ESCALATE',
    confidence: 60,
    reason: 'Policy breach detected',
  },
];

describe('DecisionLogDrawer', () => {
  it('is collapsed by default', () => {
    render(<DecisionLogDrawer entries={allDecisions} selectedMessageId={null} />, { wrapper: Wrapper });
    expect(screen.queryByRole('heading', { name: /decision log/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('decision-entry-log-1')).not.toBeInTheDocument();
  });

  it('opens on trigger click', () => {
    render(<DecisionLogDrawer entries={[]} selectedMessageId={null} />, { wrapper: Wrapper });
    const trigger = screen.getByRole('button', { name: /decision log/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('heading', { name: /decision log/i })).toBeInTheDocument();
  });

  it('shows entries with stateFrom → stateTo transition when open', () => {
    render(<DecisionLogDrawer entries={allDecisions} selectedMessageId={null} />, { wrapper: Wrapper });
    const trigger = screen.getByRole('button', { name: /decision log/i });
    fireEvent.click(trigger);
    const entry = screen.getByTestId('decision-entry-log-1');
    expect(within(entry).getByTestId('decision-transition')).toHaveTextContent('INITIAL → INTENT_DETECTED');
    expect(within(entry).getByText('환불 요청 패턴 감지')).toBeInTheDocument();
  });

  it('shows confidence bar with width matching value and color based on threshold', () => {
    render(<DecisionLogDrawer entries={allDecisions} selectedMessageId={null} />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole('button', { name: /decision log/i }));

    // log-1: confidence 95 (>80) → green, width 95%
    const bar1 = within(screen.getByTestId('decision-entry-log-1')).getByTestId('decision-confidence');
    const fill1 = bar1.firstChild as HTMLElement;
    expect(fill1.style.width).toBe('95%');
    expect(fill1.style.background).toBe('rgb(34, 197, 94)');

    // log-2: confidence 30 (<50) → red, width 30%
    const bar2 = within(screen.getByTestId('decision-entry-log-2')).getByTestId('decision-confidence');
    const fill2 = bar2.firstChild as HTMLElement;
    expect(fill2.style.width).toBe('30%');
    expect(fill2.style.background).toBe('rgb(239, 68, 68)');

    // log-3: confidence 60 (50-80) → yellow, width 60%
    const bar3 = within(screen.getByTestId('decision-entry-log-3')).getByTestId('decision-confidence');
    const fill3 = bar3.firstChild as HTMLElement;
    expect(fill3.style.width).toBe('60%');
    expect(fill3.style.background).toBe('rgb(234, 179, 8)');
  });

  it('shows decision badge with correct color (ALLOW=green, DENY=red, ESCALATE=yellow)', () => {
    render(<DecisionLogDrawer entries={allDecisions} selectedMessageId={null} />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole('button', { name: /decision log/i }));

    const badge1 = within(screen.getByTestId('decision-entry-log-1')).getByTestId('decision-decision');
    expect(badge1).toHaveTextContent('ALLOW');
    expect(badge1.style.background).toBe('rgb(34, 197, 94)');

    const badge2 = within(screen.getByTestId('decision-entry-log-2')).getByTestId('decision-decision');
    expect(badge2).toHaveTextContent('DENY');
    expect(badge2.style.background).toBe('rgb(239, 68, 68)');

    const badge3 = within(screen.getByTestId('decision-entry-log-3')).getByTestId('decision-decision');
    expect(badge3).toHaveTextContent('ESCALATE');
    expect(badge3.style.background).toBe('rgb(234, 179, 8)');
  });

  it('highlights entries matching selectedMessageId with blue border and light background', () => {
    render(<DecisionLogDrawer entries={allDecisions} selectedMessageId="msg-3" />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole('button', { name: /decision log/i }));

    // log-1: messageId 'msg-1' ≠ 'msg-3' → no highlight
    const entry1 = screen.getByTestId('decision-entry-log-1');
    expect(entry1.style.borderLeft).not.toBe('3px solid rgb(59, 130, 246)');

    // log-2: messageId 'msg-3' → highlighted
    const entry2 = screen.getByTestId('decision-entry-log-2');
    expect(entry2.style.borderLeft).toBe('3px solid rgb(59, 130, 246)');
    expect(entry2.style.background).toBe('rgb(239, 246, 255)');

    // log-3: messageId 'msg-3' → highlighted
    const entry3 = screen.getByTestId('decision-entry-log-3');
    expect(entry3.style.borderLeft).toBe('3px solid rgb(59, 130, 246)');
    expect(entry3.style.background).toBe('rgb(239, 246, 255)');
  });

  it('shows empty state placeholder when no entries', () => {
    render(<DecisionLogDrawer entries={[]} selectedMessageId={null} />, { wrapper: Wrapper });
    const trigger = screen.getByRole('button', { name: /decision log/i });
    fireEvent.click(trigger);
    expect(screen.getByText('기록된 결정이 없습니다.')).toBeInTheDocument();
  });

  it('sorts entries by step', () => {
    const unsorted: DemoDecisionLogEntry[] = [
      { id: 'log-a', step: 3, messageId: 'm1', eventType: 'E1', stateFrom: 'A', stateTo: 'B', decision: 'ALLOW', confidence: 50, reason: 'R1' },
      { id: 'log-b', step: 1, messageId: 'm2', eventType: 'E2', stateFrom: 'C', stateTo: 'D', decision: 'DENY', confidence: 50, reason: 'R2' },
      { id: 'log-c', step: 2, messageId: 'm3', eventType: 'E3', stateFrom: 'E', stateTo: 'F', decision: 'ALLOW', confidence: 50, reason: 'R3' },
    ];
    render(<DecisionLogDrawer entries={unsorted} selectedMessageId={null} />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole('button', { name: /decision log/i }));

    const items = screen.getAllByTestId(/^decision-entry-/);
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('1.');
    expect(items[1]).toHaveTextContent('2.');
    expect(items[2]).toHaveTextContent('3.');
  });
});
