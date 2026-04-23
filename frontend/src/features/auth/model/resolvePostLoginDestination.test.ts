import { describe, expect, it } from 'vite-plus/test';
import { resolvePostLoginDestination } from './resolvePostLoginDestination';

describe('resolvePostLoginDestination', () => {
  it('allows /workspaces paths', () => {
    expect(
      resolvePostLoginDestination({
        from: { pathname: '/workspaces', search: '?tab=logs' },
      }),
    ).toBe('/workspaces?tab=logs');
    expect(
      resolvePostLoginDestination({
        from: { pathname: '/workspaces/1/upload', search: '?tab=logs' },
      }),
    ).toBe('/workspaces/1/upload?tab=logs');
  });

  it('falls back for auth routes', () => {
    expect(resolvePostLoginDestination({ from: { pathname: '/login' } })).toBe(
      '/workspaces',
    );
    expect(resolvePostLoginDestination({ from: { pathname: '/signup' } })).toBe(
      '/workspaces',
    );
  });

  it('falls back for paths outside the workspace route boundary', () => {
    expect(
      resolvePostLoginDestination({ from: { pathname: '/workspaces-public' } }),
    ).toBe('/workspaces');
  });

  it('falls back for dot-segment workspace paths', () => {
    expect(
      resolvePostLoginDestination({ from: { pathname: '/workspaces/../login' } }),
    ).toBe('/workspaces');
    expect(
      resolvePostLoginDestination({
        from: { pathname: '/workspaces/%2e%2e/login' },
      }),
    ).toBe('/workspaces');
  });

  it('falls back for external URLs', () => {
    expect(
      resolvePostLoginDestination({
        from: { pathname: 'https://example.com/workspaces' },
      }),
    ).toBe('/workspaces');
    expect(
      resolvePostLoginDestination({
        from: { pathname: '//example.com/workspaces' },
      }),
    ).toBe('/workspaces');
  });

  it('falls back when pathname is missing', () => {
    expect(resolvePostLoginDestination(undefined)).toBe('/workspaces');
    expect(resolvePostLoginDestination({ from: {} })).toBe('/workspaces');
  });

  it('ignores malformed search values', () => {
    expect(
      resolvePostLoginDestination({
        from: { pathname: '/workspaces/1', search: 'next=/login' },
      }),
    ).toBe('/workspaces/1');
  });
});
