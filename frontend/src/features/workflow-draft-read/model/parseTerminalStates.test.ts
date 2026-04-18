import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseTerminalStates } from "./parseTerminalStates";

describe("parseTerminalStates", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("문자열로 직렬화된 배열을 string[]로 파싱한다", () => {
    const raw = '["terminal","cancelled"]';
    expect(parseTerminalStates(raw)).toEqual(["terminal", "cancelled"]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("빈 배열 문자열을 빈 배열로 파싱한다", () => {
    expect(parseTerminalStates("[]")).toEqual([]);
  });

  it("JSON 파싱에 실패하면 raw 문자열을 반환하고 경고를 남긴다", () => {
    const broken = "[terminal";
    expect(parseTerminalStates(broken)).toBe(broken);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("결과가 배열이 아니면 raw 문자열을 반환한다", () => {
    const notArray = '{"foo":"bar"}';
    expect(parseTerminalStates(notArray)).toBe(notArray);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("결과가 문자열 아닌 값의 배열이면 raw를 반환한다", () => {
    const mixed = "[1,2,3]";
    expect(parseTerminalStates(mixed)).toBe(mixed);
    expect(warnSpy).toHaveBeenCalled();
  });
});
