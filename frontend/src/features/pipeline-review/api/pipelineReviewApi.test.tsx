import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmDomain,
  getCheckpoint,
  submitFeedback,
} from "@/shared/api/generated/endpoints/pipeline-review-controller/pipeline-review-controller";
import {
  useConfirmPipelineDomain,
  usePipelineReviewCheckpoint,
  useSubmitPipelineFeedback,
} from "./pipelineReviewApi";

vi.mock(
  "@/shared/api/generated/endpoints/pipeline-review-controller/pipeline-review-controller",
  () => ({
    getCheckpoint: vi.fn(),
    confirmDomain: vi.fn(),
    submitFeedback: vi.fn(),
  }),
);

const mockedGetCheckpoint = vi.mocked(getCheckpoint);
const mockedConfirmDomain = vi.mocked(confirmDomain);
const mockedSubmitFeedback = vi.mocked(submitFeedback);

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
});

describe("pipelineReviewApi", () => {
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

  it("does not fetch checkpoint until ids are available", () => {
    renderHook(() => usePipelineReviewCheckpoint(undefined, 7), { wrapper });

    expect(mockedGetCheckpoint).not.toHaveBeenCalled();
  });

  it("posts selected domain candidate via generated confirmDomain", async () => {
    mockedConfirmDomain.mockResolvedValueOnce({
      data: { status: "DOMAIN_CONFIRMED_REPLAY_TRIGGERED" },
      status: 200,
    } as unknown as Awaited<ReturnType<typeof confirmDomain>>);

    const { result } = renderHook(() => useConfirmPipelineDomain(1, 7), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(11);
    });

    expect(mockedConfirmDomain).toHaveBeenCalledWith(1, 7, { reviewTaskId: 11 });
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
});
