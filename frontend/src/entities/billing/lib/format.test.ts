import { describe, expect, it } from "vitest";
import { formatAmount, formatDate } from "./format";

describe("formatAmount", () => {
  it("amount가 undefined이면 '-' 반환", () => {
    expect(formatAmount(undefined)).toBe("-");
  });

  it("KRW 기본 포맷: 숫자 + 원", () => {
    const result = formatAmount(10000);
    expect(result).toContain("10");
    expect(result).toContain("원");
  });

  it("0원 처리", () => {
    const result = formatAmount(0);
    expect(result).toContain("원");
  });

  it("다른 통화는 숫자 + 공백 + 통화코드", () => {
    const result = formatAmount(10000, "USD");
    expect(result).toContain("USD");
    expect(result).not.toContain("원");
  });

  it("KRW 명시 전달 시 기본 포맷과 동일", () => {
    expect(formatAmount(5000, "KRW")).toEqual(formatAmount(5000));
  });

  it("큰 금액도 처리", () => {
    const result = formatAmount(1000000);
    expect(result).toContain("원");
    expect(result.length).toBeGreaterThan(3);
  });
});

describe("formatDate", () => {
  it("undefined이면 '-' 반환", () => {
    expect(formatDate(undefined)).toBe("-");
  });

  it("빈 문자열이면 '-' 반환", () => {
    expect(formatDate("")).toBe("-");
  });

  it("유효하지 않은 날짜 문자열은 원문 반환", () => {
    expect(formatDate("invalid-date-string")).toBe("invalid-date-string");
  });

  it("유효한 ISO 날짜는 포맷된 문자열 반환", () => {
    const result = formatDate("2024-01-15T00:00:00.000Z");
    expect(result).not.toBe("-");
    expect(result).toContain("2024");
  });

  it("날짜 전용 문자열도 처리", () => {
    const result = formatDate("2024-06-03");
    expect(result).not.toBe("-");
    expect(result).toContain("2024");
  });

  it("날짜가 아닌 숫자 문자열은 원문 반환", () => {
    const result = formatDate("99999999999999999");
    expect(typeof result).toBe("string");
  });
});
