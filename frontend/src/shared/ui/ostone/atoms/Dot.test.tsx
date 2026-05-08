import { describe, it, expect } from 'vite-plus/test';
import { render } from '@testing-library/react';
import { Dot } from './Dot';

describe('Dot', () => {
  it('renders with default size 6px', () => {
    render(<Dot tone="signal" />);
    const el = document.querySelector('span');
    expect(el).toBeTruthy();
    expect(el!.style.width).toBe('6px');
    expect(el!.style.height).toBe('6px');
  });

  it('renders with custom size', () => {
    render(<Dot tone="signal" size={10} />);
    const el = document.querySelector('span');
    expect(el!.style.width).toBe('10px');
    expect(el!.style.height).toBe('10px');
  });

  it('applies correct background for each tone', () => {
    const tones = [
      { tone: 'signal' as const, color: 'var(--signal)' },
      { tone: 'warn' as const, color: 'var(--warn)' },
      { tone: 'danger' as const, color: 'var(--danger)' },
      { tone: 'info' as const, color: 'var(--info)' },
      { tone: 'mute' as const, color: 'var(--ink-4)' },
    ];

    for (const { tone, color } of tones) {
      const { container } = render(<Dot tone={tone} />);
      const el = container.querySelector('span');
      expect(el!.style.background).toBe(color);
    }
  });
});
