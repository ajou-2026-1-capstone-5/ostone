import { vi } from "vite-plus/test";
import "@testing-library/jest-dom";

// Node.js v25 exposes localStorage as an empty object without methods.
// vite-plus-test's populateGlobal skips keys already present in globalThis,
// so jsdom's real implementation is never injected. window === globalThis in
// this runner context, so window.localStorage is also broken. Access jsdom's
// real implementation via globalThis.jsdom.window (set by populateGlobal).
const jsdomWindow = (globalThis as any).jsdom?.window;
Object.defineProperty(globalThis, "localStorage", {
  value: jsdomWindow?.localStorage ?? window.localStorage,
  writable: true,
  configurable: true,
});

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
