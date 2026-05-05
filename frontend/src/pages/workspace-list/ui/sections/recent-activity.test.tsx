import { describe, it, expect } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import { RecentActivity } from './RecentActivity';

describe('RecentActivity', () => {
  const events = [
    { id: 'e1', stage: 'preprocessing', workspace: 'CARD-CS', status: 'success' as const, time: '14:22:18', duration: '4m 12s' },
    { id: 'e2', stage: 'intent-discovery', workspace: 'CARD-CS', status: 'running' as const, time: '14:26:30', duration: '6m 34s' },
    { id: 'e3', stage: 'evaluation', workspace: 'CARD-CS', status: 'failed' as const, time: '09:14:02', duration: '28m 01s' },
    { id: 'e4', stage: 'publish-candidate', workspace: 'CARD-CS', status: 'success' as const, time: '08:41:10', duration: '1m 08s' },
  ];

  it('renders 4 events', () => {
    render(<RecentActivity events={events} />);
    expect(screen.getByText('preprocessing')).toBeInTheDocument();
    expect(screen.getByText('intent-discovery')).toBeInTheDocument();
    expect(screen.getByText('evaluation')).toBeInTheDocument();
    expect(screen.getByText('publish-candidate')).toBeInTheDocument();
  });

  it('renders success/running/failed status pills', () => {
    render(<RecentActivity events={events} />);
    expect(screen.getAllByText('success')).toHaveLength(2);
    expect(screen.getByText('running')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
  });

  it('renders header and view all link', () => {
    render(<RecentActivity events={events} />);
    expect(screen.getByText('Recent pipeline activity')).toBeInTheDocument();
    expect(screen.getByText('View all')).toBeInTheDocument();
  });
});
