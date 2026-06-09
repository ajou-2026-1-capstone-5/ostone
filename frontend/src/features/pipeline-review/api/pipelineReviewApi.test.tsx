import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmDomain,
  getCheckpoint,
  getReplayDiff,
  submitFeedback,
} from "@/shared/api/generated/endpoints/pipeline-review-controller/pipeline-review-controller";
import {
  shouldPollPipelineReviewCheckpoint,
  useConfirmPipelineDomain,
  usePipelineReviewCheckpoint,
  useReplayDiff,
  useSubmitPipelineFeedback,
} from "./pipelineReviewApi";

vi.mock(
  "@/shared/api/generated/endpoints/pipeline-review-controller/pipeline-review-controller",
  () => ({
    getCheckpoint: vi.fn(),
    confirmDomain: vi.fn(),
    submitFeedback: vi.fn(),
    getReplayDiff: vi.fn(),
  }),
);

const mockedGetCheckpoint = vi.mocked(getCheckpoint);
const mockedConfirmDomain = vi.mocked(confirmDomain);
const mockedSubmitFeedback = vi.mocked(submitFeedback);
const mockedGetReplayDiff = vi.mocked(getReplayDiff);

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  mockedGetCheckpoint.mockReset();
  mockedConfirmDomain.mockReset();
  mockedSubmitFeedback.mockReset();
  mockedGetReplayDiff.mockReset();
});

