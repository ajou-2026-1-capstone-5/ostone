import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isMockEnabled, resolveMock } from "./index";

const originalLocation = window.location;

function setLocation(search: string) {
  Object.defineProperty(window, "location", {
    value: { ...originalLocation, search } as Location,
    writable: true,
  });
}

beforeEach(() => {
  vi.stubEnv("VITE_API_MOCK", "");
  window.sessionStorage.clear();
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    value: originalLocation,
    writable: true,
  });
  vi.unstubAllEnvs();
  window.sessionStorage.clear();
});

describe("isMockEnabled", () => {
  it("DEV이고 ?mock=1이면 true", () => {
    setLocation("?mock=1");
    expect(isMockEnabled()).toBe(true);
  });

  it("DEV이지만 ?mock 없으면 false", () => {
    setLocation("");
    expect(isMockEnabled()).toBe(false);
  });

  it("VITE_API_MOCK=1 이면 true", () => {
    setLocation("");
    vi.stubEnv("VITE_API_MOCK", "1");
    expect(isMockEnabled()).toBe(true);
  });

  it("?mock=1 이후 다른 페이지에서도 sessionStorage에 의해 유지", () => {
    setLocation("?mock=1");
    expect(isMockEnabled()).toBe(true);
    setLocation("");
    expect(isMockEnabled()).toBe(true);
  });
});

describe("resolveMock", () => {
  it("mock 비활성이면 null", () => {
    setLocation("");
    expect(
      resolveMock("/workspaces/1/domain-packs/1/versions/1/intents", { method: "GET" }),
    ).toBeNull();
  });

  it("mock 활성이고 GET 매칭이면 데이터 반환", () => {
    setLocation("?mock=1");
    const res = resolveMock<unknown[]>("/workspaces/1/domain-packs/1/versions/1/intents", {
      method: "GET",
    });
    expect(Array.isArray(res)).toBe(true);
  });

  it("mock 활성이지만 미지원 path는 null", () => {
    setLocation("?mock=1");
    expect(resolveMock("/unknown", { method: "GET" })).toBeNull();
  });
});
