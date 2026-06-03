import { beforeEach, describe, expect, it, vi } from "vitest";
import { isOrderProcessed, markOrderProcessed } from "./orderGuard";

const STORAGE_KEY = "ostone.billing.processedOrders";

function clearStorage() {
  sessionStorage.removeItem(STORAGE_KEY);
}

describe("isOrderProcessed / markOrderProcessed", () => {
  beforeEach(() => {
    clearStorage();
  });

  it("처음에는 어떤 orderId도 processed가 아님", () => {
    expect(isOrderProcessed("order-abc")).toBe(false);
  });

  it("markOrderProcessed 후 isOrderProcessed가 true", () => {
    markOrderProcessed("order-001");
    expect(isOrderProcessed("order-001")).toBe(true);
  });

  it("다른 orderId에는 영향 없음", () => {
    markOrderProcessed("order-A");
    expect(isOrderProcessed("order-B")).toBe(false);
  });

  it("동일 orderId 중복 mark는 중복 없이 저장", () => {
    markOrderProcessed("order-dup");
    markOrderProcessed("order-dup");
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]") as string[];
    expect(stored.filter((v) => v === "order-dup")).toHaveLength(1);
  });

  it("50건 초과 시 최근 50건만 유지", () => {
    for (let i = 0; i < 55; i++) {
      markOrderProcessed(`order-${i}`);
    }
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]") as string[];
    expect(stored).toHaveLength(50);
    expect(stored[49]).toBe("order-54");
  });

  it("sessionStorage에 잘못된 JSON이 있으면 빈 배열로 fallback", () => {
    sessionStorage.setItem(STORAGE_KEY, "not-valid-json");
    expect(isOrderProcessed("any-order")).toBe(false);
  });

  it("sessionStorage에 배열 아닌 값이 있으면 빈 배열로 fallback", () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ notAnArray: true }));
    expect(isOrderProcessed("any-order")).toBe(false);
    markOrderProcessed("order-x");
    expect(isOrderProcessed("order-x")).toBe(true);
  });

  it("sessionStorage 쓰기 실패 시 크래시 없이 무시", () => {
    const originalSetItem = sessionStorage.setItem.bind(sessionStorage);
    vi.spyOn(sessionStorage, "setItem").mockImplementationOnce(() => {
      throw new Error("storage full");
    });
    expect(() => markOrderProcessed("order-fail")).not.toThrow();
    sessionStorage.setItem = originalSetItem;
  });
});
