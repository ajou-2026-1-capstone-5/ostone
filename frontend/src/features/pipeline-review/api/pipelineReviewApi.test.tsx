import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { customFetch } from "@/shared/api/mutator";
import {
  useConfirmPipelineDomain,
  usePipelineReviewCheckpoint,
  useSubmitPipelineFeedback,
} from "./pipelineReviewApi";

vi.mock("@/shared/api/mutator", () => ({
  customFetch: vi.fn(),
}));

const mockedCustomFetch = vi.mocked(customFetch);

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  mockedCustomFetch.mockReset();
});

describe("pipelineReviewApi", () => {
  it("fetches checkpoint with workspace and pipeline job ids", async () => {
    mockedCustomFetch.mockResolvedValueOnce({
      pipelineJobId: 7,
      pipelineStatus: "WAITING_DOMAIN_CONFIRMATION",
      reviewKind: "DOMAIN_CONFIRMATION",
      tasks: [],
    });

    const { result } = renderHook(() => usePipelineReviewCheckpoint(1, 7), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedCustomFetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/1/pipeline-jobs/7/review-checkpoint",
      { method: "GET" },
    );
  });

  it("does not fetch checkpoint until ids are available", () => {
    renderHook(() => usePipelineReviewCheckpoint(undefined, 7), { wrapper });

    expect(mockedCustomFetch).not.toHaveBeenCalled();
  });

  it("posts selected domain candidate and invalidates checkpoint query", async () => {
    mockedCustomFetch.mockResolvedValueOnce({ status: "DOMAIN_CONFIRMED_REPLAY_TRIGGERED" });

    const { result } = renderHook(() => useConfirmPipelineDomain(1, 7), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(11);
    });

    expect(mockedCustomFetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/1/pipeline-jobs/7/review-checkpoint/domain-confirmation",
      {
        method: "POST",
        body: JSON.stringify({ reviewTaskId: 11 }),
        headers: { "Content-Type": "application/json" },
      },
    );
  });

  it("posts feedback decisions for replay", async () => {
    mockedCustomFetch.mockResolvedValueOnce({ status: "FEEDBACK_REPLAY_TRIGGERED" });

    const { result } = renderHook(() => useSubmitPipelineFeedback(1, 7), { wrapper });

    await act(async () => {
      await result.current.mutateAsync([{ reviewTaskId: 21, decisionType: "cannot_link" }]);
    });

    expect(mockedCustomFetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/1/pipeline-jobs/7/review-checkpoint/human-feedback",
      {
        method: "POST",
        body: JSON.stringify({
          decisions: [{ reviewTaskId: 21, decisionType: "cannot_link" }],
        }),
        headers: { "Content-Type": "application/json" },
      },
    );
  });
});
