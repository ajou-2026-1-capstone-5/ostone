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
    onApply: vi.fn(),
    onDiscard: vi.fn(),
  };

  render(<IntentRevisionDraftActions {...defaults} {...props} />);
  return defaults;
}

describe("IntentRevisionDraftActions", () => {
  it("변경 요약을 보여주고 확인 후 적용 callback을 호출한다", () => {
    const { onApply } = renderActions();

    expect(screen.getByText("변경된 intent 1개")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "적용" })[0]);
    expect(screen.getByText("Intent 수정 초안을 적용할까요?")).toBeInTheDocument();

    const confirmButtons = screen.getAllByRole("button", { name: "적용" });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("취소 확인 dialog에서 discard callback을 호출한다", () => {
    const { onDiscard } = renderActions();

    fireEvent.click(screen.getAllByRole("button", { name: "취소" })[0]);
    expect(screen.getByText("Intent 수정 초안을 취소할까요?")).toBeInTheDocument();

    const confirmButtons = screen.getAllByRole("button", { name: "취소" });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it("요약 로딩 중에는 적용을 막고 loading 문구를 보여준다", () => {
    renderActions({ summary: undefined, isSummaryLoading: true });

    expect(screen.getByText("변경 요약을 불러오는 중입니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "적용" })).toBeDisabled();
  });

  it("요약 조회 실패 시 retry를 제공하고 적용을 막는다", () => {
    const { onRetrySummary } = renderActions({
      summary: undefined,
      summaryError: "변경 요약을 불러오지 못했습니다.",
    });

    expect(screen.getByText("변경 요약을 불러오지 못했습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "적용" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onRetrySummary).toHaveBeenCalledTimes(1);
  });

  it("요약 조회 실패 Error 메시지가 비어 있으면 fallback 문구를 보여준다", () => {
    renderActions({
      summary: undefined,
      summaryError: new Error(""),
    });

    expect(screen.getByText("변경 요약을 불러오지 못했습니다.")).toBeInTheDocument();
  });

  it("변경된 intent가 없으면 적용을 막는다", () => {
    renderActions({
      summary: {
        changedIntents: [],
        changedFieldCounts: { name: 0, description: 0 },
        changedByDraftIntentId: {},
      },
    });

    expect(screen.getByText("변경된 intent가 없습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "적용" })).toBeDisabled();
  });
});
