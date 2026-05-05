import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OstoneShell } from './OstoneShell';

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('OstoneShell', () => {
  it('renders Sidebar with 6 nav items', () => {
    render(
      <OstoneShell active="consult" crumbs={[]}>
        <div>content</div>
      </OstoneShell>,
      { wrapper: Wrapper }
    );
    expect(screen.getByTitle('Workflows')).toBeInTheDocument();
    expect(screen.getByTitle('Domain Packs')).toBeInTheDocument();
    expect(screen.getByTitle('Review')).toBeInTheDocument();
    expect(screen.getByTitle('Pipeline')).toBeInTheDocument();
    expect(screen.getByTitle('Consultation')).toBeInTheDocument();
    expect(screen.getByTitle('Logs')).toBeInTheDocument();
  });

  it('renders Topbar with OSTONE eyebrow', () => {
    render(
      <OstoneShell active="workflows" crumbs={['CARD-CS', 'Domain Packs']}>
        <div>content</div>
      </OstoneShell>,
      { wrapper: Wrapper }
    );
    expect(screen.getByText('OSTONE')).toBeInTheDocument();
    expect(screen.getByText('CARD-CS')).toBeInTheDocument();
    expect(screen.getByText('Domain Packs')).toBeInTheDocument();
  });

  it('renders children in main area', () => {
    render(
      <OstoneShell active="workflows" crumbs={[]}>
        <div data-testid="shell-child">Hello Shell</div>
      </OstoneShell>,
      { wrapper: Wrapper }
    );
    expect(screen.getByTestId('shell-child')).toBeInTheDocument();
    expect(screen.getByText('Hello Shell')).toBeInTheDocument();
  });

  it('renders dark variant', () => {
    render(
      <OstoneShell active="consult" crumbs={[]} dark>
        <div>dark</div>
      </OstoneShell>,
      { wrapper: Wrapper }
    );
    expect(screen.getByText('dark')).toBeInTheDocument();
  });
});