describe("pipelineReviewApi", () => {
  it.each([
    ["RUNNING", null, true],
    ["QUEUED", null, true],
    ["WAITING_DOMAIN_CONFIRMATION", null, true],
    ["WAITING_DOMAIN_CONFIRMATION", "DOMAIN_CONFIRMATION", false],
    ["WAITING_HUMAN_FEEDBACK", "HUMAN_FEEDBACK", false],
    ["SUCCEEDED", null, false],
    ["FAILED", null, false],
    ["CANCELLED", null, false],
  ] as const)(
    "returns the polling decision for status %s and review kind %s",
    (pipelineStatus, reviewKind, expected) => {
      expect(
        shouldPollPipelineReviewCheckpoint({
          pipelineJobId: 7,
          pipelineStatus,
          reviewKind,
          tasks: [],
        }),
      ).toBe(expected);
    },
  );

  it("polls until the first checkpoint payload is available when auto refresh is enabled", () => {
    expect(shouldPollPipelineReviewCheckpoint()).toBe(true);
  });

  it("delegates checkpoint query to generated getCheckpoint and unwraps data", async () => {
    const checkpoint = {
      pipelineJobId: 7,
      pipelineStatus: "WAITING_DOMAIN_CONFIRMATION",
      reviewKind: "DOMAIN_CONFIRMATION",
      tasks: [],
    };
    mockedGetCheckpoint.mockResolvedValueOnce({
      data: checkpoint,
      status: 200,
    } as unknown as Awaited<ReturnType<typeof getCheckpoint>>);

    const { result } = renderHook(() => usePipelineReviewCheckpoint(1, 7), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetCheckpoint).toHaveBeenCalledWith(1, 7);
    expect(result.current.data).toEqual(checkpoint);
  });

  it("keeps polling active pipeline progress when auto refresh is enabled", async () => {
    const runningCheckpoint = {
      pipelineJobId: 7,
      pipelineStatus: "RUNNING",
      reviewKind: null,
      tasks: [],
    };
    const succeededCheckpoint = {
      pipelineJobId: 7,
      pipelineStatus: "SUCCEEDED",
      reviewKind: null,
      tasks: [],
    };
    mockedGetCheckpoint
      .mockResolvedValueOnce({
        data: runningCheckpoint,
        status: 200,
      } as unknown as Awaited<ReturnType<typeof getCheckpoint>>)
      .mockResolvedValueOnce({
        data: succeededCheckpoint,
        status: 200,
      } as unknown as Awaited<ReturnType<typeof getCheckpoint>>);

    const { result } = renderHook(
      () => usePipelineReviewCheckpoint(1, 7, { autoRefresh: true, refetchIntervalMs: 100 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data).toEqual(runningCheckpoint));
    await waitFor(() => expect(result.current.data).toEqual(succeededCheckpoint));
    expect(mockedGetCheckpoint).toHaveBeenCalledTimes(2);
  });

  it("does not fetch checkpoint until ids are available", () => {
    renderHook(() => usePipelineReviewCheckpoint(undefined, 7), { wrapper });

    expect(mockedGetCheckpoint).not.toHaveBeenCalled();
  });

  it("posts selected domain candidate and operator-edited profile via generated confirmDomain", async () => {
    mockedConfirmDomain.mockResolvedValueOnce({
      data: { status: "DOMAIN_CONFIRMED_REPLAY_TRIGGERED" },
      status: 200,
    } as unknown as Awaited<ReturnType<typeof confirmDomain>>);

    const { result } = renderHook(() => useConfirmPipelineDomain(1, 7), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        reviewTaskId: 11,
        confirmedDomain: "신용카드 분실/도난",
        domainLexicon: ["재발급"],
        exclusionTerms: ["배송"],
      });
    });

    expect(mockedConfirmDomain).toHaveBeenCalledWith(1, 7, {
      reviewTaskId: 11,
      confirmedDomain: "신용카드 분실/도난",
      domainLexicon: ["재발급"],
      exclusionTerms: ["배송"],
    });
  });

  it("posts feedback decisions via generated submitFeedback", async () => {
    mockedSubmitFeedback.mockResolvedValueOnce({
      data: { status: "FEEDBACK_REPLAY_TRIGGERED" },
      status: 200,
    } as unknown as Awaited<ReturnType<typeof submitFeedback>>);

    const { result } = renderHook(() => useSubmitPipelineFeedback(1, 7), { wrapper });

    await act(async () => {
      await result.current.mutateAsync([{ reviewTaskId: 21, decisionType: "cannot_link" }]);
    });

    expect(mockedSubmitFeedback).toHaveBeenCalledWith(1, 7, {
      decisions: [{ reviewTaskId: 21, decisionType: "cannot_link" }],
    });
  });

  it("does not fetch replay diff until ids are available", () => {
    renderHook(() => useReplayDiff(undefined, 7), { wrapper });

    expect(mockedGetReplayDiff).not.toHaveBeenCalled();
  });

  it("normalizes a full READY replay diff from generated getReplayDiff", async () => {
    mockedGetReplayDiff.mockResolvedValueOnce({
      data: {
        available: true,
        status: "READY",
        reason: null,
        structureComparisonAvailable: true,
        intent: {
          splitCount: 1,
          mergeCount: 2,
          labelChanges: [{ id: "0", before: "카드", after: "카드 분실" }],
        },
        workflow: { splitCount: 0, mergeCount: 1, labelChanges: [] },
        decisions: [
          {
            reviewTaskId: 10,
            scope: "intent",
            decisionType: "must_link",
            sourceId: "c1",
            targetId: "c2",
            status: "applied",
            reason: null,
            effect: "merged",
          },
          {
            reviewTaskId: 11,
            scope: "workflow",
            decisionType: "separate_workflow",
            sourceId: "c3",
            targetId: "c4",
            status: "partially_applied",
            reason: "workflow_separated_but_intent_differs",
            effect: "split",
          },
        ],
        summary: { applied: 1, partiallyApplied: 1, ignored: 0, total: 2 },
      },
      status: 200,
    } as unknown as Awaited<ReturnType<typeof getReplayDiff>>);

    const { result } = renderHook(() => useReplayDiff(1, 7), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetReplayDiff).toHaveBeenCalledWith(1, 7);
    expect(result.current.data?.status).toBe("READY");
    expect(result.current.data?.intent.labelChanges[0].after).toBe("카드 분실");
    expect(result.current.data?.decisions[1].status).toBe("partially_applied");
    expect(result.current.data?.decisions[1].effect).toBe("split");
    expect(result.current.data?.summary.total).toBe(2);
  });

  it("applies safe defaults and clamps unknown status to NOT_APPLICABLE", async () => {
    mockedGetReplayDiff.mockResolvedValueOnce({
      data: {
        status: "WAT",
        decisions: [{ sourceId: "c1", targetId: "c2", status: "weird" }],
      },
      status: 200,
    } as unknown as Awaited<ReturnType<typeof getReplayDiff>>);

    const { result } = renderHook(() => useReplayDiff(1, 7), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.status).toBe("NOT_APPLICABLE");
    expect(result.current.data?.available).toBe(false);
    expect(result.current.data?.intent.splitCount).toBe(0);
    expect(result.current.data?.intent.labelChanges).toEqual([]);
    expect(result.current.data?.decisions[0].status).toBe("ignored");
    expect(result.current.data?.decisions[0].reviewTaskId).toBeNull();
    expect(result.current.data?.summary).toEqual({
      applied: 0,
      partiallyApplied: 0,
      ignored: 0,
      total: 0,
    });
  });
});
