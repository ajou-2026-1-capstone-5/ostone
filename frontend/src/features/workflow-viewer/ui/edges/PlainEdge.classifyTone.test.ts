import { describe, expect, it } from "vitest";
import { classifyLabelTone } from "./edgeLabelTone";

describe("classifyLabelTone", () => {
  it("returns neutral for undefined or non-string", () => {
    expect(classifyLabelTone(undefined)).toBe("neutral");
    expect(classifyLabelTone(null)).toBe("neutral");
    expect(classifyLabelTone(42)).toBe("neutral");
    expect(classifyLabelTone({})).toBe("neutral");
  });

  it("returns neutral for empty string", () => {
    expect(classifyLabelTone("")).toBe("neutral");
    expect(classifyLabelTone("   ")).toBe("neutral");
  });

  it("returns yes for English positive tokens", () => {
    expect(classifyLabelTone("yes")).toBe("yes");
    expect(classifyLabelTone("YES")).toBe("yes");
    expect(classifyLabelTone("True")).toBe("yes");
    expect(classifyLabelTone("ok")).toBe("yes");
    expect(classifyLabelTone("match")).toBe("yes");
    expect(classifyLabelTone("VIP")).toBe("yes");
  });

  it("returns yes for Korean positive tokens", () => {
    expect(classifyLabelTone("있음")).toBe("yes");
    expect(classifyLabelTone("일치")).toBe("yes");
    expect(classifyLabelTone("VIP 일치")).toBe("yes");
  });

  it("returns no for English negative tokens", () => {
    expect(classifyLabelTone("no")).toBe("no");
    expect(classifyLabelTone("NO")).toBe("no");
    expect(classifyLabelTone("false")).toBe("no");
    expect(classifyLabelTone("fail")).toBe("no");
    expect(classifyLabelTone("miss")).toBe("no");
    expect(classifyLabelTone("fallback")).toBe("no");
  });

  it("returns no for Korean negative tokens", () => {
    expect(classifyLabelTone("없음")).toBe("no");
    expect(classifyLabelTone("불일치")).toBe("no");
  });

  it("correctly classifies '일치하지 않음' as no (not yes)", () => {
    // Regression: substring 'includes' would incorrectly match '일치' first
    expect(classifyLabelTone("일치하지 않음")).toBe("no");
    expect(classifyLabelTone("일치하지않음")).toBe("no");
  });

  it("does not match yes patterns inside other words", () => {
    expect(classifyLabelTone("yesterday")).toBe("neutral");
    expect(classifyLabelTone("notable")).toBe("neutral");
    expect(classifyLabelTone("missile")).toBe("neutral");
  });

  it("returns neutral for tokens without positive/negative meaning", () => {
    expect(classifyLabelTone("retry × 3")).toBe("neutral");
    expect(classifyLabelTone("기본 흐름")).toBe("neutral");
    expect(classifyLabelTone("일반 회원")).toBe("neutral");
  });

  it("prefers no over yes when both could match (no-first ordering)", () => {
    // Defensive: if a label somehow contained both yes & no tokens, no wins.
    expect(classifyLabelTone("yes but actually no")).toBe("no");
  });

  it("trims surrounding whitespace before classifying", () => {
    expect(classifyLabelTone("  yes  ")).toBe("yes");
    expect(classifyLabelTone("\tno\n")).toBe("no");
  });
});
