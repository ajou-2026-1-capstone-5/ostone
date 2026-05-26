import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import type { IntentListState } from "@/entities/intent";
import { IntentTreePanel } from "./IntentTreePanel";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

const mockedToastError = vi.mocked(toast.error);

function renderPanel(
  intentListState: IntentListState,
  props: Partial<React.ComponentProps<typeof IntentTreePanel>> = {},
) {
  render(
    <IntentTreePanel
      intentListState={intentListState}
      selectedId={null}
      onSelect={vi.fn()}
      {...props}
    />,
  );
}

describe("IntentTreePanel", () => {
  beforeEach(() => {
    mockedToastError.mockReset();
  });

  it("intent tree와 revision marker를 렌더링하고 선택을 전달한다", () => {
    const onSelect = vi.fn();
    renderPanel(
      {
        status: "ready",
        data: [
          {
            id: 1,
            intentCode: "root",
            name: "상위 intent",
            taxonomyLevel: 1,
            parentIntentId: undefined,
            status: "PUBLISHED",
          },
          {
            id: 2,
            intentCode: "refund",
            name: "환불 문의",
            taxonomyLevel: 2,
            parentIntentId: 1,
            status: "PUBLISHED",
          },
        ],
      },
      {
        selectedId: 2,
        onSelect,
        markers: { 2: "수정 중" },
      },
    );

    expect(screen.getByText("2 · TREE")).toBeInTheDocument();
    expect(screen.getByText("수정 중")).toBeInTheDocument();
    const selectedRow = screen.getByRole("button", { name: /refund/ });
    expect(selectedRow).toHaveAttribute("aria-current", "true");
    const selectedText = selectedRow.textContent ?? "";
    expect(selectedText.indexOf("LV · 2")).toBeLessThan(
      selectedText.indexOf("수정 중"),
    );

    fireEvent.click(selectedRow);
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("loading 상태에서는 skeleton과 pending meta를 표시한다", () => {
    renderPanel({ status: "loading" });

    expect(screen.getByText("— · TREE")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("ready 상태에서 intent가 없으면 empty state를 표시한다", () => {
    renderPanel({ status: "ready", data: [] });

    expect(screen.getByText("0 · TREE")).toBeInTheDocument();
    expect(
      screen.getByText("해당 버전에 등록된 intent 초안이 없습니다."),
    ).toBeInTheDocument();
  });

  it("목록 조회 실패 시 toast와 error empty state를 보여준다", () => {
    renderPanel({
      status: "error",
      code: "ERR",
      message: "목록 실패",
    });

    expect(screen.getByText("목록을 불러오지 못했습니다.")).toBeInTheDocument();
    expect(mockedToastError).toHaveBeenCalledWith("목록 실패");
  });

  it("목록 조회 실패 메시지가 없으면 기본 toast 메시지를 사용한다", () => {
    renderPanel({
      status: "error",
      code: "ERR",
      message: undefined,
    } as unknown as IntentListState);

    expect(mockedToastError).toHaveBeenCalledWith(
      "목록을 불러오지 못했습니다.",
    );
  });
});
