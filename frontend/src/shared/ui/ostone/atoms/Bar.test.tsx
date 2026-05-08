import { describe, it, expect } from 'vite-plus/test';
import { render } from '@testing-library/react';
import { Bar } from './Bar';

describe('Bar', () => {
  it('renders outer and inner divs', () => {
    const { container } = render(<Bar value={0.5} />);
    const outer = container.firstChild as HTMLDivElement;
    const inner = outer.firstChild as HTMLDivElement;
    expect(outer).toBeTruthy();
    expect(inner).toBeTruthy();
  });

  it('sets inner width to 50% for value 0.5', () => {
    const { container } = render(<Bar value={0.5} />);
    const outer = container.firstChild as HTMLDivElement;
    const inner = outer.firstChild as HTMLDivElement;
    expect(inner.style.width).toBe('50%');
  });

  it('uses ink tone by default', () => {
    const { container } = render(<Bar value={0.5} />);
    const outer = container.firstChild as HTMLDivElement;
    const inner = outer.firstChild as HTMLDivElement;
    expect(inner.style.background).toBe('var(--ink-2)');
  });

  it('uses signal tone when specified', () => {
    const { container } = render(<Bar value={0.5} tone="signal" />);
    const outer = container.firstChild as HTMLDivElement;
    const inner = outer.firstChild as HTMLDivElement;
    expect(inner.style.background).toBe('var(--signal)');
  });

  it('applies custom width and height', () => {
    const { container } = render(<Bar value={0.5} w={120} h={6} />);
    const outer = container.firstChild as HTMLDivElement;
    expect(outer.style.width).toBe('120px');
    expect(outer.style.height).toBe('6px');
  });

  it('clamps value to 0-1 range', () => {
    const { container } = render(<Bar value={1.5} />);
    const outer = container.firstChild as HTMLDivElement;
    const inner = outer.firstChild as HTMLDivElement;
    expect(inner.style.width).toBe('150%');
  });
});
