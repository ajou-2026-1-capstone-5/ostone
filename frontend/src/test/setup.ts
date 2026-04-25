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

if (
  !jsdomLocalStorage ||
  typeof jsdomLocalStorage.clear !== "function" ||
  typeof jsdomLocalStorage.setItem !== "function" ||
  typeof jsdomLocalStorage.getItem !== "function"
) {
  throw new Error(
    "jsdom localStorage is unavailable or missing expected methods (clear/setItem/getItem). " +
      "Ensure globalThis.jsdom.window.localStorage is populated by the test environment.",
  );
}

Object.defineProperty(globalThis, "localStorage", {
  value: jsdomLocalStorage,
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
