import { describe, it, expect } from "vitest";
import { parseRouteId } from "./parseRouteId";

describe("parseRouteId", () => {
  it("undefined → null", () => {
    expect(parseRouteId(undefined)).toBeNull();
  });

  it("숫자가 아닌 문자열 → null", () => {
    expect(parseRouteId("abc")).toBeNull();
  });

  it('"NaN" 문자열 → null', () => {
    expect(parseRouteId("NaN")).toBeNull();
  });

  it("정상 숫자 문자열 → 숫자", () => {
    expect(parseRouteId("42")).toBe(42);
  });

  it('"0" → 0', () => {
    expect(parseRouteId("0")).toBe(0);
  });
});
