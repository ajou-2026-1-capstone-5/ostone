import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Topbar } from './Topbar';

describe('Topbar', () => {
  it('renders OSTONE eyebrow', () => {
    render(<Topbar crumbs={[]} />);
    expect(screen.getByText('OSTONE')).toBeInTheDocument();
  });

  it('renders breadcrumbs with last item bold', () => {
    const { container } = render(
      <Topbar crumbs={['CARD-CS', 'Domain Packs', 'Refund flow']} />,
    );
    const crumbs = container.querySelectorAll('.crumb');
    expect(crumbs.length).toBe(3);

    const lastCrumb = crumbs[crumbs.length - 1] as HTMLElement;
    expect(lastCrumb.style.fontWeight).toBe('500');
  });

  it('renders right slot', () => {
    render(<Topbar crumbs={[]} right={<button type="button">CTA</button>} />);
    expect(screen.getByText('CTA')).toBeInTheDocument();
  });
});
