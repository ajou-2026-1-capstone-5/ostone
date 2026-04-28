import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkflowList } from "../model/useWorkflowList";
import { WorkflowListPanel } from "./WorkflowListPanel";

vi.mock("../model/useWorkflowList", () => ({
  useWorkflowList: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

const mockedUseWorkflowList = vi.mocked(useWorkflowList);

const stubWorkflow = {
  id: 1,
  workflowCode: "W001",
  name: "테스트 워크플로우",
  description: null,
  initialState: "START",
  terminalStatesJson: '["DONE", "CANCEL"]',
  createdAt: "",
  updatedAt: "",
};

function renderPanel(props: Partial<React.ComponentProps<typeof WorkflowListPanel>> = {}) {
  const defaults = {
    wsId: 1,
    packId: 2,
    versionId: 3,
    selectedId: null as number | null,
    onSelect: vi.fn(),
  };
  render(<WorkflowListPanel {...defaults} {...props} />);
  return defaults;
}

describe("WorkflowListPanel", () => {
  beforeEach(() => mockedUseWorkflowList.mockReset());

  it("loading 상태에서는 skeleton을 렌더링하고 헤더 메타를 — 로 표시한다", () => {
    mockedUseWorkflowList.mockReturnValue({
      isLoading: true,
      isError: false,
      isSuccess: false,
      data: undefined,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflowList>);
    renderPanel();
    expect(screen.getByLabelText("workflow 목록")).toBeInTheDocument();
    expect(screen.getByText("— · CODE")).toBeInTheDocument();
  });

  it("success 상태에서는 workflow 목록과 항목 수를 렌더링한다", () => {
    mockedUseWorkflowList.mockReturnValue({
      isLoading: false,
      isError: false,
      isSuccess: true,
      data: [stubWorkflow],
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflowList>);
    renderPanel();
    expect(screen.getByText("1 · CODE")).toBeInTheDocument();
    expect(screen.getByText("W001")).toBeInTheDocument();
    expect(screen.getByText("테스트 워크플로우")).toBeInTheDocument();
  });

  it("success 상태에서 항목 클릭 시 onSelect를 호출한다", () => {
    const onSelect = vi.fn();
    mockedUseWorkflowList.mockReturnValue({
      isLoading: false,
      isError: false,
      isSuccess: true,
      data: [stubWorkflow],
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflowList>);
    renderPanel({ onSelect });
    fireEvent.click(screen.getByRole("button", { name: /W001/ }));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("빈 목록 시 안내 메시지를 보여준다", () => {
    mockedUseWorkflowList.mockReturnValue({
      isLoading: false,
      isError: false,
      isSuccess: true,
      data: [],
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflowList>);
    renderPanel();
    expect(screen.getByText("해당 버전에 등록된 workflow 초안이 없습니다.")).toBeInTheDocument();
  });

  it("error 상태에서는 에러 메시지와 재시도 버튼을 보여준다", () => {
    const refetch = vi.fn();
    mockedUseWorkflowList.mockReturnValue({
      isLoading: false,
      isError: true,
      isSuccess: false,
      data: undefined,
      error: new Error("fail"),
      refetch,
    } as unknown as ReturnType<typeof useWorkflowList>);
    renderPanel();
    expect(screen.getByText("목록을 불러오지 못했습니다.")).toBeInTheDocument();
    const retryBtn = screen.getByRole("button", { name: "다시 시도" });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(refetch).toHaveBeenCalled();
  });

  it("선택된 항목에 aria-current를 부여한다", () => {
    mockedUseWorkflowList.mockReturnValue({
      isLoading: false,
      isError: false,
      isSuccess: true,
      data: [stubWorkflow],
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflowList>);
    renderPanel({ selectedId: 1 });
    expect(screen.getByRole("button", { name: /W001/ })).toHaveAttribute("aria-current", "true");
  });

  it("terminalStatesJson이 유효한 배열이면 TERM · N 배지를 보여준다", () => {
    mockedUseWorkflowList.mockReturnValue({
      isLoading: false,
      isError: false,
      isSuccess: true,
      data: [stubWorkflow],
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflowList>);
    renderPanel();
    expect(screen.getByText("TERM · 2")).toBeInTheDocument();
  });
});
