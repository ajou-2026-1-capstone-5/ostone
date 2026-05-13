import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatWorkflowHeader } from './ChatWorkflowHeader';
import type { DemoDomainPack } from '../model/chatWorkflow.types';

const mockDomainPack: DemoDomainPack = {
  id: 'dp-1',
  name: 'Order Inquiries',
  version: '1.2.0',
  status: 'PUBLISHED',
  intents: [],
  policies: [],
  risks: [],
};

const mockDomainPackDraft: DemoDomainPack = {
  id: 'dp-2',
  name: 'Returns Process',
  version: '0.5.0',
  status: 'DRAFT',
  intents: [],
  policies: [],
  risks: [],
};

describe('ChatWorkflowHeader', () => {
  it('renders domainPack name', () => {
    render(<ChatWorkflowHeader domainPack={mockDomainPack} />);
    expect(screen.getByTestId('header-domain-name')).toHaveTextContent('Order Inquiries');
  });

  it('renders version badge formatted as v{version}', () => {
    render(<ChatWorkflowHeader domainPack={mockDomainPack} />);
    expect(screen.getByTestId('header-version')).toHaveTextContent('v1.2.0');
  });

  it('renders Published badge when status is PUBLISHED', () => {
    render(<ChatWorkflowHeader domainPack={mockDomainPack} />);
    expect(screen.getByTestId('header-published')).toHaveTextContent('Published');
  });

  it('does NOT render Published badge when status is not PUBLISHED', () => {
    render(<ChatWorkflowHeader domainPack={mockDomainPackDraft} />);
    expect(screen.queryByTestId('header-published')).not.toBeInTheDocument();
  });

  it('renders Reset button', () => {
    render(<ChatWorkflowHeader domainPack={mockDomainPack} />);
    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
  });

  it('renders nothing (no domainPack info) when domainPack is null', () => {
    render(<ChatWorkflowHeader domainPack={null} />);
    expect(screen.queryByTestId('header-domain-name')).not.toBeInTheDocument();
    expect(screen.queryByTestId('header-version')).not.toBeInTheDocument();
    expect(screen.queryByText(/order inquiries/i)).not.toBeInTheDocument();
  });
});
