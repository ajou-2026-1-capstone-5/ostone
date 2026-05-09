import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { useTransitionList } from "./useTransitionList";
import { listTransitions } from "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller";

vi.mock("@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller", () => ({
  listTransitions: vi.fn(),
}));

const mockedListTransitions = vi.mocked(listTransitions);

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useTransitionList", () => {
  beforeEach(() => {
    mockedListTransitions.mockReset();
  });

  it("workflowId=null이면 쿼리가 비활성화되어 fetch를 호출하지 않는다", () => {
    const { result } = renderHook(() => useTransitionList(1, 2, 3, null), { wrapper });
    expect(result.current.isPending).toBe(true);
    expect(mockedListTransitions).not.toHaveBeenCalled();
  });

  it("workflowId가 있으면 listTransitions를 호출하고 데이터를 반환한다", async () => {
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
    mockedListTransitions.mockResolvedValue({
      data: stub as any,
      status: 200,
      headers: new Headers(),
    });
    const { result } = renderHook(() => useTransitionList(1, 2, 3, 10), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(stub);
    expect(mockedListTransitions).toHaveBeenCalledWith(1, 2, 3, 10);
  });

  it("fetch 실패 시 isError=true가 된다", async () => {
    mockedListTransitions.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => useTransitionList(1, 2, 3, 10), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
