import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useIntentDetail } from "./useIntentDetail";
import { ApiRequestError } from "../../../shared/api";
import { useGetIntent } from "@/shared/api/generated/endpoints/intent-definition-controller/intent-definition-controller";

vi.mock("@/shared/api/generated/endpoints/intent-definition-controller/intent-definition-controller", () => ({
  useGetIntent: vi.fn(),
}));

const mockedUseGetIntent = vi.mocked(useGetIntent);

const stubDetail = {
  id: 10,
  intentCode: "INTENT_001",
  name: "배송 조회 문의",
  description: null,
  taxonomyLevel: 1,
  parentIntentId: null,
  status: "ACTIVE",
  sourceClusterRef: "{}",
  entryConditionJson: "{}",
  evidenceJson: "[]",
  metaJson: "{}",
  createdAt: "",
  updatedAt: "",
};

function mockDetailQuery(overrides: Partial<ReturnType<typeof useGetIntent>> = {}) {
  const result = {
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    data: stubDetail,
    refetch: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
  mockedUseGetIntent.mockReturnValue(result as unknown as ReturnType<typeof useGetIntent>);
  return result;
}

describe("useIntentDetail", () => {
  beforeEach(() => {
    mockedUseGetIntent.mockReset();
  });

  it("intentId가 null이면 idle 상태다", () => {
    mockDetailQuery({ data: undefined });
    const { result } = renderHook(() => useIntentDetail(1, 2, 3, null));

    expect(result.current.status).toBe("idle");
    expect(mockedUseGetIntent).toHaveBeenCalledWith(
      1,
      2,
      3,
      -1,
      expect.objectContaining({
        query: expect.objectContaining({ enabled: false, queryKey: ["intents", "detail", 1, 2, 3, -1] }),
      }),
    );
  });

  it("intentId가 주어지면 loading 상태로 시작한다", () => {
    mockDetailQuery({ isLoading: true, data: undefined });
    const { result } = renderHook(() => useIntentDetail(1, 2, 3, 10));
    expect(result.current.status).toBe("loading");
  });

  it("성공 시 ready 상태로 전이된다", async () => {
    mockDetailQuery({ data: stubDetail });
    const { result } = renderHook(() => useIntentDetail(1, 2, 3, 10));

    expect(result.current.status).toBe("ready");
    if (result.current.status === "ready") {
      expect(result.current.data).toEqual(stubDetail);
    }
  });

  it("404 에러 시 httpStatus를 포함한 error 상태가 된다", async () => {
    mockDetailQuery({
      isError: true,
      error: new ApiRequestError(404, "NOT_FOUND", "없음"),
      data: undefined,
    });
    const { result } = renderHook(() => useIntentDetail(1, 2, 3, 99));

    expect(result.current.status).toBe("error");
    if (result.current.status === "error") {
      expect(result.current.httpStatus).toBe(404);
      expect(result.current.code).toBe("NOT_FOUND");
    }
  });

  it("알 수 없는 오류 시 UNKNOWN_ERROR가 된다", async () => {
    mockDetailQuery({ isError: true, error: new Error("unexpected"), data: undefined });
    const { result } = renderHook(() => useIntentDetail(1, 2, 3, 5));

    expect(result.current.status).toBe("error");
    if (result.current.status === "error") {
      expect(result.current.code).toBe("UNKNOWN_ERROR");
    }
  });
});
