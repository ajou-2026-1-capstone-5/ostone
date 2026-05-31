import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { ApiRequestError } from "@/shared/api";
import { useWorkflowDetail } from "../model/useWorkflowDetail";
import { useTransitionList } from "../model/useTransitionList";
import { WorkflowDetailPanel } from "./WorkflowDetailPanel";
import { useListPolicies } from "@/shared/api/generated/endpoints/policy-definition-controller/policy-definition-controller";

vi.mock("../model/useWorkflowDetail", () => ({
  useWorkflowDetail: vi.fn(),
}));

vi.mock("../model/useTransitionList", () => ({
  useTransitionList: vi.fn(),
}));

vi.mock("@/entities/policy", () => ({
  policyApi: { list: vi.fn().mockResolvedValue([]) },
  policyKeys: { list: (...args: unknown[]) => ["policies", "list", ...args] },
}));

vi.mock(
  "@/shared/api/generated/endpoints/policy-definition-controller/policy-definition-controller",
  () => ({
    useListPolicies: vi.fn(),
  }),
);

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
const mockedUseTransitionList = vi.mocked(useTransitionList);
const mockedUseListPolicies = vi.mocked(useListPolicies);

const stubDetail = {
  id: 10,
  workflowCode: "W001",
  name: "테스트 응대 흐름",
  description: "설명입니다",
  graphJson: { direction: "LR" as const, nodes: [], edges: [] },
  initialState: "START",
  terminalStatesJson: '["DONE"]',
  evidenceJson: '{"key":"val"}',
  metaJson: '{"meta":"data"}',
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-04-01T00:00:00Z",
};

const stubTransitionResult = {
  data: undefined,
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
} as unknown as ReturnType<typeof useTransitionList>;

function renderPanel(props: Partial<React.ComponentProps<typeof WorkflowDetailPanel>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const defaults = {
    wsId: 1,
    packId: 2,
    versionId: 3,
    workflowId: 10 as number | null,
    onEdit: vi.fn(),
  };
  render(
    <QueryClientProvider client={queryClient}>
      <WorkflowDetailPanel {...defaults} {...props} />
    </QueryClientProvider>,
  );
  return defaults;
}

