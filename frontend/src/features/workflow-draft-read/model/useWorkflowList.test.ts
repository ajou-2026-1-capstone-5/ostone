import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useWorkflowList } from "./useWorkflowList";
import { ApiRequestError } from "../../../shared/api";
import { useListWorkflows } from "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller";

vi.mock(
  "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller",
  () => ({
    useListWorkflows: vi.fn(),
  }),
);

const mockedUseListWorkflows = vi.mocked(useListWorkflows);

const stubWorkflow = {
  id: 1,
  workflowCode: "W001",
  name: "테스트 워크플로우",
  description: null,
  initialState: null,
  terminalStatesJson: "[]",
  createdAt: "",
  updatedAt: "",
};

function mockListQuery(overrides: Partial<ReturnType<typeof useListWorkflows>> = {}) {
  const result = {
    isLoading: false,
    isSuccess: true,
    isError: false,
    error: null,
    data: [stubWorkflow],
    refetch: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
  mockedUseListWorkflows.mockReturnValue(result as unknown as ReturnType<typeof useListWorkflows>);
  return result;
}

describe("useWorkflowList", () => {
  beforeEach(() => {
    mockedUseListWorkflows.mockReset();
  });

  it("초기 상태는 loading이다", () => {
    mockListQuery({ isLoading: true, isSuccess: false, data: undefined });
    const { result } = renderHook(() => useWorkflowList(1, 2, 3));
    expect(result.current.isLoading).toBe(true);
  });

  it("성공 시 ready 상태로 전이되고 데이터를 반환한다", async () => {
    mockListQuery({ data: [stubWorkflow] });
    const { result } = renderHook(() => useWorkflowList(1, 2, 3));

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toEqual([stubWorkflow]);
    expect(mockedUseListWorkflows).toHaveBeenCalledWith(
      1,
      2,
      3,
      undefined,
      expect.objectContaining({
        query: expect.objectContaining({ queryKey: ["workflows", "list", 1, 2, 3] }),
      }),
    );
  });

  it("빈 배열 응답 시 ready 상태로 전이된다", async () => {
    mockListQuery({ data: [] });
    const { result } = renderHook(() => useWorkflowList(1, 2, 3));

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toHaveLength(0);
  });

  it("ApiRequestError 발생 시 error 상태로 전이되고 httpStatus를 포함한다", async () => {
    mockListQuery({
      isSuccess: false,
      isError: true,
      error: new ApiRequestError(403, "FORBIDDEN", "접근 금지"),
      data: undefined,
    });
    const { result } = renderHook(() => useWorkflowList(1, 2, 3));

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBeInstanceOf(ApiRequestError);
    if (result.current.error instanceof ApiRequestError) {
      expect(result.current.error.status).toBe(403);
      expect(result.current.error.code).toBe("FORBIDDEN");
    }
  });

  it("알 수 없는 오류 발생 시 UNKNOWN_ERROR 코드로 error 상태가 된다", async () => {
    mockListQuery({
      isSuccess: false,
      isError: true,
      error: new Error("network fail"),
      data: undefined,
    });
    const { result } = renderHook(() => useWorkflowList(1, 2, 3));

    expect(result.current.isError).toBe(true);
    expect(result.current.error).not.toBeInstanceOf(ApiRequestError);
  });
});
