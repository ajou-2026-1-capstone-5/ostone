// @vitest-environment node

import { describe, expect, it } from "vitest";
import { parseIntentRevisionDraftSource, isIntentRevisionDraft } from "./draftSource";

describe("parseIntentRevisionDraftSource", () => {
  it("INTENT_REVISION draftSource를 파싱한다", () => {
    expect(
      parseIntentRevisionDraftSource(
        JSON.stringify({
          draftSource: {
            type: "INTENT_REVISION",
            baseVersionId: 12,
            baseVersionNo: 4,
            reason: "intent 보정",
          },
        }),
      ),
    ).toEqual({
      type: "INTENT_REVISION",
      baseVersionId: 12,
      baseVersionNo: 4,
      reason: "intent 보정",
    });
  });

  it("파싱 실패나 baseVersionId 누락은 null로 처리한다", () => {
    expect(parseIntentRevisionDraftSource("{bad json}")).toBeNull();
    expect(
      parseIntentRevisionDraftSource(JSON.stringify({ draftSource: { type: "INTENT_REVISION" } })),
    ).toBeNull();
  });

  it("다른 draftSource type은 INTENT_REVISION으로 간주하지 않는다", () => {
    expect(
      parseIntentRevisionDraftSource(
        JSON.stringify({ draftSource: { type: "RESTORE", baseVersionId: 12 } }),
      ),
    ).toBeNull();
  });

  it("draftSource가 배열이면 null을 반환한다", () => {
    expect(parseIntentRevisionDraftSource(JSON.stringify({ draftSource: [1, 2, 3] }))).toBeNull();
  });

  it("summaryJson이 null이나 빈 문자열이면 null을 반환한다", () => {
    expect(parseIntentRevisionDraftSource(null)).toBeNull();
    expect(parseIntentRevisionDraftSource("")).toBeNull();
  });
});

describe("isIntentRevisionDraft", () => {
  it("DRAFT 상태이고 INTENT_REVISION type이면 true를 반환한다", () => {
    expect(
      isIntentRevisionDraft({
        versionId: 1,
        versionNo: 1,
        lifecycleStatus: "DRAFT",
        summaryJson: JSON.stringify({
          draftSource: { type: "INTENT_REVISION", baseVersionId: 10 },
        }),
      } as Parameters<typeof isIntentRevisionDraft>[0]),
    ).toBe(true);
  });

  it("PUBLISHED 상태이면 false를 반환한다", () => {
    expect(
      isIntentRevisionDraft({
        versionId: 1,
        versionNo: 1,
        lifecycleStatus: "PUBLISHED",
        summaryJson: JSON.stringify({
          draftSource: { type: "INTENT_REVISION", baseVersionId: 10 },
        }),
      } as Parameters<typeof isIntentRevisionDraft>[0]),
    ).toBe(false);
  });

  it("version이 undefined이면 false를 반환한다", () => {
    expect(isIntentRevisionDraft(undefined)).toBe(false);
  });

  it("draftSource가 없으면 false를 반환한다", () => {
    expect(
      isIntentRevisionDraft({
        versionId: 1,
        versionNo: 1,
        lifecycleStatus: "DRAFT",
        summaryJson: JSON.stringify({}),
      } as Parameters<typeof isIntentRevisionDraft>[0]),
    ).toBe(false);
  });
});
