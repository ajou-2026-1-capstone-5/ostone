import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from './Sidebar';

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('Sidebar', () => {
  it('renders 6 nav buttons', () => {
    render(<Sidebar active="workflows" />, { wrapper: Wrapper });
    expect(screen.getByTitle('Workflows')).toBeInTheDocument();
    expect(screen.getByTitle('Domain Packs')).toBeInTheDocument();
    expect(screen.getByTitle('Review')).toBeInTheDocument();
    expect(screen.getByTitle('Pipeline')).toBeInTheDocument();
    expect(screen.getByTitle('Consultation')).toBeInTheDocument();
    expect(screen.getByTitle('Logs')).toBeInTheDocument();
  });

  it('highlights active button', () => {
    const { container } = render(<Sidebar active="domain" />, { wrapper: Wrapper });
    const activeBtn = container.querySelector('[data-active="true"]');
    expect(activeBtn).not.toBeNull();
    expect(activeBtn?.getAttribute('title')).toBe('Domain Packs');
  });

  it('switches active on 6 different values', () => {
    const actives = ['workflows', 'domain', 'review', 'pipeline', 'consult', 'logs'] as const;
    const titleMap: Record<(typeof actives)[number], string> = {
      workflows: 'Workflows',
      domain: 'Domain Packs',
      review: 'Review',
      pipeline: 'Pipeline',
      consult: 'Consultation',
      logs: 'Logs',
    };

    actives.forEach((active) => {
      const { container } = render(<Sidebar active={active} />, { wrapper: Wrapper });
      const activeBtn = container.querySelector('[data-active="true"]');
      expect(activeBtn).not.toBeNull();
      expect(activeBtn?.getAttribute('title')).toBe(titleMap[active]);
    });
  });

  it('renders dark variant without error', () => {
    const { container } = render(<Sidebar active="consult" dark />, { wrapper: Wrapper });
    expect(container.firstChild).toBeInTheDocument();
  });
});
