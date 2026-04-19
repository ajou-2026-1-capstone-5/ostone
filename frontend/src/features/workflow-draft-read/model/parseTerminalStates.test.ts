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
    const result = parseTerminalStates(raw);
    expect(result).toEqual({ ok: true, value: ["terminal", "cancelled"] });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("빈 배열 문자열을 빈 배열로 파싱한다", () => {
    expect(parseTerminalStates("[]")).toEqual({ ok: true, value: [] });
  });

  it("JSON 파싱에 실패하면 ok:false와 raw를 반환하고 경고를 남긴다", () => {
    const broken = "[terminal";
    expect(parseTerminalStates(broken)).toEqual({ ok: false, raw: broken });
    expect(warnSpy).toHaveBeenCalled();
  });

  it("결과가 배열이 아니면 ok:false와 raw를 반환한다", () => {
    const notArray = '{"foo":"bar"}';
    expect(parseTerminalStates(notArray)).toEqual({ ok: false, raw: notArray });
    expect(warnSpy).toHaveBeenCalled();
  });

  it("결과가 문자열 아닌 값의 배열이면 ok:false와 raw를 반환한다", () => {
    const mixed = "[1,2,3]";
    expect(parseTerminalStates(mixed)).toEqual({ ok: false, raw: mixed });
    expect(warnSpy).toHaveBeenCalled();
  });
});
