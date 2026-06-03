import { describe, expect, it } from "vitest";
import { deriveCustomerKey } from "./customerKey";

describe("deriveCustomerKey", () => {
  it("existing가 있으면 기존 값 반환", () => {
    expect(deriveCustomerKey(1, "existing-key")).toBe("existing-key");
  });

  it("existing가 없으면 ws_{workspaceId} 생성", () => {
    expect(deriveCustomerKey(42)).toBe("ws_42");
  });

  it("existing이 null이면 ws_{workspaceId} 생성", () => {
    expect(deriveCustomerKey(7, null)).toBe("ws_7");
  });

  it("existing이 빈 문자열이면 ws_{workspaceId} 생성", () => {
    expect(deriveCustomerKey(3, "")).toBe("ws_3");
  });

  it("workspaceId가 문자열이어도 동작", () => {
    expect(deriveCustomerKey("abc")).toBe("ws_abc");
  });

  it("existing 값이 있을 때 workspaceId와 무관하게 existing 반환", () => {
    expect(deriveCustomerKey(999, "server-assigned-key")).toBe("server-assigned-key");
  });
});
