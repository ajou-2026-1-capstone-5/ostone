import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useIntentList } from "./useIntentList";
import { ApiRequestError } from "../../../shared/api";
import { useListIntents } from "@/shared/api/generated/endpoints/intent-definition-controller/intent-definition-controller";

vi.mock("@/shared/api/generated/endpoints/intent-definition-controller/intent-definition-controller", () => ({
  useListIntents: vi.fn(),
}));

const mockedUseListIntents = vi.mocked(useListIntents);

const stubIntent = {
  id: 1,
  intentCode: "INTENT_001",
  name: "배송 조회 문의",
  description: null,
  taxonomyLevel: 1,
  parentIntentId: null,
  status: "ACTIVE",
  sourceClusterRef: "{}",
  createdAt: "",
  updatedAt: "",
};

function mockListQuery(overrides: Partial<ReturnType<typeof useListIntents>> = {}) {
  const result = {
    isLoading: false,
    isError: false,
    error: null,
    data: [stubIntent],
    refetch: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
  mockedUseListIntents.mockReturnValue(result as unknown as ReturnType<typeof useListIntents>);
  return result;
}

describe("useIntentList", () => {
  beforeEach(() => {
    mockedUseListIntents.mockReset();
  });

  it("초기 상태는 loading이다", () => {
    mockListQuery({ isLoading: true, data: undefined });
    const { result } = renderHook(() => useIntentList(1, 2, 3));
    expect(result.current.status).toBe("loading");
  });

  it("성공 시 ready 상태로 전이된다", async () => {
    mockListQuery({ data: [stubIntent] });
    const { result } = renderHook(() => useIntentList(1, 2, 3));

    expect(result.current.status).toBe("ready");
    if (result.current.status === "ready") {
      expect(result.current.data).toEqual([stubIntent]);
    }
    expect(mockedUseListIntents).toHaveBeenCalledWith(
      1,
      2,
      3,
      expect.objectContaining({
        query: expect.objectContaining({ queryKey: ["intents", "list", 1, 2, 3] }),
      }),
    );
  });

  it("빈 배열 응답도 ready 상태로 처리한다", async () => {
    mockListQuery({ data: [] });
    const { result } = renderHook(() => useIntentList(1, 2, 3));

    expect(result.current.status).toBe("ready");
    if (result.current.status === "ready") {
      expect(result.current.data).toHaveLength(0);
    }
  });

  it("ApiRequestError 발생 시 error 상태와 httpStatus를 반환한다", async () => {
    mockListQuery({
      isError: true,
      error: new ApiRequestError(403, "FORBIDDEN", "접근 금지"),
      data: undefined,
    });
    const { result } = renderHook(() => useIntentList(1, 2, 3));

    expect(result.current.status).toBe("error");
    if (result.current.status === "error") {
      expect(result.current.httpStatus).toBe(403);
      expect(result.current.code).toBe("FORBIDDEN");
    }
  });

  it("알 수 없는 오류는 UNKNOWN_ERROR로 변환한다", async () => {
    mockListQuery({ isError: true, error: new Error("network fail"), data: undefined });
    const { result } = renderHook(() => useIntentList(1, 2, 3));

    expect(result.current.status).toBe("error");
    if (result.current.status === "error") {
      expect(result.current.code).toBe("UNKNOWN_ERROR");
    }
  });
});
