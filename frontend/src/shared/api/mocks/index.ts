import { tryMockResponse } from "./workflowFixtures";

const SESSION_KEY = "ostone:mock-enabled";

export function isMockEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (!import.meta.env?.DEV) return false;
  try {
    const search = new URLSearchParams(window.location.search);
    if (search.get("mock") === "1") {
      window.sessionStorage?.setItem(SESSION_KEY, "1");
      return true;
    }
    if (window.sessionStorage?.getItem(SESSION_KEY) === "1") return true;
  } catch {
    /* ignore SSR / non-URL env */
  }
  return Boolean(import.meta.env?.VITE_API_MOCK === "1");
}

export function resolveMock<T>(path: string, options: RequestInit): T | null {
  if (!isMockEnabled()) return null;
  const method = (options.method ?? "GET").toUpperCase();
  return tryMockResponse<T>(path, method);
}

export { tryMockResponse };
