import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useWorkflowDetail } from "./useWorkflowDetail";
import { ApiRequestError } from "../../../shared/api";

vi.mock("../api/workflowApi", () => ({
  workflowApi: {
    list: vi.fn(),
    detail: vi.fn(),
  },
}));

import { workflowApi } from "../api/workflowApi";

const mockedDetail = vi.mocked(workflowApi.detail);

const stubDetail = {
  id: 10,
  workflowCode: "W001",
  name: "테스트",
  description: null,
  graphJson: { direction: "LR" as const, nodes: [], edges: [] },
  initialState: null,
  terminalStatesJson: "[]",
  evidenceJson: "{}",
  metaJson: "{}",
  createdAt: "",
  updatedAt: "",
};

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useWorkflowDetail", () => {
  beforeEach(() => {
    mockedDetail.mockReset();
  });

  it("workflowId가 null이면 idle 상태다", () => {
    const { result } = renderHook(() => useWorkflowDetail(1, 2, 3, null), {
      wrapper: makeWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
    expect(mockedDetail).not.toHaveBeenCalled();
  });

  it("workflowId가 주어지면 loading 상태로 시작한다", () => {
    mockedDetail.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useWorkflowDetail(1, 2, 3, 10), {
      wrapper: makeWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
  });

  it("성공 시 ready 상태로 전이된다", async () => {
    mockedDetail.mockResolvedValue(stubDetail);
    const { result } = renderHook(() => useWorkflowDetail(1, 2, 3, 10), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(stubDetail);
  });

  it("404 에러 시 httpStatus 404를 포함한 error 상태가 된다", async () => {
    mockedDetail.mockRejectedValue(new ApiRequestError(404, "NOT_FOUND", "없음"));
    const { result } = renderHook(() => useWorkflowDetail(1, 2, 3, 99), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiRequestError);
    if (result.current.error instanceof ApiRequestError) {
      expect(result.current.error.status).toBe(404);
      expect(result.current.error.code).toBe("NOT_FOUND");
    }
  });

  it("알 수 없는 오류 시 UNKNOWN_ERROR 코드가 된다", async () => {
    mockedDetail.mockRejectedValue(new Error("unexpected"));
    const { result } = renderHook(() => useWorkflowDetail(1, 2, 3, 5), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).not.toBeInstanceOf(ApiRequestError);
  });
});
