import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useGetWorkflow } from "./useGetWorkflow";

vi.mock(
  "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller",
  () => ({
    getWorkflow: vi.fn(),
  }),
);

import { getWorkflow } from "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller";

const mockedGetWorkflow = vi.mocked(getWorkflow);

const stubDetail = {
  id: 1,
  workflowCode: "W001",
  name: "테스트",
  description: undefined,
  graphJson: "{}",
  initialState: undefined,
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
  beforeEach(() => mockedGetWorkflow.mockReset());

  it("enabled=false이면 fetch 호출 없이 idle 상태다", () => {
    const { result } = renderHook(() => useGetWorkflow(1, 2, 3, 10, false), {
      wrapper: makeWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedGetWorkflow).not.toHaveBeenCalled();
  });

  it("enabled=true이면 올바른 인수로 queryFn이 호출된다", async () => {
    mockedGetWorkflow.mockResolvedValue({ data: stubDetail, status: 200, headers: new Headers() });
    renderHook(() => useGetWorkflow(1, 2, 3, 10, true), { wrapper: makeWrapper() });
    await waitFor(() => expect(mockedGetWorkflow).toHaveBeenCalledWith(1, 2, 3, 10));
  });

  it("성공 시 data를 반환한다", async () => {
    mockedGetWorkflow.mockResolvedValue({ data: stubDetail, status: 200, headers: new Headers() });
    const { result } = renderHook(() => useGetWorkflow(1, 2, 3, 10, true), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(stubDetail);
  });

  it("enabled=false이면 enabled=true보다 fetch 호출 횟수가 적다", async () => {
    mockedGetWorkflow.mockResolvedValue({ data: stubDetail, status: 200, headers: new Headers() });
    renderHook(() => useGetWorkflow(1, 2, 3, 10, false), { wrapper: makeWrapper() });
    renderHook(() => useGetWorkflow(1, 2, 3, 10, true), { wrapper: makeWrapper() });
    await waitFor(() => expect(mockedGetWorkflow).toHaveBeenCalledTimes(1));
  });
});
