import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTransitionList } from "./useTransitionList";
import { useListTransitions } from "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller";

vi.mock(
  "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller",
  () => ({
    useListTransitions: vi.fn(),
  }),
);

const mockedUseListTransitions = vi.mocked(useListTransitions);

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

function mockTransitionQuery(overrides: Partial<ReturnType<typeof useListTransitions>> = {}) {
  const result = {
    isPending: false,
    isSuccess: true,
    isError: false,
    error: null,
    data: stub,
    refetch: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
  mockedUseListTransitions.mockReturnValue(
    result as unknown as ReturnType<typeof useListTransitions>,
  );
  return result;
}

describe("useTransitionList", () => {
  beforeEach(() => {
    mockedUseListTransitions.mockReset();
  });

  it("workflowId=null이면 쿼리가 비활성화되어 fetch를 호출하지 않는다", () => {
    mockTransitionQuery({ isPending: true, isSuccess: false, data: undefined });
    const { result } = renderHook(() => useTransitionList(1, 2, 3, null));

    expect(result.current.isPending).toBe(true);
    expect(mockedUseListTransitions).toHaveBeenCalledWith(
      1,
      2,
      3,
      -1,
      expect.objectContaining({
        query: expect.objectContaining({
          enabled: false,
          queryKey: ["workflows", "transitions", 1, 2, 3, -1],
        }),
      }),
    );
  });

  it("workflowId가 있으면 listTransitions를 호출하고 데이터를 반환한다", async () => {
    mockTransitionQuery({ data: stub });
    const { result } = renderHook(() => useTransitionList(1, 2, 3, 10));

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toEqual(stub);
    expect(mockedUseListTransitions).toHaveBeenCalledWith(
      1,
      2,
      3,
      10,
      expect.objectContaining({
        query: expect.objectContaining({
          enabled: true,
          queryKey: ["workflows", "transitions", 1, 2, 3, 10],
        }),
      }),
    );
  });

  it("fetch 실패 시 isError=true가 된다", async () => {
    mockTransitionQuery({
      isSuccess: false,
      isError: true,
      error: new Error("network error"),
      data: undefined,
    });
    const { result } = renderHook(() => useTransitionList(1, 2, 3, 10));

    expect(result.current.isError).toBe(true);
  });
});
