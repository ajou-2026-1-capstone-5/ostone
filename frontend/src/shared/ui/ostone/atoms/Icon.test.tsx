import { describe, it, expect } from 'vite-plus/test';
import { render } from '@testing-library/react';
import { Icon } from './Icon';

describe('Icon', () => {
  it('renders an svg element for a valid name', () => {
    render(<Icon name="search" />);
    const svg = document.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('returns null for undefined name', () => {
    const { container } = render(<Icon name={undefined as never} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null for invalid name', () => {
    const { container } = render(<Icon name={'invalid' as never} />);
    expect(container.firstChild).toBeNull();
  });

  it('applies default size 16', () => {
    render(<Icon name="arrow" />);
    const svg = document.querySelector('svg');
    expect(svg!.getAttribute('width')).toBe('16');
    expect(svg!.getAttribute('height')).toBe('16');
  });

  it('applies custom size', () => {
    render(<Icon name="arrow" size={24} />);
    const svg = document.querySelector('svg');
    expect(svg!.getAttribute('width')).toBe('24');
    expect(svg!.getAttribute('height')).toBe('24');
  });

  it('accepts optional className', () => {
    render(<Icon name="arrow" className="my-icon" />);
    const svg = document.querySelector('svg');
    expect(svg!.classList.contains('my-icon')).toBe(true);
  });
});
