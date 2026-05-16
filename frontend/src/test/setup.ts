import { vi } from "vite-plus/test";
import "@testing-library/jest-dom";

// Node.js v25 exposes localStorage as an empty object without methods.
// vite-plus-test's populateGlobal skips keys already present in globalThis,
// so jsdom's real implementation is never injected. window === globalThis in
// this runner context, so window.localStorage is also broken. Access jsdom's
// real implementation via globalThis.jsdom.window (set by populateGlobal).
type GlobalWithJsdom = { jsdom?: { window?: { localStorage?: Storage } } };
const jsdomWindow = (globalThis as unknown as GlobalWithJsdom).jsdom?.window;
const jsdomLocalStorage = jsdomWindow?.localStorage;

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

Object.defineProperty(globalThis, "localStorage", {
  value: jsdomLocalStorage ?? createMemoryStorage(),
  writable: true,
  configurable: true,
});

// @xyflow/react uses ResizeObserver, which is not available in jsdom.
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
