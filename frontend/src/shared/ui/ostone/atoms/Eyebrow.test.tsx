import { describe, it, expect } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import { Eyebrow } from './Eyebrow';

describe('Eyebrow', () => {
  it('renders children text', () => {
    render(<Eyebrow>Label</Eyebrow>);
    expect(screen.getByText('Label')).toBeInTheDocument();
  });

  it('applies t-eyebrow class', () => {
    render(<Eyebrow>Label</Eyebrow>);
    const el = screen.getByText('Label');
    expect(el.classList.contains('t-eyebrow')).toBe(true);
  });

  it('appends optional className', () => {
    render(<Eyebrow className="extra">Label</Eyebrow>);
    const el = screen.getByText('Label');
    expect(el.classList.contains('t-eyebrow')).toBe(true);
    expect(el.classList.contains('extra')).toBe(true);
  });
});
