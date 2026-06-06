import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useConfirmPipelineDomain,
  usePipelineReviewCheckpoint,
  useSubmitPipelineFeedback,
} from "../api/pipelineReviewApi";
import { PipelineReviewCheckpointCard } from "./PipelineReviewCheckpointCard";

vi.mock("../api/pipelineReviewApi", () => ({
  usePipelineReviewCheckpoint: vi.fn(),
  useConfirmPipelineDomain: vi.fn(),
  useSubmitPipelineFeedback: vi.fn(),
}));

const mockedUseCheckpoint = vi.mocked(usePipelineReviewCheckpoint);
const mockedUseConfirmDomain = vi.mocked(useConfirmPipelineDomain);
const mockedUseSubmitFeedback = vi.mocked(useSubmitPipelineFeedback);
const feedbackDraftKey = "ostone:pipeline-review:feedback-draft:1:7";

function renderCard(
  props: { workspaceId?: number; pipelineJobId?: number } = { workspaceId: 1, pipelineJobId: 7 },
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
  mockedUseConfirmDomain.mockReturnValue({ isPending: false, mutate: vi.fn() } as never);
  mockedUseSubmitFeedback.mockReturnValue({ isPending: false, mutate: vi.fn() } as never);
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

    expect(screen.getByText("리뷰 체크포인트를 불러오는 중입니다.")).toBeInTheDocument();
  });

  it("retries checkpoint loading from the error state", () => {
    const refetch = vi.fn();
    mockedUseCheckpoint.mockReturnValue({
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch,
    } as never);

    renderCard();

    expect(screen.getByText("리뷰 체크포인트를 불러오지 못했습니다.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("confirms selected domain candidate", () => {
    const mutate = vi.fn();
    mockedUseConfirmDomain.mockReturnValue({ isPending: false, mutate } as never);
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

    fireEvent.click(screen.getByRole("button", { name: /카드 상담/ }));

    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(mutate).toHaveBeenCalledWith(101);
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

    expect(screen.getByText("현재 확인할 리뷰 작업이 없습니다.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "작업 새로고침" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("submits pairwise feedback with conversation evidence", () => {
    const mutate = vi.fn();
    mockedUseSubmitFeedback.mockReturnValue({ isPending: false, mutate } as never);
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
    expect(screen.getByText("고객: 결제 한도를 올리고 싶어요.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "분리하기" }));
    fireEvent.click(screen.getByRole("button", { name: "피드백 반영 후 replay" }));

    expect(mutate.mock.calls[0]?.[0]).toEqual([{ reviewTaskId: 201, decisionType: "cannot_link" }]);
  });

  it("restores saved feedback choices for the current pipeline job", async () => {
    window.localStorage.setItem(feedbackDraftKey, JSON.stringify({ 201: "cannot_link" }));
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
    expect(screen.getByRole("button", { name: "피드백 반영 후 replay" })).not.toBeDisabled();
  });

  it("keeps submit disabled until every open feedback task is answered", async () => {
    mockedUseCheckpoint.mockReturnValue({
      isLoading: false,
      isError: false,
      data: createHumanFeedbackCheckpoint([201, 202]),
    } as never);

    renderCard();

    fireEvent.click(screen.getAllByRole("button", { name: "분리하기" })[0]);

    await waitFor(() => expect(screen.getByText("1/2 answered")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "피드백 반영 후 replay" })).toBeDisabled();
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
      expect(window.localStorage.getItem(feedbackDraftKey)).toBe(JSON.stringify({ 201: "unsure" })),
    );

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("clears saved feedback choices after successful submission", async () => {
    const mutate = vi.fn();
    mockedUseSubmitFeedback.mockReturnValue({ isPending: false, mutate } as never);
    mockedUseCheckpoint.mockReturnValue({
      isLoading: false,
      isError: false,
      data: createHumanFeedbackCheckpoint([201]),
    } as never);

    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "같은 intent로 묶기" }));
    fireEvent.click(screen.getByRole("button", { name: "피드백 반영 후 replay" }));

    await waitFor(() =>
      expect(window.localStorage.getItem(feedbackDraftKey)).toBe(
        JSON.stringify({ 201: "must_link" }),
      ),
    );

    mutate.mock.calls[0]?.[1]?.onSuccess?.(undefined, [], undefined);

    expect(window.localStorage.getItem(feedbackDraftKey)).toBeNull();
  });

  it("clears stale feedback draft outside human feedback checkpoints", async () => {
    window.localStorage.setItem(feedbackDraftKey, JSON.stringify({ 201: "cannot_link" }));
    mockedUseCheckpoint.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { pipelineJobId: 7, pipelineStatus: "SUCCEEDED", reviewKind: null, tasks: [] },
    } as never);

    renderCard();

    await waitFor(() => expect(window.localStorage.getItem(feedbackDraftKey)).toBeNull());
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
      screen.getByText("같은 클러스터에서 서로 다른 workflow 후보로 갈라졌습니다."),
    ).toBeInTheDocument();
    expect(screen.getByText("운영자 확인이 필요한 후보입니다.")).toBeInTheDocument();
    expect(screen.getAllByText("업무 내용을 확인할 수 없습니다.")).toHaveLength(3);
  });

  it("shows completed state with a domain pack management CTA when there is no active review kind", () => {
    const refetch = vi.fn();
    mockedUseCheckpoint.mockReturnValue({
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch,
      data: { pipelineJobId: 7, pipelineStatus: "SUCCEEDED", reviewKind: null, tasks: [] },
    } as never);

    renderCard();

    expect(screen.getByText("리뷰 체크포인트가 완료되었습니다.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "도메인팩 관리로 이동" })).toHaveAttribute(
      "href",
      "/workspaces/1/domain-packs",
    );
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
      data: { pipelineJobId: 7, pipelineStatus: "FAILED", reviewKind: null, tasks: [] },
    } as never);

    renderCard();

    expect(screen.getByText("파이프라인이 실패했습니다.")).toBeInTheDocument();
    expect(
      screen.getByText("업로드를 다시 시작하거나 현재 job 상태를 다시 조회할 수 있습니다."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "업로드 다시 시작" })).toHaveAttribute(
      "href",
      "/workspaces/1/upload",
    );
    fireEvent.click(screen.getByRole("button", { name: "현재 job 새로고침" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows refresh and list navigation for no active checkpoint waiting states", () => {
    const refetch = vi.fn();
    mockedUseCheckpoint.mockReturnValue({
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch,
      data: { pipelineJobId: 7, pipelineStatus: "RUNNING", reviewKind: null, tasks: [] },
    } as never);

    renderCard();

    expect(screen.getByText("활성 리뷰 체크포인트가 없습니다.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "도메인팩 관리로 이동" })).toHaveAttribute(
      "href",
      "/workspaces/1/domain-packs",
    );
    fireEvent.click(screen.getByRole("button", { name: "상태 새로고침" }));
    expect(refetch).toHaveBeenCalledTimes(1);
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
