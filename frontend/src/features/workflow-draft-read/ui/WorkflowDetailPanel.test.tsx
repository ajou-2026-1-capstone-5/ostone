import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { ApiRequestError } from "@/shared/api";
import { useWorkflowDetail } from "../model/useWorkflowDetail";
import { WorkflowDetailPanel } from "./WorkflowDetailPanel";

vi.mock("../model/useWorkflowDetail", () => ({
  useWorkflowDetail: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("./GraphRenderer", () => ({
  default: () => <div data-testid="graph-renderer" />,
}));

vi.mock("@/shared/ui/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockedUseWorkflowDetail = vi.mocked(useWorkflowDetail);

const stubDetail = {
  id: 10,
  workflowCode: "W001",
  name: "테스트 워크플로우",
  description: "설명입니다",
  graphJson: { direction: "LR" as const, nodes: [], edges: [] },
  initialState: "START",
  terminalStatesJson: '["DONE"]',
  evidenceJson: '{"key":"val"}',
  metaJson: '{"meta":"data"}',
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-04-01T00:00:00Z",
};

function renderPanel(props: Partial<React.ComponentProps<typeof WorkflowDetailPanel>> = {}) {
  const defaults = {
    wsId: 1,
    packId: 2,
    versionId: 3,
    workflowId: 10 as number | null,
    onEdit: vi.fn(),
  };
  render(<WorkflowDetailPanel {...defaults} {...props} />);
  return defaults;
}

describe("WorkflowDetailPanel", () => {
  beforeEach(() => {
    mockedUseWorkflowDetail.mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("workflowId=null이면 선택 안내를 보여준다", () => {
    mockedUseWorkflowDetail.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflowDetail>);
    renderPanel({ workflowId: null });
    expect(screen.getByText("좌측 목록에서 workflow를 선택해 주세요.")).toBeInTheDocument();
  });

  it("loading 상태에서는 skeleton 영역을 렌더링한다", () => {
    mockedUseWorkflowDetail.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflowDetail>);
    renderPanel();
    expect(screen.getByRole("region", { name: "workflow 상세" })).toBeInTheDocument();
  });

  it("error 상태에서는 에러 메시지와 재시도 버튼을 보여준다", async () => {
    const refetch = vi.fn();
    const err = new ApiRequestError(500, "SERVER_ERROR", "서버 오류");
    mockedUseWorkflowDetail.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: err,
      refetch,
    } as unknown as ReturnType<typeof useWorkflowDetail>);
    renderPanel();

    expect(screen.getByText("상세 정보를 불러오지 못했습니다.")).toBeInTheDocument();
    const retryBtn = screen.getByRole("button", { name: "다시 시도" });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);
    expect(refetch).toHaveBeenCalled();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("서버 오류"));
  });

  it("404 error 시 워크플로우 미존재 메시지로 toast를 호출한다", async () => {
    const err = new ApiRequestError(404, "NOT_FOUND", "없음");
    mockedUseWorkflowDetail.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: err,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflowDetail>);
    renderPanel();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("workflow를 찾을 수 없습니다."),
    );
  });

  it("성공 상태에서는 헤더 정보와 탭 목록을 보여준다", () => {
    mockedUseWorkflowDetail.mockReturnValue({
      data: stubDetail,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflowDetail>);
    renderPanel();
    expect(screen.getByText("W001")).toBeInTheDocument();
    expect(screen.getByText("테스트 워크플로우")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Graph" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "JSON" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Meta" })).toBeInTheDocument();
  });

  it("JSON 탭 클릭 시 tabpanel이 활성화된다", () => {
    mockedUseWorkflowDetail.mockReturnValue({
      data: stubDetail,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflowDetail>);
    renderPanel();
    const jsonTab = screen.getByRole("tab", { name: "JSON" });
    fireEvent.click(jsonTab);
    expect(jsonTab).toHaveAttribute("aria-selected", "true");
  });

  it("Meta 탭 클릭 시 initialState와 terminalStates를 표시한다", () => {
    mockedUseWorkflowDetail.mockReturnValue({
      data: stubDetail,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflowDetail>);
    renderPanel();
    fireEvent.click(screen.getByRole("tab", { name: "Meta" }));
    expect(screen.getByText("Initial State")).toBeInTheDocument();
    expect(screen.getByText("Terminal States")).toBeInTheDocument();
    expect(screen.getByText("START")).toBeInTheDocument();
    expect(screen.getByText("DONE")).toBeInTheDocument();
  });

  it("onEdit 버튼 클릭 시 콜백을 호출한다", () => {
    const onEdit = vi.fn();
    mockedUseWorkflowDetail.mockReturnValue({
      data: stubDetail,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflowDetail>);
    renderPanel({ onEdit });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
