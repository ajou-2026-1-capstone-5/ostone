import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider, type UseQueryResult } from "@tanstack/react-query";
import type { DomainPackVersionDetail } from "@/entities/domain-pack";
import { ApiRequestError } from "@/shared/api";
import { SummaryDetailPanel } from "./SummaryDetailPanel";

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

const publishedDetail: DomainPackVersionDetail = {
  ...stubDetail,
  lifecycleStatus: "PUBLISHED",
};

function renderSummaryDetailPanel(ui: React.ReactElement) {
  const queryClient = new QueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("SummaryDetailPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('data 없고 로딩/에러 없으면 "버전을 선택하세요." 안내를 표시한다', () => {
    renderSummaryDetailPanel(<SummaryDetailPanel query={makeQuery({})} wsId={1} packId={2} />);

    expect(screen.getByText("버전을 선택하세요.")).toBeInTheDocument();
  });

  it('loading 상태에서 "로딩 중" aria-label을 렌더링한다', () => {
    renderSummaryDetailPanel(
      <SummaryDetailPanel query={makeQuery({ isLoading: true })} wsId={1} packId={2} />,
    );

    expect(screen.getByLabelText("로딩 중")).toBeInTheDocument();
  });

  it("일반 에러 시 에러 메시지를 alert role로 표시한다", () => {
    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({ isError: true, error: new Error("fail") })}
        wsId={1}
        packId={2}
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
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(refetch).toHaveBeenCalled();
  });

  it("정상 데이터 시 Summary JSON과 구성요소를 렌더링하고 승인 준비 상태는 렌더링하지 않는다", () => {
    renderSummaryDetailPanel(
      <SummaryDetailPanel query={makeQuery({ data: stubDetail })} wsId={1} packId={2} />,
    );

    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("DRAFT")).toBeInTheDocument();
    expect(screen.getByText("Summary JSON")).toBeInTheDocument();
    expect(screen.getByTestId("summary-json-card")).toHaveTextContent('{"key":"val"}');
    expect(screen.getByTestId("component-count-grid")).toBeInTheDocument();
    expect(screen.queryByText("승인 준비 상태")).not.toBeInTheDocument();
  });

  it("상세 메타 카드의 배포 버튼 클릭 시 확인 다이얼로그를 먼저 표시한다", () => {
    const onDeploy = vi.fn();

    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({ data: publishedDetail })}
        wsId={1}
        packId={2}
        onDeploy={onDeploy}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "배포" }));

    expect(screen.getByText("이 버전을 배포할까요?")).toBeInTheDocument();
    expect(onDeploy).not.toHaveBeenCalled();
  });

  it("배포 확인 시 현재 versionId를 전달한다", () => {
    const onDeploy = vi.fn();

    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({ data: publishedDetail })}
        wsId={1}
        packId={2}
        onDeploy={onDeploy}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "배포" }));
    fireEvent.click(screen.getByRole("button", { name: "배포하기" }));

    expect(onDeploy).toHaveBeenCalledWith(3);
  });

  it("현재 운영 버전이면 상세 메타 카드의 배포 버튼을 배포중 상태로 비활성화한다", () => {
    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({ data: publishedDetail })}
        wsId={1}
        packId={2}
        currentVersionId={3}
        onDeploy={vi.fn()}
      />,
    );

    const deployButton = screen.getByRole("button", { name: "배포중" });
    expect(deployButton).toBeDisabled();
    expect(screen.getAllByText("배포중")).toHaveLength(2);
  });

  it("DRAFT 버전이면 상세 메타 카드의 배포 버튼을 비활성화한다", () => {
    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({ data: stubDetail })}
        wsId={1}
        packId={2}
        onDeploy={vi.fn()}
      />,
    );

    const deployButton = screen.getByRole("button", { name: "배포" });
    expect(deployButton).toBeDisabled();
  });

  it("DRAFT 버전에 apply/discard action이 있으면 적용/삭제 버튼을 표시한다", () => {
    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({ data: stubDetail })}
        wsId={1}
        packId={2}
        onApplyDraft={vi.fn()}
        onDiscardDraft={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "적용" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "배포" })).not.toBeInTheDocument();
  });

  it("DRAFT 버전에서는 제공된 action callback의 버튼만 표시한다", () => {
    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({ data: stubDetail })}
        wsId={1}
        packId={2}
        onApplyDraft={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "적용" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "삭제" })).not.toBeInTheDocument();
  });

  it("DRAFT 버전에서 삭제 callback만 있으면 삭제 버튼만 표시한다", () => {
    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({ data: stubDetail })}
        wsId={1}
        packId={2}
        onDiscardDraft={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "적용" })).not.toBeInTheDocument();
  });

  it("Draft 처리 중에는 적용/삭제 버튼을 비활성화하고 진행 중 label을 보여준다", () => {
    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({ data: stubDetail })}
        wsId={1}
        packId={2}
        applyingVersionId={3}
        onApplyDraft={vi.fn()}
        onDiscardDraft={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "적용 중..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "삭제" })).toBeDisabled();
  });

  it("Draft 적용 확인 시 현재 versionId를 전달한다", () => {
    const onApplyDraft = vi.fn();

    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({ data: stubDetail })}
        wsId={1}
        packId={2}
        onApplyDraft={onApplyDraft}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "적용" }));
    fireEvent.click(screen.getByRole("button", { name: "적용하기" }));

    expect(onApplyDraft).toHaveBeenCalledWith(3);
  });

  it("Draft 삭제 확인 시 현재 versionId를 전달한다", () => {
    const onDiscardDraft = vi.fn();

    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({ data: stubDetail })}
        wsId={1}
        packId={2}
        onDiscardDraft={onDiscardDraft}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(screen.getByText("Draft 버전을 삭제할까요?")).toBeInTheDocument();
    expect(
      screen.getByText("삭제하면 이 Draft 버전과 저장된 수정 내용이 모두 삭제됩니다."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "삭제하기" }));

    expect(onDiscardDraft).toHaveBeenCalledWith(3);
  });
});
