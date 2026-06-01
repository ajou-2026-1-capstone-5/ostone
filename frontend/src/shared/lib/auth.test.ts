import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  clearAuthSession,
  getAccessToken,
  getAuthUser,
  getRefreshToken,
  isAuthenticated,
  saveAuthSession,
  saveAuthTokens,
} from "./auth";

function toBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function createToken(payload: Record<string, unknown>): string {
  return ["header", toBase64Url(JSON.stringify(payload)), "signature"].join(".");
}

describe("isAuthenticated", () => {
  afterEach(() => {
    vi.useRealTimers();
    clearAuthSession();
  });

  it("returns true only when access token has a future numeric exp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T00:00:00Z"));
    localStorage.setItem("accessToken", createToken({ exp: Date.now() / 1000 + 60 }));

    expect(isAuthenticated()).toBe(true);
  });

  it("returns false when exp is missing or invalid", () => {
    localStorage.setItem("accessToken", createToken({}));
    expect(isAuthenticated()).toBe(false);

    localStorage.setItem("accessToken", createToken({ exp: "9999999999" }));
    expect(isAuthenticated()).toBe(false);
  });

  it("returns false when token is expired or malformed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T00:00:00Z"));
    localStorage.setItem("accessToken", createToken({ exp: Date.now() / 1000 - 60 }));
    expect(isAuthenticated()).toBe(false);

    localStorage.setItem("accessToken", "not-a-jwt");
    expect(isAuthenticated()).toBe(false);
  });

  it("saves, reads, and clears auth session values", () => {
    saveAuthSession(
      {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        tokenType: "Bearer",
        expiresIn: 3600,
      },
      { id: 1, email: "admin@ostone.com", name: "관리자", role: "ADMIN" },
    );

    expect(getAccessToken()).toBe("access-token");
    expect(getRefreshToken()).toBe("refresh-token");
    expect(getAuthUser()).toEqual({
      id: 1,
      email: "admin@ostone.com",
      name: "관리자",
      role: "ADMIN",
    });

    clearAuthSession();

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(getAuthUser()).toBeNull();
  });

  it("updates tokens while preserving stored auth user", () => {
    saveAuthSession(
      {
        accessToken: "old-access-token",
        refreshToken: "old-refresh-token",
        tokenType: "Bearer",
        expiresIn: 3600,
      },
      { id: 1, email: "admin@ostone.com", name: "관리자", role: "ADMIN" },
    );

    saveAuthTokens({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
      tokenType: "Bearer",
      expiresIn: 3600,
    });

    expect(getAccessToken()).toBe("new-access-token");
    expect(getRefreshToken()).toBe("new-refresh-token");
    expect(getAuthUser()).toEqual({
      id: 1,
      email: "admin@ostone.com",
      name: "관리자",
      role: "ADMIN",
    });
  });

  it("returns null when stored auth user JSON is malformed", () => {
    localStorage.setItem("user", "{not-json");

    expect(getAuthUser()).toBeNull();
  });

  it("falls back to memory storage when localStorage cannot be used", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    const removeItemSpy = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {});

    saveAuthSession(
      {
        accessToken: "memory-access-token",
        refreshToken: "memory-refresh-token",
        tokenType: "Bearer",
        expiresIn: 3600,
      },
      { id: 2, email: "agent@ostone.com", name: "상담사", role: "AGENT" },
    );

    expect(getAccessToken()).toBe("memory-access-token");
    expect(getRefreshToken()).toBe("memory-refresh-token");
    expect(getAuthUser()).toEqual({
      id: 2,
      email: "agent@ostone.com",
      name: "상담사",
      role: "AGENT",
    });

    clearAuthSession();
    expect(getAccessToken()).toBeNull();

    setItemSpy.mockRestore();
    removeItemSpy.mockRestore();
  });
});