describe("WorkflowDetailPanel", () => {
  beforeEach(() => {
    mockedUseWorkflowDetail.mockReset();
    mockedUseTransitionList.mockReset();
    mockedUseListPolicies.mockReset();
    vi.mocked(toast.error).mockReset();
    mockedUseTransitionList.mockReturnValue(stubTransitionResult);
    mockedUseListPolicies.mockReturnValue({
      data: [{ id: 1, policyCode: "POLICY_001", name: "응대 기준" }],
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useListPolicies>);
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
    expect(screen.getByText("좌측 목록에서 응대 흐름을 선택해 주세요.")).toBeInTheDocument();
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
    expect(screen.getByRole("region", { name: "응대 흐름 상세" })).toBeInTheDocument();
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

  it("404 error 시 응대 흐름 미존재 메시지로 toast를 호출한다", async () => {
    const err = new ApiRequestError(404, "NOT_FOUND", "없음");
    mockedUseWorkflowDetail.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: err,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflowDetail>);
    renderPanel();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("응대 흐름을 찾을 수 없습니다."));
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
    expect(screen.getByText("테스트 응대 흐름")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "흐름도" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "JSON" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "상세 정보" })).toBeInTheDocument();
  });

  it("응대 기준 목록 조회 중이면 흐름도 탭에 loading 상태를 보여준다", () => {
    mockedUseWorkflowDetail.mockReturnValue({
      data: stubDetail,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflowDetail>);
    mockedUseListPolicies.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useListPolicies>);

    renderPanel();

    expect(screen.getByRole("status")).toHaveTextContent(
      "응대 기준 목록을 불러오는 중입니다.",
    );
  });

  it("응대 기준 목록 조회 실패 시 toast와 error 상태를 보여준다", async () => {
    mockedUseWorkflowDetail.mockReturnValue({
      data: stubDetail,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflowDetail>);
    mockedUseListPolicies.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new ApiRequestError(500, "SERVER_ERROR", "응대 기준 오류"),
    } as unknown as ReturnType<typeof useListPolicies>);

    renderPanel();

    expect(screen.getByRole("alert")).toHaveTextContent("응대 기준 목록을 불러오지 못했습니다.");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("응대 기준 오류"));
  });

  it("응대 기준 목록이 비어 있으면 empty 상태를 보여준다", () => {
    mockedUseWorkflowDetail.mockReturnValue({
      data: stubDetail,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflowDetail>);
    mockedUseListPolicies.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useListPolicies>);

    renderPanel();

    expect(screen.getByText("참조할 응대 기준이 없습니다.")).toBeInTheDocument();
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

  it("상세 정보 탭 클릭 시 initialState와 terminalStates를 표시한다", () => {
    mockedUseWorkflowDetail.mockReturnValue({
      data: stubDetail,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflowDetail>);
    renderPanel();
    fireEvent.click(screen.getByRole("tab", { name: "상세 정보" }));
    expect(screen.getByText("시작 상태")).toBeInTheDocument();
    expect(screen.getByText("종료 상태")).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("WORKFLOW_GRAPH_JSON_INVALID 에러 시 흐름도 손상 메시지로 toast를 호출한다", async () => {
    const err = new ApiRequestError(422, "WORKFLOW_GRAPH_JSON_INVALID", "invalid graph");
    mockedUseWorkflowDetail.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: err,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflowDetail>);
    renderPanel();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "흐름도 데이터가 손상되어 표시할 수 없습니다.",
      ),
    );
  });

  it("ArrowRight 키로 다음 탭(JSON)으로 이동한다", () => {
    mockedUseWorkflowDetail.mockReturnValue({
      data: stubDetail,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflowDetail>);
    renderPanel();
    fireEvent.keyDown(screen.getByRole("tab", { name: "흐름도" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "JSON" })).toHaveAttribute("aria-selected", "true");
  });

  it("ArrowLeft 키로 이전 탭(흐름도)으로 이동한다", () => {
    mockedUseWorkflowDetail.mockReturnValue({
      data: stubDetail,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflowDetail>);
    renderPanel();
    fireEvent.click(screen.getByRole("tab", { name: "JSON" }));
    fireEvent.keyDown(screen.getByRole("tab", { name: "JSON" }), { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "흐름도" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("Home 키로 첫 번째 탭(흐름도)으로 이동한다", () => {
    mockedUseWorkflowDetail.mockReturnValue({
      data: stubDetail,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflowDetail>);
    renderPanel();
    fireEvent.click(screen.getByRole("tab", { name: "상세 정보" }));
    fireEvent.keyDown(screen.getByRole("tab", { name: "상세 정보" }), { key: "Home" });
    expect(screen.getByRole("tab", { name: "흐름도" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("End 키로 마지막 탭(전환 조건)으로 이동한다", () => {
    mockedUseWorkflowDetail.mockReturnValue({
      data: stubDetail,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflowDetail>);
    renderPanel();
    fireEvent.keyDown(screen.getByRole("tab", { name: "흐름도" }), { key: "End" });
    expect(screen.getByRole("tab", { name: "전환 조건" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("상세 정보 탭 — evidenceJson이 malformed JSON이면 raw 문자열을 표시한다", () => {
    const badDetail = { ...stubDetail, evidenceJson: "not-valid-json" };
    mockedUseWorkflowDetail.mockReturnValue({
      data: badDetail,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useWorkflowDetail>);
    renderPanel();
    fireEvent.click(screen.getByRole("tab", { name: "상세 정보" }));
    expect(screen.getByText("not-valid-json")).toBeInTheDocument();
  });
});
