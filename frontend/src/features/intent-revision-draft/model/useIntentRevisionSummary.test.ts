// @vitest-environment node

import { describe, expect, it } from "vitest";
import type { IntentSummary } from "@/entities/intent";
import { buildIntentRevisionSummary } from "./useIntentRevisionSummary";

function intent(overrides: Partial<IntentSummary>): IntentSummary {
  return {
    id: 1,
    intentCode: "refund",
    name: "환불 문의",
    description: "환불 조건 확인",
    taxonomyLevel: 1,
    parentIntentId: undefined,
    status: "PUBLISHED",
    sourceClusterRef: "{}",
    createdAt: "",
    updatedAt: "",
    ...overrides,
  } as IntentSummary;
}

describe("buildIntentRevisionSummary", () => {
  it("intentCode 기준으로 name과 description 변경을 계산한다", () => {
    const summary = buildIntentRevisionSummary(
      [intent({ id: 10, intentCode: "refund", name: "환불", description: "기존 설명" })],
      [
        intent({
          id: 20,
          intentCode: "refund",
          name: "환불 문의",
          description: "새 설명",
        }),
      ],
    );

    expect(summary.changedIntents).toHaveLength(1);
    expect(summary.changedIntents[0]).toMatchObject({
      intentId: 20,
      intentCode: "refund",
      fields: ["name", "description"],
      before: { name: "환불", description: "기존 설명" },
      after: { name: "환불 문의", description: "새 설명" },
    });
    expect(summary.changedFieldCounts).toEqual({ name: 1, description: 1 });
    expect(summary.changedByDraftIntentId[20]?.intentCode).toBe("refund");
  });

  it("description null과 빈 문자열은 같은 값으로 취급한다", () => {
    const summary = buildIntentRevisionSummary(
      [intent({ id: 10, description: null as unknown as string })],
      [intent({ id: 20, description: "" })],
    );

    expect(summary.changedIntents).toHaveLength(0);
  });

  it("base에 없는 draft intent는 diff 대상에서 제외한다", () => {
    const summary = buildIntentRevisionSummary(
      [intent({ id: 10, intentCode: "refund" })],
      [intent({ id: 20, intentCode: "delivery", name: "배송 문의" })],
    );

    expect(summary.changedIntents).toHaveLength(0);
  });
});
