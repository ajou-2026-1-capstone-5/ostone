import { describe, expect, it } from "vitest";
import { isValidElement } from "react";
import { readBadges, readString, renderNodeIcon, resolveNodeIcon } from "./nodeStyles";

describe("resolveNodeIcon", () => {
  it("returns kind-default icon when hint is omitted", () => {
    const Icon = resolveNodeIcon("START");
    expect(typeof Icon).toBe("object"); // forwardRef component
  });

  it("returns hinted icon when known hint provided", () => {
    const start = resolveNodeIcon("START");
    const action = resolveNodeIcon("ACTION");
    const startWithZapHint = resolveNodeIcon("START", "Zap");
    expect(startWithZapHint).toBe(action);
    expect(startWithZapHint).not.toBe(start);
  });

  it("falls back to kind default when hint is unknown", () => {
    const start = resolveNodeIcon("START");
    expect(resolveNodeIcon("START", "DefinitelyNotAnIcon")).toBe(start);
  });

  it("falls back to kind default when hint is empty string", () => {
    const action = resolveNodeIcon("ACTION");
    expect(resolveNodeIcon("ACTION", "")).toBe(action);
  });

  it("maps every node type to a distinct icon", () => {
    const icons = (["START", "ACTION", "DECISION", "ANSWER", "HANDOFF", "TERMINAL"] as const).map(
      (k) => resolveNodeIcon(k),
    );
    const unique = new Set(icons);
    expect(unique.size).toBe(icons.length);
  });
});

describe("renderNodeIcon", () => {
  it("returns a valid React element", () => {
    const node = renderNodeIcon("ACTION");
    expect(isValidElement(node)).toBe(true);
  });

  it("respects size override", () => {
    const node = renderNodeIcon("TERMINAL", undefined, { size: 24 });
    expect(isValidElement(node)).toBe(true);
    const props = (node as { props: { size?: number } }).props;
    expect(props.size).toBe(24);
  });

  it("applies className when provided", () => {
    const node = renderNodeIcon("ANSWER", undefined, { className: "custom-class" });
    const props = (node as { props: { className?: string } }).props;
    expect(props.className).toBe("custom-class");
  });

  it("defaults size to 14 when not provided", () => {
    const node = renderNodeIcon("START");
    const props = (node as { props: { size?: number } }).props;
    expect(props.size).toBe(14);
  });

  it("uses hinted icon when valid hint passed", () => {
    const viaHint = renderNodeIcon("START", "Zap");
    const viaKind = renderNodeIcon("ACTION");
    const a = (viaHint as { type: unknown }).type;
    const b = (viaKind as { type: unknown }).type;
    expect(a).toBe(b);
  });
});

describe("readString", () => {
  it("returns string when key has non-empty string value", () => {
    expect(readString({ label: "hello" }, "label")).toBe("hello");
  });

  it("returns undefined when key is missing", () => {
    expect(readString({ label: "hello" }, "missing")).toBeUndefined();
  });

  it("returns undefined when value is empty string", () => {
    expect(readString({ label: "" }, "label")).toBeUndefined();
  });

  it("returns undefined when value is not a string", () => {
    expect(readString({ label: 123 }, "label")).toBeUndefined();
    expect(readString({ label: null }, "label")).toBeUndefined();
    expect(readString({ label: { nested: "x" } }, "label")).toBeUndefined();
  });

  it("returns undefined when data is null or undefined", () => {
    expect(readString(null, "label")).toBeUndefined();
    expect(readString(undefined, "label")).toBeUndefined();
  });

  it("returns undefined when data is not an object", () => {
    expect(readString("string-data", "label")).toBeUndefined();
    expect(readString(42, "label")).toBeUndefined();
  });
});

describe("readBadges", () => {
  it("returns array of strings when data.badges is valid", () => {
    expect(readBadges({ badges: ["a", "b"] })).toEqual(["a", "b"]);
  });

  it("filters out non-string entries", () => {
    expect(readBadges({ badges: ["a", 1, null, "b", undefined] })).toEqual(["a", "b"]);
  });

  it("filters out empty strings", () => {
    expect(readBadges({ badges: ["a", "", "b"] })).toEqual(["a", "b"]);
  });

  it("returns undefined when badges is missing", () => {
    expect(readBadges({})).toBeUndefined();
  });

  it("returns undefined when badges is not an array", () => {
    expect(readBadges({ badges: "not-array" })).toBeUndefined();
    expect(readBadges({ badges: { 0: "a" } })).toBeUndefined();
  });

  it("returns undefined when all entries are filtered out", () => {
    expect(readBadges({ badges: ["", null, 0] })).toBeUndefined();
  });

  it("returns undefined when data is null", () => {
    expect(readBadges(null)).toBeUndefined();
  });

  it("returns undefined when data is not an object", () => {
    expect(readBadges("not-object")).toBeUndefined();
  });
});
