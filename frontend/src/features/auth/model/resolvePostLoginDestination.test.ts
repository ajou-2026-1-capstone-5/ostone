import { describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_POST_LOGIN_PATH,
  resolvePostLoginDestination,
  resolveReturnToPostLoginDestination,
} from "./resolvePostLoginDestination";

describe("resolvePostLoginDestination", () => {
  it("allows /workspaces paths", () => {
    expect(
      resolvePostLoginDestination({
        from: { pathname: "/workspaces", search: "?tab=logs" },
      }),
    ).toBe("/workspaces?tab=logs");
    expect(
      resolvePostLoginDestination({
        from: { pathname: "/workspaces/1/upload", search: "?tab=logs" },
      }),
    ).toBe("/workspaces/1/upload?tab=logs");
  });

  it("allows canonical and legacy demo chat paths", () => {
    expect(
      resolvePostLoginDestination({
        from: { pathname: "/demo/chat/1", search: "?preview=true" },
      }),
    ).toBe("/demo/chat/1?preview=true");
    expect(
      resolvePostLoginDestination({
        from: { pathname: "/demo/workspaces/1/chat", search: "?preview=true" },
      }),
    ).toBe("/demo/workspaces/1/chat?preview=true");
  });

  it("falls back for authenticated user chat paths so login lands on workspace first", () => {
    expect(
      resolvePostLoginDestination({
        from: { pathname: "/chat/2", search: "?name=%EB%B0%95%ED%95%98%EB%82%98" },
      }),
    ).toBe(DEFAULT_POST_LOGIN_PATH);
  });

  it("falls back for auth routes", () => {
    expect(resolvePostLoginDestination({ from: { pathname: "/login" } })).toBe(
      DEFAULT_POST_LOGIN_PATH,
    );
    expect(resolvePostLoginDestination({ from: { pathname: "/signup" } })).toBe(
      DEFAULT_POST_LOGIN_PATH,
    );
    expect(resolveReturnToPostLoginDestination({ from: { pathname: "/login" } })).toBeNull();
  });

  it("falls back for paths outside the workspace route boundary", () => {
    expect(resolvePostLoginDestination({ from: { pathname: "/workspaces-public" } })).toBe(
      DEFAULT_POST_LOGIN_PATH,
    );
  });

  it("falls back for dot-segment workspace paths", () => {
    expect(resolvePostLoginDestination({ from: { pathname: "/workspaces/../login" } })).toBe(
      DEFAULT_POST_LOGIN_PATH,
    );
    expect(
      resolvePostLoginDestination({
        from: { pathname: "/workspaces/%2e%2e/login" },
      }),
    ).toBe(DEFAULT_POST_LOGIN_PATH);
  });

  it("falls back for external URLs", () => {
    expect(
      resolvePostLoginDestination({
        from: { pathname: "https://example.com/workspaces" },
      }),
    ).toBe(DEFAULT_POST_LOGIN_PATH);
    expect(
      resolvePostLoginDestination({
        from: { pathname: "//example.com/workspaces" },
      }),
    ).toBe(DEFAULT_POST_LOGIN_PATH);
  });

  it("falls back when pathname is missing", () => {
    expect(resolvePostLoginDestination(undefined)).toBe(DEFAULT_POST_LOGIN_PATH);
    expect(resolvePostLoginDestination({ from: {} })).toBe(DEFAULT_POST_LOGIN_PATH);
    expect(resolveReturnToPostLoginDestination(undefined)).toBeNull();
  });

  it("ignores malformed search values", () => {
    expect(
      resolvePostLoginDestination({
        from: { pathname: "/workspaces/1", search: "next=/login" },
      }),
    ).toBe("/workspaces/1");
  });
});
