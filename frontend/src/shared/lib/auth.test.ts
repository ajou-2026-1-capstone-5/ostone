import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { clearAuthSession, isAuthenticated } from './auth';

function createToken(payload: Record<string, unknown>): string {
  return ['header', btoa(JSON.stringify(payload)), 'signature'].join('.');
}

describe('isAuthenticated', () => {
  afterEach(() => {
    vi.useRealTimers();
    clearAuthSession();
  });

  it('returns true only when access token has a future numeric exp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-23T00:00:00Z'));
    localStorage.setItem('accessToken', createToken({ exp: Date.now() / 1000 + 60 }));

    expect(isAuthenticated()).toBe(true);
  });

  it('returns false when exp is missing or invalid', () => {
    localStorage.setItem('accessToken', createToken({}));
    expect(isAuthenticated()).toBe(false);

    localStorage.setItem('accessToken', createToken({ exp: '9999999999' }));
    expect(isAuthenticated()).toBe(false);
  });

  it('returns false when token is expired or malformed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-23T00:00:00Z'));
    localStorage.setItem('accessToken', createToken({ exp: Date.now() / 1000 - 60 }));
    expect(isAuthenticated()).toBe(false);

    localStorage.setItem('accessToken', 'not-a-jwt');
    expect(isAuthenticated()).toBe(false);
  });
});
