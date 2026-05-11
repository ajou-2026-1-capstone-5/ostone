import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useIntentRevisionMarkers } from "./useIntentRevisionMarkers";
import type { IntentRevisionSummaryState } from "./useIntentRevisionSummary";

const readySummary: IntentRevisionSummaryState = {
  status: "ready",
  data: {
    changedIntents: [
      {
        intentId: 10,
        intentCode: "refund",
        name: "환불 문의",
        fields: ["name"],
        before: { name: "환불", description: "" },
        after: { name: "환불 문의", description: "" },
      },
    ],
    changedFieldCounts: { name: 1, description: 0 },
    changedByDraftIntentId: {},
  },
};

describe("useIntentRevisionMarkers", () => {
  it("저장된 변경과 현재 편집 중인 intent marker를 함께 반환한다", () => {
    const { result } = renderHook(() =>
      useIntentRevisionMarkers({
        editingIntentId: 20,
        isDirty: true,
        summaryState: readySummary,
      }),
    );

    expect(result.current).toEqual({
      10: "수정됨",
      20: "수정 중",
    });
  });

  it("편집 중인 intent가 이미 변경 목록에 있으면 수정 중 marker를 우선한다", () => {
    const { result } = renderHook(() =>
      useIntentRevisionMarkers({
        editingIntentId: 10,
        isDirty: true,
        summaryState: readySummary,
      }),
    );

    expect(result.current).toEqual({ 10: "수정 중" });
  });

  it("summary가 ready가 아니고 dirty도 아니면 빈 marker를 반환한다", () => {
    const { result } = renderHook(() =>
      useIntentRevisionMarkers({
        editingIntentId: 10,
        isDirty: false,
        summaryState: { status: "loading" },
      }),
    );

    expect(result.current).toEqual({});
  });
});
