import { renderHook, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useIsBelow, useMediaQuery } from "./use-media-query";

type Listener = () => void;

interface MockMql {
  matches: boolean;
  media: string;
  listeners: Set<Listener>;
  addEventListener: (type: string, cb: Listener) => void;
  removeEventListener: (type: string, cb: Listener) => void;
}

function installMatchMedia(matcher: (query: string) => boolean): MockMql[] {
  const instances: MockMql[] = [];
  window.matchMedia = vi.fn((query: string) => {
    const instance: MockMql = {
      matches: matcher(query),
      media: query,
      listeners: new Set<Listener>(),
      addEventListener: (_type, cb) => {
        instance.listeners.add(cb);
      },
      removeEventListener: (_type, cb) => {
        instance.listeners.delete(cb);
      },
    };
    instances.push(instance);
    return instance;
  }) as unknown as typeof window.matchMedia;
  return instances;
}

const originalMatchMedia = window.matchMedia;

describe("useMediaQuery", () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("returns the initial match state", () => {
    installMatchMedia(() => true);
    const { result } = renderHook(() => useMediaQuery("(max-width: 600px)"));
    expect(result.current).toBe(true);
  });

  it("returns false when the query does not match", () => {
    installMatchMedia(() => false);
    const { result } = renderHook(() => useMediaQuery("(max-width: 600px)"));
    expect(result.current).toBe(false);
  });

  it("updates when the media query change event fires", () => {
    const instances = installMatchMedia(() => false);
    const { result } = renderHook(() => useMediaQuery("(max-width: 600px)"));
    expect(result.current).toBe(false);

    act(() => {
      instances[0].matches = true;
      instances[0].listeners.forEach((listener) => listener());
    });

    expect(result.current).toBe(true);
  });

  it("removes its listener on unmount", () => {
    const instances = installMatchMedia(() => true);
    const { unmount } = renderHook(() => useMediaQuery("(max-width: 600px)"));
    expect(instances[0].listeners.size).toBe(1);

    unmount();

    expect(instances[0].listeners.size).toBe(0);
  });
});

describe("useIsBelow", () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("builds a max-width query one pixel below the breakpoint", () => {
    const instances = installMatchMedia(() => false);
    renderHook(() => useIsBelow(1180));
    expect(instances[0].media).toBe("(max-width: 1179px)");
  });

  it("reports true when the viewport is below the breakpoint", () => {
    installMatchMedia((query) => query === "(max-width: 1179px)");
    const { result } = renderHook(() => useIsBelow(1180));
    expect(result.current).toBe(true);
  });
});
