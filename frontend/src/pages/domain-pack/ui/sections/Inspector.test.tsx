import { describe, it, expect } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import { Inspector } from './Inspector';

describe('Inspector', () => {
  it('renders header "Selected node" text', () => {
    render(<Inspector />);
    expect(screen.getByText('Selected node')).toBeInTheDocument();
  });

  it('renders 4 NodeMetric stats', () => {
    render(<Inspector />);
    expect(screen.getByText('Pass rate')).toBeInTheDocument();
    expect(screen.getByText('Samples')).toBeInTheDocument();
    expect(screen.getByText('Latency')).toBeInTheDocument();
    expect(screen.getByText('Confidence')).toBeInTheDocument();
  });

  it('renders 3 InspField rows', () => {
    render(<Inspector />);
    expect(screen.getByText('amount')).toBeInTheDocument();
    expect(screen.getByText('card_last4')).toBeInTheDocument();
    expect(screen.getByText('merchant_id')).toBeInTheDocument();
  });

  it('renders 2 PolicyRow items', () => {
    render(<Inspector />);
    expect(screen.getByText('POL-001')).toBeInTheDocument();
    expect(screen.getByText('POL-014')).toBeInTheDocument();
  });

  it('renders 3 BranchRow items', () => {
    render(<Inspector />);
    expect(screen.getByText('pass · risk ≤ 0.4')).toBeInTheDocument();
    expect(screen.getByText('risk > 0.4')).toBeInTheDocument();
    expect(screen.getByText('× ineligible')).toBeInTheDocument();
  });

  it('renders "Sample conversation turn" text', () => {
    render(<Inspector />);
    expect(screen.getByText('Sample conversation turn')).toBeInTheDocument();
  });

  it('renders 3 review comments', () => {
    render(<Inspector />);
    expect(screen.getByText('Review thread')).toBeInTheDocument();
    expect(screen.getByText('3 comments')).toBeInTheDocument();
    expect(screen.getByText('+ Add')).toBeInTheDocument();
    expect(screen.getByText('김희원')).toBeInTheDocument();
    expect(screen.getByText('홍준혁')).toBeInTheDocument();
    expect(screen.getByText('송예린')).toBeInTheDocument();
    expect(screen.getByText('resolved')).toBeInTheDocument();
    expect(screen.getAllByText('open')).toHaveLength(2);
  });
});
