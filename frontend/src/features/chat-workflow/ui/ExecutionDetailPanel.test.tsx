import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ExecutionDetailPanel } from './ExecutionDetailPanel';
import type { DemoExecution } from '../model/chatWorkflow.types';

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

const completedExecution: DemoExecution = {
  id: 'exec-1',
  status: 'COMPLETED',
  currentState: 'COMPLETED',
  currentNodeId: 'wf-node-final',
  intent: '환불 요청',
  slotValues: { orderNumber: 'ORD-12345', refundAmount: 59000 },
  missingSlots: [],
  policyHits: [
    { policyId: 'policy-1', policyName: '환불 가능 기간', result: 'PASS', detail: '구매일로부터 14일 이내' },
  ],
  riskHits: [
    { riskId: 'risk-1', riskName: '고액 환불', result: 'LOW', detail: '고액 환불 기준 미만' },
  ],
};

describe('ExecutionDetailPanel', () => {
  it('renders title "Execution Detail"', () => {
    render(<ExecutionDetailPanel execution={completedExecution} />, { wrapper: Wrapper });
    expect(screen.getByText('Execution Detail')).toBeInTheDocument();
  });

  it('shows waiting state when execution is null', () => {
    render(<ExecutionDetailPanel execution={null} />, { wrapper: Wrapper });
    expect(screen.getByText(/waiting for execution/i)).toBeInTheDocument();
  });

  it('shows status badge with normalized status data for completed', () => {
    render(<ExecutionDetailPanel execution={completedExecution} />, { wrapper: Wrapper });
    const badge = screen.getByTestId('execution-status');
    expect(badge).toHaveTextContent('COMPLETED');
    expect(badge).toHaveAttribute('data-status', 'completed');
  });

  it('shows status badge with normalized status data for error', () => {
    const errorExecution: DemoExecution = {
      ...completedExecution,
      status: 'ERROR',
    };
    render(<ExecutionDetailPanel execution={errorExecution} />, { wrapper: Wrapper });
    const badge = screen.getByTestId('execution-status');
    expect(badge).toHaveTextContent('ERROR');
    expect(badge).toHaveAttribute('data-status', 'error');
  });

  it('renders intent name', () => {
    render(<ExecutionDetailPanel execution={completedExecution} />, { wrapper: Wrapper });
    const intentEl = screen.getByTestId('execution-intent');
    expect(intentEl).toHaveTextContent('환불 요청');
  });

  it('renders slot values table', () => {
    render(<ExecutionDetailPanel execution={completedExecution} />, { wrapper: Wrapper });
    const slotsSection = screen.getByTestId('execution-slots');
    expect(slotsSection).toBeInTheDocument();
    expect(slotsSection).toHaveTextContent('orderNumber');
    expect(slotsSection).toHaveTextContent('ORD-12345');
    expect(slotsSection).toHaveTextContent('refundAmount');
    expect(slotsSection).toHaveTextContent('59000');
  });

  it('renders policy hits with PASS result', () => {
    render(<ExecutionDetailPanel execution={completedExecution} />, { wrapper: Wrapper });
    const policiesSection = screen.getByTestId('execution-policies');
    expect(policiesSection).toBeInTheDocument();
    expect(policiesSection).toHaveTextContent('환불 가능 기간');
    expect(policiesSection).toHaveTextContent('PASS');
  });

  it('renders risk hits with LOW result', () => {
    render(<ExecutionDetailPanel execution={completedExecution} />, { wrapper: Wrapper });
    const risksSection = screen.getByTestId('execution-risks');
    expect(risksSection).toBeInTheDocument();
    expect(risksSection).toHaveTextContent('고액 환불');
    expect(risksSection).toHaveTextContent('LOW');
  });

  it('does NOT render missingSlots section when array is empty', () => {
    render(<ExecutionDetailPanel execution={completedExecution} />, { wrapper: Wrapper });
    expect(screen.queryByText(/missing slots/i)).not.toBeInTheDocument();
  });

  it('renders missingSlots section when array is non-empty', () => {
    const execWithMissing: DemoExecution = {
      ...completedExecution,
      missingSlots: ['phoneNumber', 'email'],
    };
    render(<ExecutionDetailPanel execution={execWithMissing} />, { wrapper: Wrapper });
    expect(screen.getByText(/missing slots/i)).toBeInTheDocument();
    expect(screen.getByText(/phoneNumber/i)).toBeInTheDocument();
    expect(screen.getByText(/email/i)).toBeInTheDocument();
  });

  it('renders policy hit with FAIL result in red', () => {
    const failPolicyExec: DemoExecution = {
      ...completedExecution,
      policyHits: [
        { policyId: 'policy-2', policyName: '구매 기한 정책', result: 'FAIL', detail: '구매 후 14일 초과' },
      ],
    };
    render(<ExecutionDetailPanel execution={failPolicyExec} />, { wrapper: Wrapper });
    const policiesSection = screen.getByTestId('execution-policies');
    expect(policiesSection).toHaveTextContent('구매 기한 정책');
    expect(policiesSection).toHaveTextContent('FAIL');
  });

  it('renders risk hit with HIGH result in red', () => {
    const highRiskExec: DemoExecution = {
      ...completedExecution,
      riskHits: [
        { riskId: 'risk-2', riskName: '대량 환불', result: 'HIGH', detail: '환불 금액 200만원' },
      ],
    };
    render(<ExecutionDetailPanel execution={highRiskExec} />, { wrapper: Wrapper });
    const risksSection = screen.getByTestId('execution-risks');
    expect(risksSection).toHaveTextContent('대량 환불');
    expect(risksSection).toHaveTextContent('HIGH');
  });
});
