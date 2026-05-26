import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { useIntentList } from "../model/useIntentList";
import { IntentTreePanel } from "./IntentTreePanel";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("../model/useIntentList", () => ({
  useIntentList: vi.fn(),
}));

const mockedUseIntentList = vi.mocked(useIntentList);
const mockedToastError = vi.mocked(toast.error);

describe("IntentTreePanel", () => {
  beforeEach(() => {
    mockedUseIntentList.mockReset();
    mockedToastError.mockReset();
  });

  it("intent tree와 revision marker를 렌더링하고 선택을 전달한다", () => {
    const onSelect = vi.fn();
    mockedUseIntentList.mockReturnValue({
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
    } as ReturnType<typeof useIntentList>);

    render(
      <IntentTreePanel
        wsId={1}
        packId={2}
        versionId={3}
        selectedId={2}
        onSelect={onSelect}
        markers={{ 2: "수정 중" }}
      />,
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
    mockedUseIntentList.mockReturnValue({
      status: "loading",
    });

    render(
      <IntentTreePanel
        wsId={1}
        packId={2}
        versionId={3}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("— · TREE")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("ready 상태에서 intent가 없으면 empty state를 표시한다", () => {
    mockedUseIntentList.mockReturnValue({
      status: "ready",
      data: [],
    } as ReturnType<typeof useIntentList>);

    render(
      <IntentTreePanel
        wsId={1}
        packId={2}
        versionId={3}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("0 · TREE")).toBeInTheDocument();
    expect(
      screen.getByText("해당 버전에 등록된 intent 초안이 없습니다."),
    ).toBeInTheDocument();
  });

  it("목록 조회 실패 시 toast와 error empty state를 보여준다", () => {
    mockedUseIntentList.mockReturnValue({
      status: "error",
      code: "ERR",
      message: "목록 실패",
    });

    render(
      <IntentTreePanel
        wsId={1}
        packId={2}
        versionId={3}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("목록을 불러오지 못했습니다.")).toBeInTheDocument();
    expect(mockedToastError).toHaveBeenCalledWith("목록 실패");
  });

  it("목록 조회 실패 메시지가 없으면 기본 toast 메시지를 사용한다", () => {
    mockedUseIntentList.mockReturnValue({
      status: "error",
      code: "ERR",
      message: undefined,
    } as unknown as ReturnType<typeof useIntentList>);

    render(
      <IntentTreePanel
        wsId={1}
        packId={2}
        versionId={3}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );

    expect(mockedToastError).toHaveBeenCalledWith(
      "목록을 불러오지 못했습니다.",
    );
  });
});
