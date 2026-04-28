import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiRequestError } from "@/shared/api";
import { useUpdateWorkflow } from "./useUpdateWorkflow";

vi.mock("@/entities/workflow", () => ({
  patchWorkflow: vi.fn(),
  workflowQueryKeys: {
    all: ["workflows"] as const,
    lists: () => ["workflows", "list"] as const,
    list: (...args: number[]) => ["workflows", "list", ...args] as const,
    details: () => ["workflows", "detail"] as const,
    detail: (...args: number[]) => ["workflows", "detail", ...args] as const,
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { patchWorkflow } from "@/entities/workflow";
import { toast } from "sonner";

const mockedPatch = vi.mocked(patchWorkflow);

const stubDetail = {
  id: 10,
  workflowCode: "W001",
  name: "수정됨",
  description: null,
  graphJson: { direction: "LR" as const, nodes: [], edges: [] },
  initialState: null,
  terminalStatesJson: "[]",
  evidenceJson: "{}",
  metaJson: "{}",
  createdAt: "",
  updatedAt: "",
};

const mutateParams = {
  wsId: 1,
  packId: 2,
  versionId: 3,
  workflowId: 10,
  body: {
    name: "수정됨",
    graphJson: { direction: "LR" as const, nodes: [], edges: [] },
  },
};

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useUpdateWorkflow", () => {
  beforeEach(() => {
    mockedPatch.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("성공 시 toast.success를 호출한다", async () => {
    mockedPatch.mockResolvedValue(stubDetail);
    const { result } = renderHook(() => useUpdateWorkflow(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync(mutateParams);
    });

    expect(toast.success).toHaveBeenCalledWith("워크플로우가 수정되었습니다.");
  });

  it("알려진 에러 코드 WORKFLOW_NOT_EDITABLE에 대해 매핑된 메시지를 표시한다", async () => {
    mockedPatch.mockRejectedValue(
      new ApiRequestError(422, "WORKFLOW_NOT_EDITABLE", "수정 불가"),
    );
    const { result } = renderHook(() => useUpdateWorkflow(), { wrapper: makeWrapper() });

    act(() => {
      result.current.mutate(mutateParams);
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "DRAFT 상태의 버전에서만 수정할 수 있습니다.",
      ),
    );
  });

  it("알려진 에러 코드 WORKFLOW_INVALID_START_NODE에 대해 매핑된 메시지를 표시한다", async () => {
    mockedPatch.mockRejectedValue(
      new ApiRequestError(422, "WORKFLOW_INVALID_START_NODE", "노드 오류"),
    );
    const { result } = renderHook(() => useUpdateWorkflow(), { wrapper: makeWrapper() });

    act(() => {
      result.current.mutate(mutateParams);
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("START 노드가 정확히 1개여야 합니다."),
    );
  });

  it("알 수 없는 에러의 경우 기본 에러 메시지를 표시한다", async () => {
    mockedPatch.mockRejectedValue(new Error("unexpected"));
    const { result } = renderHook(() => useUpdateWorkflow(), { wrapper: makeWrapper() });

    act(() => {
      result.current.mutate(mutateParams);
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("워크플로우 수정에 실패했습니다."),
    );
  });
});
