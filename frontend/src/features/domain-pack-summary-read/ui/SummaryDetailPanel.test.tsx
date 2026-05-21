import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { QueryClient, QueryClientProvider, type UseQueryResult } from "@tanstack/react-query";
import { toast } from "sonner";
import type { DomainPackVersionDetail, DomainPackVersionSummary } from "@/entities/domain-pack";
import { ApiRequestError } from "@/shared/api";
import { SummaryDetailPanel } from "./SummaryDetailPanel";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  readinessRetry: vi.fn(),
  readiness: {
    ready: true,
    isLoading: false,
    isError: false,
    blockers: [] as Array<{ type: string; message: string }>,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock(
  "@/shared/api/generated/endpoints/activate-domain-pack-version-controller/activate-domain-pack-version-controller",
  () => ({
    useActivate: () => ({
      mutateAsync: mocks.mutateAsync,
      isPending: false,
    }),
  }),
);

vi.mock("../model/useDomainPackApprovalReadiness", () => ({
  useDomainPackApprovalReadiness: () => ({
    ...mocks.readiness,
    retry: mocks.readinessRetry,
  }),
}));

vi.mock("./DomainPackApprovalCard", () => ({
  DomainPackApprovalCard: ({
    onApprove,
    isPublished,
  }: {
    onApprove: () => void;
    isPublished: boolean;
  }) => (
    <button type="button" onClick={onApprove}>
      {isPublished ? "mock published approval card" : "mock approval card"}
    </button>
  ),
}));

vi.mock("./SummaryJsonCard", () => ({
  SummaryJsonCard: ({ summaryJson }: { summaryJson: string }) => (
    <div data-testid="summary-json-card">{summaryJson}</div>
  ),
}));

vi.mock("./ComponentCountGrid", () => ({
  ComponentCountGrid: () => <div data-testid="component-count-grid" />,
}));

vi.mock("@/shared/ui/ostone/atoms/ErrorState", () => ({
  ErrorState: ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
    <div role="alert">
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  ),
}));

function makeQuery(
  overrides: Partial<UseQueryResult<DomainPackVersionDetail>>,
): UseQueryResult<DomainPackVersionDetail> {
  return {
    isLoading: false,
    isError: false,
    isFetching: false,
    data: undefined,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as UseQueryResult<DomainPackVersionDetail>;
}

const stubDetail: DomainPackVersionDetail = {
  versionId: 3,
  packId: 2,
  versionNo: 1,
  lifecycleStatus: "DRAFT",
  summaryJson: '{"key":"val"}',
  intentCount: 5,
  slotCount: 2,
  policyCount: 1,
  riskCount: 0,
  workflowCount: 3,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const versions: DomainPackVersionSummary[] = [
  { versionId: 3, versionNo: 1, lifecycleStatus: "DRAFT" },
];

function renderSummaryDetailPanel(ui: React.ReactElement) {
  const queryClient = new QueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("SummaryDetailPanel", () => {
  beforeEach(() => {
    mocks.mutateAsync.mockReset();
    mocks.readinessRetry.mockReset();
    mocks.readiness.ready = true;
    mocks.readiness.isLoading = false;
    mocks.readiness.isError = false;
    mocks.readiness.blockers = [];
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('data 없고 로딩/에러 없으면 "버전을 선택하세요." 안내를 표시한다', () => {
    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({})}
        wsId={1}
        packId={2}
        versions={versions}
        onActivated={vi.fn()}
      />,
    );
    expect(screen.getByText("버전을 선택하세요.")).toBeInTheDocument();
  });

  it('loading 상태에서 "로딩 중" aria-label을 렌더링한다', () => {
    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({ isLoading: true })}
        wsId={1}
        packId={2}
        versions={versions}
        onActivated={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("로딩 중")).toBeInTheDocument();
  });

  it("일반 에러 시 에러 메시지를 alert role로 표시한다", () => {
    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({ isError: true, error: new Error("fail") })}
        wsId={1}
        packId={2}
        versions={versions}
        onActivated={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("버전 정보를 불러오지 못했습니다.");
  });

  it('404 에러 시 "버전을 찾을 수 없습니다." 메시지를 표시하고 다시 시도 버튼은 없다', () => {
    const error404 = new ApiRequestError(404, "NOT_FOUND", "not found");
    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({ isError: true, error: error404 })}
        wsId={1}
        packId={2}
        versions={versions}
        onActivated={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("버전을 찾을 수 없습니다.");
    expect(screen.queryByRole("button", { name: "다시 시도" })).not.toBeInTheDocument();
  });

  it("일반 에러 시 다시 시도 버튼을 표시하고 클릭 시 refetch를 호출한다", () => {
    const refetch = vi.fn();
    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({ isError: true, error: new Error("fail"), refetch })}
        wsId={1}
        packId={2}
        versions={versions}
        onActivated={vi.fn()}
      />,
    );
    const retryBtn = screen.getByRole("button", { name: "다시 시도" });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(refetch).toHaveBeenCalled();
  });

  it("정상 데이터 시 버전 번호와 라이프사이클 상태를 렌더링한다", () => {
    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({ data: stubDetail })}
        wsId={1}
        packId={2}
        versions={versions}
        onActivated={vi.fn()}
      />,
    );
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("DRAFT")).toBeInTheDocument();
    expect(screen.getByTestId("summary-json-card")).toBeInTheDocument();
    expect(screen.getByTestId("component-count-grid")).toBeInTheDocument();
  });

  it("승인 성공 시 activate 호출 후 toast와 refetch를 수행한다", async () => {
    const refetch = vi.fn();
    const onActivated = vi.fn();
    mocks.mutateAsync.mockResolvedValueOnce({});

    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({ data: stubDetail, refetch })}
        wsId={1}
        packId={2}
        versions={versions}
        onActivated={onActivated}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "mock approval card" }));

    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      workspaceId: 1,
      packId: 2,
      versionId: 3,
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Domain Pack 버전이 승인되었습니다.");
    });
    expect(refetch).toHaveBeenCalled();
    expect(onActivated).toHaveBeenCalled();
    expect(mocks.readinessRetry).toHaveBeenCalled();
  });

  it("activate 실패 시 error code에 맞는 toast를 표시한다", async () => {
    mocks.mutateAsync.mockRejectedValueOnce(
      new ApiRequestError(409, "DOMAIN_PACK_CONFLICT", "conflict"),
    );

    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({ data: stubDetail })}
        wsId={1}
        packId={2}
        versions={versions}
        onActivated={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "mock approval card" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "다른 요청으로 버전 상태가 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
      );
    });
  });

  it("승인 준비 상태가 blocked면 activate를 호출하지 않는다", async () => {
    mocks.readiness.ready = false;
    mocks.readiness.blockers = [
      { type: "INTENT", message: "승인 또는 반려되지 않은 Intent가 1개 남아 있습니다." },
    ];

    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({ data: stubDetail })}
        wsId={1}
        packId={2}
        versions={versions}
        onActivated={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "mock approval card" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "승인 또는 반려되지 않은 Intent가 1개 남아 있습니다.",
      );
    });
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });
});
