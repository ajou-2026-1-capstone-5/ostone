import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useConfirmPipelineDomain,
  usePipelineReviewCheckpoint,
  useReplayDiff,
  useSubmitPipelineFeedback,
} from "../api/pipelineReviewApi";
import { PipelineReviewCheckpointCard } from "./PipelineReviewCheckpointCard";

vi.mock("../api/pipelineReviewApi", () => ({
  usePipelineReviewCheckpoint: vi.fn(),
  useConfirmPipelineDomain: vi.fn(),
  useSubmitPipelineFeedback: vi.fn(),
  useReplayDiff: vi.fn(),
}));

const mockedUseCheckpoint = vi.mocked(usePipelineReviewCheckpoint);
const mockedUseConfirmDomain = vi.mocked(useConfirmPipelineDomain);
const mockedUseSubmitFeedback = vi.mocked(useSubmitPipelineFeedback);
const mockedUseReplayDiff = vi.mocked(useReplayDiff);
const feedbackDraftKey = "ostone:pipeline-review:feedback-draft:1:7";

function renderCard(
  props: { workspaceId?: number; pipelineJobId?: number } = {
    workspaceId: 1,
    pipelineJobId: 7,
  },
) {
  return render(
    <MemoryRouter>
      <PipelineReviewCheckpointCard {...props} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  mockedUseCheckpoint.mockReset();
  mockedUseConfirmDomain.mockReset();
  mockedUseSubmitFeedback.mockReset();
  mockedUseReplayDiff.mockReset();
  mockedUseConfirmDomain.mockReturnValue({
    isPending: false,
    mutate: vi.fn(),
  } as never);
  mockedUseSubmitFeedback.mockReturnValue({
    isPending: false,
    mutate: vi.fn(),
  } as never);
  // 기본은 비-feedback-replay → 섹션이 렌더되지 않는다.
  mockedUseReplayDiff.mockReturnValue({
    data: { status: "NOT_APPLICABLE" },
    isLoading: false,
    isError: false,
    isFetching: false,
  } as never);
});

