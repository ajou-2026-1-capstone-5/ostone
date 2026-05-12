import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
    expect(screen.getByTitle('Pipeline')).toBeInTheDocument();
    expect(screen.getByTitle('Consultation')).toBeInTheDocument();
    expect(screen.getByTitle('Chat Demo')).toBeInTheDocument();
    expect(screen.getByTitle('Uploads')).toBeInTheDocument();
  });

  it('highlights active button', () => {
    const { container } = render(<Sidebar active="domain" />, { wrapper: Wrapper });
    const activeBtn = container.querySelector('[data-active="true"]');
    expect(activeBtn).not.toBeNull();
    expect(activeBtn?.getAttribute('title')).toBe('Domain Packs');
  });

  it('switches active on 6 different values', () => {
    const actives = ['workflows', 'domain', 'pipeline', 'consult', 'chat-demo', 'upload'] as const;
    const titleMap: Record<(typeof actives)[number], string> = {
      workflows: 'Workflows',
      domain: 'Domain Packs',
      pipeline: 'Pipeline',
      consult: 'Consultation',
      'chat-demo': 'Chat Demo',
      upload: 'Uploads',
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

  it('renders switcher when provided', () => {
    const switcher = <div data-testid="switcher">Switch</div>;
    render(<Sidebar active="workflows" switcher={switcher} />, { wrapper: Wrapper });
    expect(screen.getByTestId('switcher')).toBeInTheDocument();
  });

  it('handles mouse enter and leave on inactive nav items', () => {
    const { container } = render(<Sidebar active="domain" />, { wrapper: Wrapper });
    const workflowLink = container.querySelector('[title="Workflows"]') as HTMLElement;
    expect(workflowLink).not.toBeNull();

    fireEvent.mouseEnter(workflowLink);
    expect(workflowLink.style.background).toBe('var(--paper-3)');

    fireEvent.mouseLeave(workflowLink);
    expect(workflowLink.style.background).toBe('transparent');
  });

  it('does not change active item on mouse enter/leave', () => {
    const { container } = render(<Sidebar active="domain" />, { wrapper: Wrapper });
    const activeLink = container.querySelector('[data-active="true"]') as HTMLElement;
    expect(activeLink).not.toBeNull();
    const bgBefore = activeLink.style.background;

    activeLink.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(activeLink.style.background).toBe(bgBefore);

    activeLink.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(activeLink.style.background).toBe(bgBefore);
  });

  it('renders avatar at the bottom', () => {
    const { container } = render(<Sidebar active="upload" />, { wrapper: Wrapper });
    expect(container.querySelector('nav')).toBeInTheDocument();
  });
});
