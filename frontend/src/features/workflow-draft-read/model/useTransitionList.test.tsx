import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { fetchTransitionList } from "@/entities/workflow";
import { useTransitionList } from "./useTransitionList";

vi.mock("@/entities/workflow", () => ({
  fetchTransitionList: vi.fn(),
  transitionQueryKeys: {
    all: ["transitions"] as const,
    lists: () => ["transitions", "list"] as const,
    list: (wsId: number, packId: number, versionId: number, workflowId: number) =>
      ["transitions", "list", wsId, packId, versionId, workflowId] as const,
  },
}));

const mockedFetch = vi.mocked(fetchTransitionList);

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useTransitionList", () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it("workflowId=null이면 쿼리가 비활성화되어 fetch를 호출하지 않는다", () => {
    const { result } = renderHook(() => useTransitionList(1, 2, 3, null), { wrapper });
    expect(result.current.isPending).toBe(true);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("workflowId가 있으면 fetchTransitionList를 호출하고 데이터를 반환한다", async () => {
    const stub = [
      {
        id: "edge-1",
        workflowDefinitionId: 10,
        domainPackVersionId: 3,
        from: "A",
        to: "B",
        label: null,
        toPolicyRef: null,
      },
    ];
    mockedFetch.mockResolvedValue(stub);
    const { result } = renderHook(() => useTransitionList(1, 2, 3, 10), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(stub);
    expect(mockedFetch).toHaveBeenCalledWith(1, 2, 3, 10);
  });

  it("fetch 실패 시 isError=true가 된다", async () => {
    mockedFetch.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => useTransitionList(1, 2, 3, 10), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
