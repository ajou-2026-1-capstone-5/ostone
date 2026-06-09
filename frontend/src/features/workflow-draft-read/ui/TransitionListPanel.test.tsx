import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import { ApiRequestError } from "@/shared/api";
import type { WorkflowTransitionDetail } from "@/entities/workflow";
import { TransitionListPanel } from "./TransitionListPanel";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

const stubTransitions: WorkflowTransitionDetail[] = [
  {
    id: "edge-1",
    workflowDefinitionId: 10,
    domainPackVersionId: 3,
    from: "A",
    to: "B",
    label: "조건",
    toPolicyRef: "POL_001",
  },
  {
    id: "edge-2",
    workflowDefinitionId: 10,
    domainPackVersionId: 3,
    from: "B",
    to: "C",
    label: undefined,
    toPolicyRef: undefined,
  },
];

describe("TransitionListPanel", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockReset();
  });

  it("loading 상태에서 skeleton을 표시한다", () => {
    const { container } = render(
      <TransitionListPanel
        transitions={undefined}
        isLoading={true}
        isError={false}
        error={null}
        refetch={vi.fn()}
      />,
    );
    expect(container.querySelector('[class*="skeleton"]')).toBeInTheDocument();
  });

  it("error 상태에서 에러 메시지와 재시도 버튼을 표시한다", () => {
    const refetch = vi.fn();
    render(
      <TransitionListPanel
        transitions={undefined}
        isLoading={false}
        isError={true}
        error={null}
        refetch={refetch}
      />,
    );
    expect(screen.getByText("목록을 불러오지 못했습니다.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("error 상태에서 ApiRequestError 메시지로 toast를 호출한다", async () => {
    const err = new ApiRequestError(500, "SERVER_ERROR", "서버 장애");
    render(
      <TransitionListPanel
        transitions={undefined}
        isLoading={false}
        isError={true}
        error={err}
        refetch={vi.fn()}
      />,
    );
    expect(toast.error).toHaveBeenCalledWith("서버 장애");
  });

  it("transitions가 비어있으면 빈 상태 메시지를 표시한다", () => {
    render(
      <TransitionListPanel
        transitions={[]}
        isLoading={false}
        isError={false}
        error={null}
        refetch={vi.fn()}
      />,
    );
    expect(screen.getByText("등록된 transition이 없습니다.")).toBeInTheDocument();
  });

  it("transitions 목록을 렌더링한다", () => {
    render(
      <TransitionListPanel
        transitions={stubTransitions}
        isLoading={false}
        isError={false}
        error={null}
        refetch={vi.fn()}
      />,
    );
    expect(screen.getByText("edge-1")).toBeInTheDocument();
    expect(screen.getByText("A → B")).toBeInTheDocument();
    expect(screen.getByText("edge-2")).toBeInTheDocument();
    expect(screen.getByText("B → C")).toBeInTheDocument();
  });

  it("toPolicyRef가 있는 항목에는 policy code를 표시한다", () => {
    render(
      <TransitionListPanel
        transitions={stubTransitions}
        isLoading={false}
        isError={false}
        error={null}
        refetch={vi.fn()}
      />,
    );
    expect(screen.getByText("POL_001")).toBeInTheDocument();
  });
});
