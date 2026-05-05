import { describe, it, expect } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import { Mono } from './Mono';

describe('Mono', () => {
  it('renders children text', () => {
    render(<Mono>12345</Mono>);
    expect(screen.getByText('12345')).toBeInTheDocument();
  });

  it('applies monospace font-family', () => {
    render(<Mono>12345</Mono>);
    const el = screen.getByText('12345');
    expect(el.style.fontFamily).toBe('var(--mono)');
  });

  it('applies tabular-nums', () => {
    render(<Mono>12345</Mono>);
    const el = screen.getByText('12345');
    expect(el.style.fontVariantNumeric).toBe('tabular-nums');
  });

  it('accepts optional className and style', () => {
    render(<Mono className="extra" style={{ color: 'red' }}>12345</Mono>);
    const el = screen.getByText('12345');
    expect(el.classList.contains('extra')).toBe(true);
    expect(el.style.color).toBe('red');
  });
});
