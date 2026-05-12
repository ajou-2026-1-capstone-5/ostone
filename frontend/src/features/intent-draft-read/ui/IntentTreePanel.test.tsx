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
    expect(screen.getByRole("button", { name: /refund/ })).toHaveAttribute(
      "aria-current",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: /refund/ }));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("목록 조회 실패 시 toast와 error empty state를 보여준다", () => {
    mockedUseIntentList.mockReturnValue({
      status: "error",
      code: "ERR",
      message: "목록 실패",
    });

    render(<IntentTreePanel wsId={1} packId={2} versionId={3} selectedId={null} onSelect={vi.fn()} />);

    expect(screen.getByText("목록을 불러오지 못했습니다.")).toBeInTheDocument();
    expect(mockedToastError).toHaveBeenCalledWith("목록 실패");
  });
});
