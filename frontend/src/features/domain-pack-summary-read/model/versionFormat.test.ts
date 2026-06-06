import { describe, expect, it } from "vitest";
import {
  buildActionSummary,
  formatCurrentVersionLabel,
  formatDateTime,
  formatLifecycleStatus,
  formatVersionNo,
  normalizeDescription,
} from "./versionFormat";

describe("formatLifecycleStatus", () => {
  it("maps known lifecycle statuses to Korean labels", () => {
    expect(formatLifecycleStatus("PUBLISHED")).toBe("운영 가능");
    expect(formatLifecycleStatus("DRAFT")).toBe("검토 중");
  });

  it("never leaks an unknown raw status to operators", () => {
    expect(formatLifecycleStatus("ARCHIVED")).toBe("상태 없음");
    expect(formatLifecycleStatus(null)).toBe("상태 없음");
    expect(formatLifecycleStatus(undefined)).toBe("상태 없음");
  });
});

describe("formatVersionNo", () => {
  it("prefixes a present version number with v", () => {
    expect(formatVersionNo(4)).toBe("v4");
  });

  it("uses a placeholder when the version number is missing", () => {
    expect(formatVersionNo(null)).toBe("선택한 버전");
    expect(formatVersionNo(undefined)).toBe("선택한 버전");
  });
});

describe("formatCurrentVersionLabel", () => {
  it("prefers the version number", () => {
    expect(formatCurrentVersionLabel(3, 99)).toBe("현재 v3");
  });

  it("falls back to id presence, then to no-version", () => {
    expect(formatCurrentVersionLabel(null, 99)).toBe("현재 운영 버전");
    expect(formatCurrentVersionLabel(null, null)).toBe("운영 버전 없음");
  });
});

describe("formatDateTime", () => {
  it("returns the raw string when the date cannot be parsed", () => {
    expect(formatDateTime("not-a-date")).toBe("not-a-date");
  });

  it("formats a valid ISO string", () => {
    expect(formatDateTime("2026-06-01T10:22:00Z")).not.toBe("2026-06-01T10:22:00Z");
  });
});

describe("normalizeDescription", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeDescription("  abc  ")).toBe("abc");
  });
});

describe("buildActionSummary", () => {
  it("returns null for empty or invalid JSON", () => {
    expect(buildActionSummary(null)).toBeNull();
    expect(buildActionSummary("")).toBeNull();
    expect(buildActionSummary("{not json")).toBeNull();
    expect(buildActionSummary("[]")).toBeNull();
  });

  it("prefers topic over nested sources", () => {
    expect(buildActionSummary(JSON.stringify({ topic: "환불 정리" }))).toBe("환불 정리");
  });

  it("falls back to draftSource.reason, then generation.description", () => {
    expect(buildActionSummary(JSON.stringify({ draftSource: { reason: "수정 사유" } }))).toBe(
      "수정 사유",
    );
    expect(buildActionSummary(JSON.stringify({ generation: { description: "생성 설명" } }))).toBe(
      "생성 설명",
    );
  });

  it("reads the first usable string from review arrays, including message/title objects", () => {
    expect(buildActionSummary(JSON.stringify({ review: { topIssues: ["첫 이슈"] } }))).toBe(
      "첫 이슈",
    );
    expect(
      buildActionSummary(JSON.stringify({ review: { issues: [{ message: "메시지 이슈" }] } })),
    ).toBe("메시지 이슈");
  });

  it("ignores blank strings and returns null when nothing usable exists", () => {
    expect(buildActionSummary(JSON.stringify({ topic: "   " }))).toBeNull();
  });
});
