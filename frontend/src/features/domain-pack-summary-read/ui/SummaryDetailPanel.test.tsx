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
  versionNo: 2,
  lifecycleStatus: "PUBLISHED",
  summaryJson: '{"topic":"환불 정책 업데이트"}',
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
    expect(screen.getByText("검토 중")).toBeInTheDocument();
    expect(screen.getByTestId("summary-json-card")).toHaveTextContent('{"key":"val"}');
    expect(screen.getByTestId("component-count-grid")).toBeInTheDocument();
    expect(screen.queryByText("승인 준비 상태")).not.toBeInTheDocument();
  });

  it("상태가 없는 버전도 상담사 용어로 표시한다", () => {
    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({
          data: {
            ...stubDetail,
            lifecycleStatus: null,
            createdAt: "날짜 확인 전",
          },
        })}
        wsId={1}
        packId={2}
      />,
    );

    expect(screen.getByText("상태 없음")).toBeInTheDocument();
    expect(screen.getByText("날짜 확인 전")).toBeInTheDocument();
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

    expect(screen.getByText("v2 버전을 배포할까요?")).toBeInTheDocument();
    expect(onDeploy).not.toHaveBeenCalled();
  });

  it("배포 확인 다이얼로그에 대상 버전과 운영 전환 정보를 표시한다", () => {
    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({ data: publishedDetail })}
        wsId={1}
        packId={2}
        currentVersionId={9}
        currentVersionNo={1}
        onDeploy={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "배포" }));

    expect(screen.getByLabelText("대상 버전 정보")).toHaveTextContent("대상 버전v2운영 가능");
    expect(screen.getByLabelText("대상 버전 정보")).toHaveTextContent("운영 전환현재 v1 → v2");
    expect(screen.getByLabelText("대상 버전 정보")).toHaveTextContent("변경 요약환불 정책 업데이트");
  });

  it("배포 확인 다이얼로그는 review issue 문자열을 변경 요약으로 표시한다", () => {
    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({
          data: {
            ...publishedDetail,
            summaryJson: '{"review":{"topIssues":["워크플로우 미매핑"]}}',
          },
        })}
        wsId={1}
        packId={2}
        onDeploy={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "배포" }));

    expect(screen.getByLabelText("대상 버전 정보")).toHaveTextContent("변경 요약워크플로우 미매핑");
  });

  it("배포 확인 다이얼로그는 review issue 객체의 메시지를 변경 요약으로 표시한다", () => {
    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({
          data: {
            ...publishedDetail,
            summaryJson: '{"review":{"issues":[{"message":"슬롯 확인 필요"}]}}',
          },
        })}
        wsId={1}
        packId={2}
        onDeploy={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "배포" }));

    expect(screen.getByLabelText("대상 버전 정보")).toHaveTextContent("변경 요약슬롯 확인 필요");
  });

  it("배포 확인 다이얼로그는 변경 요약을 해석할 수 없으면 요약 행을 표시하지 않는다", () => {
    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({
          data: {
            ...publishedDetail,
            summaryJson: "{bad}",
          },
        })}
        wsId={1}
        packId={2}
        onDeploy={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "배포" }));

    expect(screen.getByLabelText("대상 버전 정보")).not.toHaveTextContent("변경 요약");
  });

  it("배포 확인 다이얼로그는 빈 review issue 객체만 있으면 요약 행을 표시하지 않는다", () => {
    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({
          data: {
            ...publishedDetail,
            summaryJson: '{"review":{"topIssues":[{}]}}',
          },
        })}
        wsId={1}
        packId={2}
        onDeploy={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "배포" }));

    expect(screen.getByLabelText("대상 버전 정보")).not.toHaveTextContent("변경 요약");
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
    fireEvent.change(screen.getByLabelText("변경사항 정리"), {
      target: { value: " 상담 유형명을 정리했습니다. " },
    });
    fireEvent.click(screen.getByRole("button", { name: "적용하기" }));

    expect(onApplyDraft).toHaveBeenCalledWith(3, "상담 유형명을 정리했습니다.");
  });

  it("Draft 적용 확인 시 빈 변경사항 정리도 전달한다", () => {
    const onApplyDraft = vi.fn();

    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({
          data: {
            ...stubDetail,
            description: "기존 수정 메모",
          },
        })}
        wsId={1}
        packId={2}
        onApplyDraft={onApplyDraft}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "적용" }));
    fireEvent.change(screen.getByLabelText("변경사항 정리"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "적용하기" }));

    expect(onApplyDraft).toHaveBeenCalledWith(3, "");
  });

  it("Draft 적용 확인 다이얼로그에 대상 draft 버전과 수정 반영 정보를 표시한다", () => {
    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({
          data: {
            ...stubDetail,
            versionNo: 3,
            summaryJson:
              '{"draftSource":{"baseVersionNo":2,"reason":"상담 유형 이름을 정리했습니다."}}',
          },
        })}
        wsId={1}
        packId={2}
        currentVersionId={8}
        currentVersionNo={2}
        onApplyDraft={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "적용" }));

    const context = screen.getByLabelText("대상 버전 정보");
    expect(context).toHaveTextContent("대상 버전v3검토 중");
    expect(context).toHaveTextContent("수정 반영현재 v2 → v3");
    expect(context).toHaveTextContent("변경 요약상담 유형 이름을 정리했습니다.");
    expect(screen.getByLabelText("변경사항 정리")).toHaveValue("");
  });

  it("Draft 변경사항 정리는 기존 description을 기본값으로 표시한다", () => {
    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({
          data: {
            ...stubDetail,
            description: "기존 수정 메모",
          },
        })}
        wsId={1}
        packId={2}
        onApplyDraft={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "적용" }));

    expect(screen.getByLabelText("변경사항 정리")).toHaveValue("기존 수정 메모");
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
    expect(screen.getByText("검토 중인 v1 버전을 삭제할까요?")).toBeInTheDocument();
    expect(
      screen.getByText("삭제하면 v1 검토본과 저장된 수정 내용이 모두 삭제되며 되돌릴 수 없습니다."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("대상 버전 정보")).toHaveTextContent("삭제 범위");
    expect(screen.getByLabelText("대상 버전 정보")).toHaveTextContent(
      "버전 메타데이터와 저장된 draft 수정 내용",
    );
    fireEvent.click(screen.getByRole("button", { name: "삭제하기" }));

    expect(onDiscardDraft).toHaveBeenCalledWith(3);
  });

  it("PUBLISHED 버전은 운영 가능 배지를 렌더링하지 않는다", () => {
    renderSummaryDetailPanel(
      <SummaryDetailPanel query={makeQuery({ data: publishedDetail })} wsId={1} packId={2} />,
    );

    expect(screen.queryByText("운영 가능")).not.toBeInTheDocument();
  });

  it("description이 있으면 우측에 연하게 렌더링한다", () => {
    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({ data: { ...stubDetail, description: "복원: v3 기준" } })}
        wsId={1}
        packId={2}
      />,
    );

    expect(screen.getByText("복원: v3 기준")).toBeInTheDocument();
  });

  it("description이 없으면 설명 텍스트를 렌더링하지 않는다", () => {
    renderSummaryDetailPanel(
      <SummaryDetailPanel
        query={makeQuery({ data: { ...stubDetail, description: undefined } })}
        wsId={1}
        packId={2}
      />,
    );

    expect(screen.queryByText("복원: v3 기준")).not.toBeInTheDocument();
  });
});