describe("PipelineReviewCheckpointCard", () => {
  it("renders nothing without a pipeline job id", () => {
    mockedUseCheckpoint.mockReturnValue({ isLoading: false } as never);

    const { container } = renderCard({ workspaceId: 1 });

    expect(container).toBeEmptyDOMElement();
  });

  it("renders loading state", () => {
    mockedUseCheckpoint.mockReturnValue({ isLoading: true } as never);

    renderCard();

    expect(
      screen.getByText("리뷰 체크포인트를 불러오는 중입니다."),
    ).toBeInTheDocument();
  });

  it("retries checkpoint loading from the error state and exposes a safe workspace action", () => {
    const refetch = vi.fn();
    mockedUseCheckpoint.mockReturnValue({
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch,
    } as never);

    renderCard();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "현재 job 상태를 확인할 수 없습니다.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "완료나 초안 생성 성공으로 처리하지 않고 같은 job을 다시 조회합니다.",
    );
    expect(
      screen.getByRole("link", { name: "업로드 화면으로 돌아가기" }),
    ).toHaveAttribute("href", "/workspaces/1/upload");
    expect(
      screen.queryByRole("link", { name: "도메인팩 관리로 이동" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("selects a domain candidate before confirming it", () => {
    const mutate = vi.fn();
    mockedUseConfirmDomain.mockReturnValue({
      isPending: false,
      mutate,
    } as never);
    mockedUseCheckpoint.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        pipelineJobId: 7,
        pipelineStatus: "WAITING_DOMAIN_CONFIRMATION",
        reviewKind: "DOMAIN_CONFIRMATION",
        tasks: [
          {
            id: 101,
            targetType: "DOMAIN_CANDIDATE",
            status: "OPEN",
            priority: "HIGH",
            title: "카드 상담",
            payload: {
              displayName: "카드 상담",
              confidence: 0.92,
              description: "카드 분실, 결제, 한도 문의가 섞인 상담",
              evidenceTerms: ["분실", "결제", "한도"],
            },
          },
        ],
      },
    } as never);

    renderCard();

    expect(
      screen.getByRole("button", { name: "선택한 도메인 확정" }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /카드 상담/ }));

    expect(screen.getAllByText("92%").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /카드 상담/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByText(/intent clustering 입력으로 반영되며/),
    ).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "선택한 도메인 확정" }));

    // 후보 값으로 시드된 profile이 그대로 전송된다(편집하지 않은 경우).
    expect(mutate).toHaveBeenCalledWith({
      reviewTaskId: 101,
      confirmedDomain: "카드 상담",
      displayName: "카드 상담",
      description: "카드 분실, 결제, 한도 문의가 섞인 상담",
      domainLexicon: [],
      evidenceTerms: ["분실", "결제", "한도"],
      exclusionTerms: [],
    });
  });

  it("sends operator-edited profile fields when confirming a selected domain", () => {
    const mutate = vi.fn();
    mockedUseConfirmDomain.mockReturnValue({
      isPending: false,
      mutate,
    } as never);
    mockedUseCheckpoint.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        pipelineJobId: 7,
        pipelineStatus: "WAITING_DOMAIN_CONFIRMATION",
        reviewKind: "DOMAIN_CONFIRMATION",
        tasks: [
          {
            id: 101,
            targetType: "DOMAIN_CANDIDATE",
            status: "OPEN",
            priority: "HIGH",
            title: "카드 상담",
            payload: {
              displayName: "카드 상담",
              confidence: 0.92,
              description: "카드 분실, 결제, 한도 문의가 섞인 상담",
              evidenceTerms: ["분실", "결제", "한도"],
              suggestedDomainLexicon: ["카드", "결제"],
            },
          },
        ],
      },
    } as never);

    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /카드 상담/ }));

    fireEvent.change(screen.getByLabelText("도메인명"), {
      target: { value: "신용카드 분실/도난" },
    });
    fireEvent.change(screen.getByLabelText("제외 키워드 (선택)"), {
      target: { value: "배송, 배송, 환불\n" },
    });

    fireEvent.click(screen.getByRole("button", { name: "선택한 도메인 확정" }));

    expect(mutate).toHaveBeenCalledWith({
      reviewTaskId: 101,
      confirmedDomain: "신용카드 분실/도난",
      displayName: "카드 상담",
      description: "카드 분실, 결제, 한도 문의가 섞인 상담",
      domainLexicon: ["카드", "결제"],
      evidenceTerms: ["분실", "결제", "한도"],
      exclusionTerms: ["배송", "환불"],
    });
  });

  it("keeps domain confirmation disabled while confirmation is pending", () => {
    mockedUseConfirmDomain.mockReturnValue({
      isPending: true,
      mutate: vi.fn(),
    } as never);
    mockedUseCheckpoint.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        pipelineJobId: 7,
        pipelineStatus: "WAITING_DOMAIN_CONFIRMATION",
        reviewKind: "DOMAIN_CONFIRMATION",
        tasks: [
          {
            id: 101,
            targetType: "DOMAIN_CANDIDATE",
            status: "OPEN",
            priority: "HIGH",
            title: "카드 상담",
            payload: {
              displayName: "카드 상담",
              confidence: 0.92,
              description: "카드 분실, 결제, 한도 문의가 섞인 상담",
              evidenceTerms: ["분실", "결제", "한도"],
            },
          },
        ],
      },
    } as never);

    renderCard();

    expect(screen.getByRole("button", { name: /카드 상담/ })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "확정 중입니다" }),
    ).toBeDisabled();
  });

  it("shows candidate rationale and evidence snippet for domain confirmation", () => {
    mockedUseCheckpoint.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        pipelineJobId: 7,
        pipelineStatus: "WAITING_DOMAIN_CONFIRMATION",
        reviewKind: "DOMAIN_CONFIRMATION",
        tasks: [
          {
            id: 101,
            targetType: "DOMAIN_CANDIDATE",
            status: "OPEN",
            priority: "HIGH",
            title: "카드 상담",
            payload: {
              displayName: "카드 상담",
              confidence: 0.92,
              kind: "domain",
              description: "카드 분실, 결제, 한도 문의",
              rationale: "카드 분실·정지 문의가 반복적으로 나타납니다.",
              evidenceTerms: ["분실", "한도"],
              evidenceSnippets: [
                { conversationId: "c1", snippet: "카드를 분실했어요 정지 부탁합니다" },
              ],
            },
          },
        ],
      },
    } as never);

    renderCard();

    expect(
      screen.getByText("카드 분실·정지 문의가 반복적으로 나타납니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("카드를 분실했어요 정지 부탁합니다"),
    ).toBeInTheDocument();
    expect(screen.getByText("c1")).toBeInTheDocument();
  });

  it("distinguishes the fallback candidate and guides re-review on selection", () => {
    mockedUseCheckpoint.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        pipelineJobId: 7,
        pipelineStatus: "WAITING_DOMAIN_CONFIRMATION",
        reviewKind: "DOMAIN_CONFIRMATION",
        tasks: [
          {
            id: 201,
            targetType: "DOMAIN_CANDIDATE",
            status: "OPEN",
            priority: "HIGH",
            title: "혼합 또는 미확정",
            payload: {
              displayName: "혼합 또는 미확정",
              confidence: 0,
              kind: "fallback",
              isFallback: true,
              fallbackReason: "llm_request_failure",
              description: "도메인을 확정하기 어려운 상담 로그입니다.",
              rationale: "도메인 분류 모델 호출에 실패했습니다.",
            },
          },
        ],
      },
    } as never);

    renderCard();

    // fallback 후보는 신뢰도 대신 원인 badge로 구분된다.
    expect(screen.getByText("도메인 분류 호출 실패")).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /혼합 또는 미확정/ }),
    );

    expect(
      screen.getByText(/profile을 직접 작성하거나 업로드부터 재검토/),
    ).toBeInTheDocument();
  });

  it("guides operators when the selected candidate has low confidence", () => {
    mockedUseCheckpoint.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        pipelineJobId: 7,
        pipelineStatus: "WAITING_DOMAIN_CONFIRMATION",
        reviewKind: "DOMAIN_CONFIRMATION",
        tasks: [
          {
            id: 301,
            targetType: "DOMAIN_CANDIDATE",
            status: "OPEN",
            priority: "HIGH",
            title: "카드 상담",
            payload: {
              displayName: "카드 상담",
              confidence: 0.3,
              kind: "domain",
              description: "신뢰도가 낮은 후보",
            },
          },
        ],
      },
    } as never);

    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /카드 상담/ }));

    expect(
      screen.getByText(/후보 신뢰도가 낮습니다/),
    ).toBeInTheDocument();
  });

  it("refreshes active review sessions without open tasks", () => {
    const refetch = vi.fn();
    mockedUseCheckpoint.mockReturnValue({
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch,
      data: {
        pipelineJobId: 7,
        pipelineStatus: "WAITING_DOMAIN_CONFIRMATION",
        reviewKind: "DOMAIN_CONFIRMATION",
        tasks: [
          {
            id: 101,
            targetType: "DOMAIN_CANDIDATE",
            status: "RESOLVED",
            priority: "HIGH",
            title: "카드 상담",
            payload: {},
          },
        ],
      },
    } as never);

    renderCard();

    expect(
      screen.getByText("현재 확인할 리뷰 작업이 없습니다."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "작업 새로고침" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("submits pairwise feedback with conversation evidence", () => {
    const mutate = vi.fn();
    mockedUseSubmitFeedback.mockReturnValue({
      isPending: false,
      mutate,
    } as never);
    mockedUseCheckpoint.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        pipelineJobId: 7,
        pipelineStatus: "WAITING_HUMAN_FEEDBACK",
        reviewKind: "HUMAN_FEEDBACK",
        tasks: [
          {
            id: 201,
            targetType: "FEEDBACK_PAIR",
            status: "OPEN",
            priority: "NORMAL",
            title: "이 두 상담은 같은 업무인가?",
            payload: {
              questionText: "이 두 상담은 같은 업무인가?",
              reason: "low_confidence_cluster_boundary",
              sourceReviewContext: {
                conversationId: "A-1",
                summary: "카드 분실 후 정지 요청",
                object: "카드",
                action: "정지",
                signals: ["분실", "정지"],
                turns: [
                  { role: "customer", text: "카드를 잃어버렸어요." },
                  { role: "agent", text: "분실 정지를 도와드리겠습니다." },
                  { text: "본인 확인 완료" },
                ],
              },
              targetReviewContext: {
                conversationId: "B-1",
                summary: "카드 결제 한도 상향 요청",
                object: "한도",
                action: "상향",
                signals: ["결제", "한도"],
                logExcerpt: "고객: 결제 한도를 올리고 싶어요.",
              },
            },
          },
        ],
      },
    } as never);

    renderCard();

    expect(screen.getByText("카드를 잃어버렸어요.")).toBeInTheDocument();
    expect(
      screen.getByText("고객: 결제 한도를 올리고 싶어요."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "분리하기" }));
    fireEvent.click(
      screen.getByRole("button", { name: "피드백 반영 후 replay" }),
    );

    expect(mutate.mock.calls[0]?.[0]).toEqual([
      { reviewTaskId: 201, decisionType: "cannot_link" },
    ]);
  });

  it("renders workflow boundary choices from the question payload", () => {
    const mutate = vi.fn();
    mockedUseSubmitFeedback.mockReturnValue({
      isPending: false,
      mutate,
    } as never);
    mockedUseCheckpoint.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        pipelineJobId: 7,
        pipelineStatus: "WAITING_HUMAN_FEEDBACK",
        reviewKind: "HUMAN_FEEDBACK",
        tasks: [
          {
            id: 202,
            targetType: "FEEDBACK_PAIR",
            status: "OPEN",
            priority: "HIGH",
            title: "workflow 경계 확인",
            payload: {
              questionType: "WORKFLOW_BOUNDARY",
              decisionScope: "workflow",
              questionText:
                "같은 intent 안에서 두 상담을 같은 workflow로 합쳐도 되나요?",
              reason: "same_source_cluster_split",
              answerOptions: [
                { value: "same_workflow", label: "같은 workflow로 합치기" },
                {
                  value: "same_intent_separate_workflow",
                  label: "같은 intent지만 workflow는 분리",
                },
                { value: "different_intent", label: "다른 intent로 분리" },
                { value: "unsure", label: "판단 보류" },
              ],
              sourceReviewContext: {
                conversationId: "A-2",
                summary: "환불 전 결제 확인",
              },
              targetReviewContext: {
                conversationId: "B-2",
                summary: "환불 전 본인 확인",
              },
            },
          },
        ],
      },
    } as never);

    renderCard();

    expect(
      screen.getByText("Workflow boundary · workflow scope"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "같은 클러스터에서 서로 다른 workflow 후보로 갈라졌습니다.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "같은 intent지만 workflow는 분리" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "피드백 반영 후 replay" }),
    );

    expect(mutate.mock.calls[0]?.[0]).toEqual([
      { reviewTaskId: 202, decisionType: "same_intent_separate_workflow" },
    ]);
  });

  it("ignores saved feedback choices outside the current question options", async () => {
    window.localStorage.setItem(
      feedbackDraftKey,
      JSON.stringify({ 202: "cannot_link" }),
    );
    mockedUseCheckpoint.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        pipelineJobId: 7,
        pipelineStatus: "WAITING_HUMAN_FEEDBACK",
        reviewKind: "HUMAN_FEEDBACK",
        tasks: [
          {
            id: 202,
            targetType: "FEEDBACK_PAIR",
            status: "OPEN",
            priority: "HIGH",
            title: "workflow 경계 확인",
            payload: {
              questionType: "WORKFLOW_BOUNDARY",
              decisionScope: "workflow",
              questionText:
                "같은 intent 안에서 두 상담을 같은 workflow로 합쳐도 되나요?",
              answerOptions: [
                { value: "same_workflow", label: "같은 workflow로 합치기" },
                {
                  value: "same_intent_separate_workflow",
                  label: "같은 intent지만 workflow는 분리",
                },
                { value: "different_intent", label: "다른 intent로 분리" },
                { value: "unsure", label: "판단 보류" },
              ],
              sourceReviewContext: { summary: "환불 전 결제 확인" },
              targetReviewContext: { summary: "환불 전 본인 확인" },
            },
          },
        ],
      },
    } as never);

    renderCard();

    await waitFor(() =>
      expect(screen.getByText("0/1 answered")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "다른 intent로 분리" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: "피드백 반영 후 replay" }),
    ).toBeDisabled();
  });

  it("restores saved feedback choices for the current pipeline job", async () => {
    window.localStorage.setItem(
      feedbackDraftKey,
      JSON.stringify({ 201: "cannot_link" }),
    );
    mockedUseCheckpoint.mockReturnValue({
      isLoading: false,
      isError: false,
      data: createHumanFeedbackCheckpoint([201]),
    } as never);

    renderCard();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "분리하기" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    expect(
      screen.getByRole("button", { name: "피드백 반영 후 replay" }),
    ).not.toBeDisabled();
  });

  it("keeps submit disabled until every open feedback task is answered", async () => {
    mockedUseCheckpoint.mockReturnValue({
      isLoading: false,
      isError: false,
      data: createHumanFeedbackCheckpoint([201, 202]),
    } as never);

    renderCard();

    fireEvent.click(screen.getAllByRole("button", { name: "분리하기" })[0]);

    await waitFor(() =>
      expect(screen.getByText("1/2 answered")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "피드백 반영 후 replay" }),
    ).toBeDisabled();
  });

  it("stores feedback choices and warns before leaving with unsent feedback", async () => {
    mockedUseCheckpoint.mockReturnValue({
      isLoading: false,
      isError: false,
      data: createHumanFeedbackCheckpoint([201]),
    } as never);

    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "판단 보류" }));

    await waitFor(() =>
      expect(window.localStorage.getItem(feedbackDraftKey)).toBe(
        JSON.stringify({ 201: "unsure" }),
      ),
    );

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("clears saved feedback choices after successful submission", async () => {
    const mutate = vi.fn();
    mockedUseSubmitFeedback.mockReturnValue({
      isPending: false,
      mutate,
    } as never);
    mockedUseCheckpoint.mockReturnValue({
      isLoading: false,
      isError: false,
      data: createHumanFeedbackCheckpoint([201]),
    } as never);

    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "같은 intent로 묶기" }));
    fireEvent.click(
      screen.getByRole("button", { name: "피드백 반영 후 replay" }),
    );

    await waitFor(() =>
      expect(window.localStorage.getItem(feedbackDraftKey)).toBe(
        JSON.stringify({ 201: "must_link" }),
      ),
    );

    mutate.mock.calls[0]?.[1]?.onSuccess?.(undefined, [], undefined);

    expect(window.localStorage.getItem(feedbackDraftKey)).toBeNull();
  });

  it("clears stale feedback draft outside human feedback checkpoints", async () => {
    window.localStorage.setItem(
      feedbackDraftKey,
      JSON.stringify({ 201: "cannot_link" }),
    );
    mockedUseCheckpoint.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        pipelineJobId: 7,
        pipelineStatus: "SUCCEEDED",
        reviewKind: null,
        tasks: [],
      },
    } as never);

    renderCard();

    await waitFor(() =>
      expect(window.localStorage.getItem(feedbackDraftKey)).toBeNull(),
    );
  });

  it("renders feedback reason labels and empty evidence fallback", () => {
    mockedUseCheckpoint.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        pipelineJobId: 7,
        pipelineStatus: "WAITING_HUMAN_FEEDBACK",
        reviewKind: "HUMAN_FEEDBACK",
        tasks: [
          {
            id: 301,
            targetType: "FEEDBACK_PAIR",
            status: "OPEN",
            priority: "NORMAL",
            title: "클러스터 분리 확인",
            payload: {
              reason: "same_source_cluster_split",
              sourceReviewContext: {},
              targetReviewContext: {},
            },
          },
          {
            id: 302,
            targetType: "FEEDBACK_PAIR",
            status: "OPEN",
            priority: "NORMAL",
            title: "기본 사유 확인",
            payload: {
              reason: "other",
              reasonLabel: "운영자 확인이 필요한 후보입니다.",
              sourceSnippet: "고객: 배송지를 바꾸고 싶어요.",
              targetReviewContext: {},
            },
          },
        ],
      },
    } as never);

    renderCard();

    expect(
      screen.getByText(
        "같은 클러스터에서 서로 다른 workflow 후보로 갈라졌습니다.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("운영자 확인이 필요한 후보입니다."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("업무 내용을 확인할 수 없습니다.")).toHaveLength(
      3,
    );
  });

  it("shows completed state with a domain pack management CTA when there is no active review kind", () => {
    const refetch = vi.fn();
    mockedUseCheckpoint.mockReturnValue({
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch,
      data: {
        pipelineJobId: 7,
        pipelineStatus: "SUCCEEDED",
        reviewKind: null,
        tasks: [],
      },
    } as never);

    renderCard();

    expect(
      screen.getByText("리뷰 체크포인트가 완료되었습니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "도메인팩 관리로 이동" }),
    ).toHaveAttribute("href", "/workspaces/1/domain-packs");
    fireEvent.click(screen.getByRole("button", { name: "상태 새로고침" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows failed state with upload retry and job refresh actions", () => {
    const refetch = vi.fn();
    mockedUseCheckpoint.mockReturnValue({
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch,
      data: {
        pipelineJobId: 7,
        pipelineStatus: "FAILED",
        reviewKind: null,
        tasks: [],
      },
    } as never);

    renderCard();

    expect(screen.getByText("파이프라인이 실패했습니다.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "업로드를 다시 시작하거나 현재 job 상태를 다시 조회할 수 있습니다.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "업로드 다시 시작" }),
    ).toHaveAttribute("href", "/workspaces/1/upload");
    fireEvent.click(screen.getByRole("button", { name: "현재 job 새로고침" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows cancelled state with upload retry and job refresh actions", () => {
    const refetch = vi.fn();
    mockedUseCheckpoint.mockReturnValue({
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch,
      data: {
        pipelineJobId: 7,
        pipelineStatus: "CANCELLED",
        reviewKind: null,
        tasks: [],
      },
    } as never);

    renderCard();

    expect(
      screen.getByText("파이프라인이 취소되었습니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "업로드를 다시 시작하거나 취소된 job 상태를 다시 조회할 수 있습니다.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "업로드 다시 시작" }),
    ).toHaveAttribute("href", "/workspaces/1/upload");
    expect(
      screen.queryByRole("link", { name: "도메인팩 관리로 이동" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "현재 job 새로고침" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows only refresh for no active checkpoint waiting states", () => {
    const refetch = vi.fn();
    mockedUseCheckpoint.mockReturnValue({
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch,
      data: {
        pipelineJobId: 7,
        pipelineStatus: "RUNNING",
        reviewKind: null,
        tasks: [],
      },
    } as never);

    renderCard();

    expect(
      screen.getByText("활성 리뷰 체크포인트가 없습니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "파이프라인이 검토 입력을 기다리는 상태가 되면 이 화면에 작업이 표시됩니다. 완료 전 승인/적용은 시작하지 않습니다.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "도메인팩 관리로 이동" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /승인|적용|배포/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "상태 새로고침" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("disables refresh while no active checkpoint state is fetching", () => {
    mockedUseCheckpoint.mockReturnValue({
      isLoading: false,
      isError: false,
      isFetching: true,
      refetch: vi.fn(),
      data: {
        pipelineJobId: 7,
        pipelineStatus: "RUNNING",
        reviewKind: null,
        tasks: [],
      },
    } as never);

    renderCard();

    expect(
      screen.getByRole("button", { name: "상태 새로고침" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("link", { name: "도메인팩 관리로 이동" }),
    ).not.toBeInTheDocument();
  });
});

function createHumanFeedbackCheckpoint(taskIds: number[]) {
  return {
    pipelineJobId: 7,
    pipelineStatus: "WAITING_HUMAN_FEEDBACK",
    reviewKind: "HUMAN_FEEDBACK",
    tasks: taskIds.map((id) => ({
      id,
      targetType: "FEEDBACK_PAIR",
      status: "OPEN",
      priority: "NORMAL",
      title: "이 두 상담은 같은 업무인가?",
      payload: {
        questionText: "이 두 상담은 같은 업무인가?",
        reason: "low_confidence_cluster_boundary",
        sourceReviewContext: {
          conversationId: `A-${id}`,
          summary: "카드 분실 후 정지 요청",
        },
        targetReviewContext: {
          conversationId: `B-${id}`,
          summary: "카드 결제 한도 상향 요청",
        },
      },
    })),
  };
}
