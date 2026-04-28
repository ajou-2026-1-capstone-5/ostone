import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useGetWorkflow } from "./useGetWorkflow";

vi.mock("@/entities/workflow", () => ({
  fetchWorkflow: vi.fn(),
  workflowQueryKeys: {
    all: ["workflows"] as const,
    lists: () => ["workflows", "list"] as const,
    list: (...args: number[]) => ["workflows", "list", ...args] as const,
    details: () => ["workflows", "detail"] as const,
    detail: (...args: number[]) => ["workflows", "detail", ...args] as const,
  },
}));

import { fetchWorkflow } from "@/entities/workflow";

const mockedFetch = vi.mocked(fetchWorkflow);

const stubDetail = {
  id: 1,
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

describe("useGetWorkflow", () => {
  beforeEach(() => mockedFetch.mockReset());

  it("enabled=false이면 fetch 호출 없이 idle 상태다", () => {
    const { result } = renderHook(() => useGetWorkflow(1, 2, 3, 10, false), {
      wrapper: makeWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("enabled=true이면 올바른 인수로 queryFn이 호출된다", async () => {
    mockedFetch.mockResolvedValue(stubDetail);
    renderHook(() => useGetWorkflow(1, 2, 3, 10, true), { wrapper: makeWrapper() });
    await waitFor(() => expect(mockedFetch).toHaveBeenCalledWith(1, 2, 3, 10));
  });

  it("성공 시 data를 반환한다", async () => {
    mockedFetch.mockResolvedValue(stubDetail);
    const { result } = renderHook(() => useGetWorkflow(1, 2, 3, 10, true), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(stubDetail);
  });

  it("enabled=false이면 enabled=true보다 fetch 호출 횟수가 적다", () => {
    mockedFetch.mockResolvedValue(stubDetail);
    renderHook(() => useGetWorkflow(1, 2, 3, 10, false), { wrapper: makeWrapper() });
    renderHook(() => useGetWorkflow(1, 2, 3, 10, true), { wrapper: makeWrapper() });
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });
});
