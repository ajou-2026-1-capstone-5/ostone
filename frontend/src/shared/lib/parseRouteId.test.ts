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

  it('"0" → null (백엔드 ID는 양의 정수)', () => {
    expect(parseRouteId("0")).toBeNull();
  });

  it('빈 문자열 → null', () => {
    expect(parseRouteId("")).toBeNull();
  });

  it('공백 문자열 → null', () => {
    expect(parseRouteId(" ")).toBeNull();
    expect(parseRouteId("  ")).toBeNull();
  });

  it('소수점 → null', () => {
    expect(parseRouteId("1.5")).toBeNull();
  });

  it('음수 → null', () => {
    expect(parseRouteId("-1")).toBeNull();
  });

  it('지수 표기법 → null', () => {
    expect(parseRouteId("1e3")).toBeNull();
  });
});
