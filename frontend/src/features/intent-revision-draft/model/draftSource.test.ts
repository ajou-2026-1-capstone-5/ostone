// @vitest-environment node

import { describe, expect, it } from "vitest";
import { parseIntentRevisionDraftSource } from "./draftSource";

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
});
