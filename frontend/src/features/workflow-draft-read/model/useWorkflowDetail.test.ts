import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useWorkflowDetail } from "./useWorkflowDetail";
import { ApiRequestError } from "../../../shared/api";
import { useGetWorkflow } from "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller";

vi.mock(
  "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller",
  () => ({
    useGetWorkflow: vi.fn(),
  }),
);

const mockedUseGetWorkflow = vi.mocked(useGetWorkflow);

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

function mockDetailQuery(overrides: Partial<ReturnType<typeof useGetWorkflow>> = {}) {
  const result = {
    fetchStatus: "idle",
    isLoading: false,
    isSuccess: true,
    isError: false,
    error: null,
    data: stubDetail,
    refetch: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
  mockedUseGetWorkflow.mockReturnValue(result as unknown as ReturnType<typeof useGetWorkflow>);
  return result;
}

describe("useWorkflowDetail", () => {
  beforeEach(() => {
    mockedUseGetWorkflow.mockReset();
  });

  it("workflowId가 null이면 idle 상태다", () => {
    mockDetailQuery({ data: undefined, isSuccess: false });
    const { result } = renderHook(() => useWorkflowDetail(1, 2, 3, null));

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
    expect(mockedUseGetWorkflow).toHaveBeenCalledWith(
      1,
      2,
      3,
      -1,
      expect.objectContaining({
        query: expect.objectContaining({
          enabled: false,
          queryKey: ["workflows", "detail", 1, 2, 3, -1],
        }),
      }),
    );
  });

  it("workflowId가 주어지면 loading 상태로 시작한다", () => {
    mockDetailQuery({ isLoading: true, isSuccess: false, data: undefined });
    const { result } = renderHook(() => useWorkflowDetail(1, 2, 3, 10));
    expect(result.current.isLoading).toBe(true);
  });

  it("성공 시 ready 상태로 전이된다", async () => {
    mockDetailQuery({ data: stubDetail });
    const { result } = renderHook(() => useWorkflowDetail(1, 2, 3, 10));

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toEqual(stubDetail);
    expect(mockedUseGetWorkflow).toHaveBeenCalledWith(
      1,
      2,
      3,
      10,
      expect.objectContaining({
        query: expect.objectContaining({
          enabled: true,
          queryKey: ["workflows", "detail", 1, 2, 3, 10],
        }),
      }),
    );
  });

  it("404 에러 시 httpStatus 404를 포함한 error 상태가 된다", async () => {
    mockDetailQuery({
      isSuccess: false,
      isError: true,
      error: new ApiRequestError(404, "NOT_FOUND", "없음"),
      data: undefined,
    });
    const { result } = renderHook(() => useWorkflowDetail(1, 2, 3, 99));

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBeInstanceOf(ApiRequestError);
    if (result.current.error instanceof ApiRequestError) {
      expect(result.current.error.status).toBe(404);
      expect(result.current.error.code).toBe("NOT_FOUND");
    }
  });

  it("알 수 없는 오류 시 UNKNOWN_ERROR 코드가 된다", async () => {
    mockDetailQuery({
      isSuccess: false,
      isError: true,
      error: new Error("unexpected"),
      data: undefined,
    });
    const { result } = renderHook(() => useWorkflowDetail(1, 2, 3, 5));

    expect(result.current.isError).toBe(true);
    expect(result.current.error).not.toBeInstanceOf(ApiRequestError);
  });
});
