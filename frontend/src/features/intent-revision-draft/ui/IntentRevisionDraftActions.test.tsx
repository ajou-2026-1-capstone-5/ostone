import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { IntentRevisionSummary } from "../model/useIntentRevisionSummary";
import { IntentRevisionDraftActions } from "./IntentRevisionDraftActions";

const summary: IntentRevisionSummary = {
  changedIntents: [
    {
      intentId: 10,
      intentCode: "refund",
      name: "환불 문의",
      fields: ["name", "description"],
      before: { name: "환불", description: "기존 설명" },
      after: { name: "환불 문의", description: "새 설명" },
    },
  ],
  changedFieldCounts: { name: 1, description: 1 },
  changedByDraftIntentId: {},
};

function renderActions(
  props: Partial<React.ComponentProps<typeof IntentRevisionDraftActions>> = {},
) {
  const defaults = {
    summary,
    isSummaryLoading: false,
    summaryError: null,
    isPending: false,
    onRetrySummary: vi.fn(),
  };

  render(<IntentRevisionDraftActions {...defaults} {...props} />);
  return defaults;
}

describe("IntentRevisionDraftActions", () => {
  it("변경 요약과 Domain Pack 화면 안내 문구를 보여준다", () => {
    renderActions();

    expect(screen.getByText("변경된 상담 유형 1개")).toBeInTheDocument();
    expect(
      screen.getByText("수정 내용의 적용 및 삭제는 도메인팩 화면에서 진행할 수 있습니다."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "적용" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "취소" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "삭제" })).not.toBeInTheDocument();
  });

  it("변경 요약 조회 실패 시 retry만 제공한다", () => {
    const { onRetrySummary } = renderActions({
      summary: undefined,
      summaryError: "변경 요약을 불러오지 못했습니다.",
    });

    expect(screen.getByText("변경 요약을 불러오지 못했습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onRetrySummary).toHaveBeenCalledTimes(1);
  });

  it("빈 문자열 error도 error state로 처리하고 retry를 제공한다", () => {
    renderActions({
      summary: undefined,
      summaryError: "",
    });

    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    expect(screen.queryByText("변경된 상담 유형이 없습니다.")).not.toBeInTheDocument();
  });

  it("요약 로딩 중에는 로딩 문구와 안내 문구만 보여준다", () => {
    renderActions({ summary: undefined, isSummaryLoading: true });

    expect(screen.getByText("변경 요약을 불러오는 중입니다.")).toBeInTheDocument();
    expect(
      screen.getByText("수정 내용의 적용 및 삭제는 도메인팩 화면에서 진행할 수 있습니다."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "적용" })).not.toBeInTheDocument();
  });

  it("변경된 intent가 없으면 empty 문구를 보여준다", () => {
    renderActions({
      summary: {
        changedIntents: [],
        changedFieldCounts: { name: 0, description: 0 },
        changedByDraftIntentId: {},
      },
    });

    expect(screen.getByText("변경된 상담 유형이 없습니다.")).toBeInTheDocument();
  });
});
