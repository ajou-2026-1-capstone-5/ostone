import { describe, expect, it } from "vitest";
import {
  formatRawJson,
  isBlankJson,
  labelForKey,
  toReadableJson,
  type ReadableJson,
} from "./readableJson";

describe("labelForKey", () => {
  it("알려진 키는 한국어 라벨로 매핑한다", () => {
    expect(labelForKey("type")).toBe("유형");
    expect(labelForKey("required")).toBe("필수 여부");
    expect(labelForKey("channel")).toBe("채널");
  });

  it("알 수 없는 camelCase/snake_case 키는 사람이 읽기 쉽게 변환한다", () => {
    expect(labelForKey("maxRetryCount")).toBe("Max Retry Count");
    expect(labelForKey("snake_case_key")).toBe("Snake case key");
    expect(labelForKey("simple")).toBe("Simple");
  });
});

describe("isBlankJson", () => {
  it("빈 값으로 간주되는 입력을 true로 판단한다", () => {
    expect(isBlankJson(null)).toBe(true);
    expect(isBlankJson(undefined)).toBe(true);
    expect(isBlankJson("")).toBe(true);
    expect(isBlankJson("   ")).toBe(true);
    expect(isBlankJson("null")).toBe(true);
    expect(isBlankJson("{}")).toBe(true);
    expect(isBlankJson("[]")).toBe(true);
    expect(isBlankJson({})).toBe(true);
    expect(isBlankJson([])).toBe(true);
  });

  it("내용이 있는 입력은 false로 판단한다", () => {
    expect(isBlankJson('{"a":1}')).toBe(false);
    expect(isBlankJson("plain")).toBe(false);
    expect(isBlankJson({ a: 1 })).toBe(false);
    expect(isBlankJson(0)).toBe(false);
  });
});

describe("toReadableJson", () => {
  it("빈 값은 empty kind를 반환한다", () => {
    expect(toReadableJson(null)).toEqual({ kind: "empty" });
    expect(toReadableJson("")).toEqual({ kind: "empty" });
    expect(toReadableJson("{}")).toEqual({ kind: "empty" });
  });

  it("파싱 가능한 객체는 라벨링된 entries로 변환한다", () => {
    const result = toReadableJson('{"type":"MANUAL_REVIEW","required":true,"min":3}');
    expect(result).toEqual<ReadableJson>({
      kind: "object",
      entries: [
        { label: "유형", value: "MANUAL_REVIEW" },
        { label: "필수 여부", value: "예" },
        { label: "최솟값", value: "3" },
      ],
    });
  });

  it("중첩 객체/배열 값은 읽기 쉬운 문자열로 평탄화한다", () => {
    const result = toReadableJson('{"range":{"min":1,"max":9},"tags":["a","b"]}');
    expect(result).toEqual<ReadableJson>({
      kind: "object",
      entries: [
        { label: "Range", value: "최솟값: 1, 최댓값: 9" },
        { label: "Tags", value: "a, b" },
      ],
    });
  });

  it("배열은 list kind로 변환한다", () => {
    expect(toReadableJson('["환불","교환"]')).toEqual<ReadableJson>({
      kind: "list",
      items: ["환불", "교환"],
    });
  });

  it("원시 스칼라는 scalar kind로 변환한다", () => {
    expect(toReadableJson('"ready"')).toEqual<ReadableJson>({ kind: "scalar", value: "ready" });
    expect(toReadableJson("42")).toEqual<ReadableJson>({ kind: "scalar", value: "42" });
    expect(toReadableJson("true")).toEqual<ReadableJson>({ kind: "scalar", value: "예" });
  });

  it("파싱되지 않는 문자열은 raw kind로 원문을 보존한다", () => {
    expect(toReadableJson("{invalid-json")).toEqual<ReadableJson>({
      kind: "raw",
      text: "{invalid-json",
    });
  });

  it("문자열이 아닌 객체 입력도 방어적으로 처리한다", () => {
    expect(toReadableJson({ channel: "web" })).toEqual<ReadableJson>({
      kind: "object",
      entries: [{ label: "채널", value: "web" }],
    });
  });

  it("값이 모두 비면 empty로 떨어진다", () => {
    expect(toReadableJson('{"a":null,"b":""}')).toEqual({ kind: "empty" });
    expect(toReadableJson('[null,""]')).toEqual({ kind: "empty" });
  });

  it("유한하지 않은 숫자 항목은 제외한다", () => {
    expect(toReadableJson({ x: Infinity, y: 5 })).toEqual<ReadableJson>({
      kind: "object",
      entries: [{ label: "Y", value: "5" }],
    });
  });

  it("문자열 변환만 가능한 스칼라도 안전하게 표시한다", () => {
    expect(toReadableJson(10n)).toEqual<ReadableJson>({ kind: "scalar", value: "10" });
  });
});

describe("formatRawJson", () => {
  it("문자열 JSON은 정렬된 형태로 pretty-print한다", () => {
    expect(formatRawJson('{"a":1}')).toBe('{\n  "a": 1\n}');
  });

  it("파싱 불가 문자열은 원문을 반환한다", () => {
    expect(formatRawJson("not json")).toBe("not json");
  });

  it("객체 입력도 pretty-print한다", () => {
    expect(formatRawJson({ a: 1 })).toBe('{\n  "a": 1\n}');
  });

  it("직렬화할 수 없는 입력은 String fallback을 반환한다", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(formatRawJson(circular)).toBe("[object Object]");
  });
});
