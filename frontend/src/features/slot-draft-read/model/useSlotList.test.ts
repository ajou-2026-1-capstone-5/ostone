import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSlotList } from "./useSlotList";
import { ApiRequestError } from "@/shared/api";
import { useListSlots } from "@/shared/api/generated/endpoints/slot-definition-controller/slot-definition-controller";

vi.mock(
  "@/shared/api/generated/endpoints/slot-definition-controller/slot-definition-controller",
  () => ({
    useListSlots: vi.fn(),
  }),
);

const mockedUseListSlots = vi.mocked(useListSlots);

const stubSlot = {
  id: 1,
  domainPackVersionId: 10,
  slotCode: "SLOT_001",
  name: "배송 주소",
  description: undefined,
  dataType: "STRING",
  isSensitive: false,
  status: "ACTIVE" as const,
  createdAt: "",
  updatedAt: "",
};

function mockListQuery(overrides: Partial<ReturnType<typeof useListSlots>> = {}) {
  const result = {
    isLoading: false,
    isError: false,
    error: null,
    data: [stubSlot],
    refetch: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
  mockedUseListSlots.mockReturnValue(result as unknown as ReturnType<typeof useListSlots>);
  return result;
}

describe("useSlotList", () => {
  beforeEach(() => {
    mockedUseListSlots.mockReset();
  });

  it("초기 상태는 loading이다", () => {
    mockListQuery({ isLoading: true, data: undefined });
    const { result } = renderHook(() => useSlotList(1, 2, 3));
    expect(result.current.status).toBe("loading");
  });

  it("성공 시 ready 상태로 전이된다", async () => {
    mockListQuery({ data: [stubSlot] });
    const { result } = renderHook(() => useSlotList(1, 2, 3));

    expect(result.current.status).toBe("ready");
    if (result.current.status === "ready") {
      expect(result.current.data).toEqual([stubSlot]);
    }
    expect(mockedUseListSlots).toHaveBeenCalledWith(
      1,
      2,
      3,
      expect.objectContaining({
        query: expect.objectContaining({ queryKey: ["slots", "list", 1, 2, 3] }),
      }),
    );
  });

  it("빈 배열 응답도 ready 상태로 처리한다", async () => {
    mockListQuery({ data: [] });
    const { result } = renderHook(() => useSlotList(1, 2, 3));

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
    const { result } = renderHook(() => useSlotList(1, 2, 3));

    expect(result.current.status).toBe("error");
    if (result.current.status === "error") {
      expect(result.current.httpStatus).toBe(403);
      expect(result.current.code).toBe("FORBIDDEN");
    }
  });

  it("알 수 없는 오류는 UNKNOWN_ERROR로 변환한다", async () => {
    mockListQuery({ isError: true, error: new Error("network fail"), data: undefined });
    const { result } = renderHook(() => useSlotList(1, 2, 3));

    expect(result.current.status).toBe("error");
    if (result.current.status === "error") {
      expect(result.current.code).toBe("UNKNOWN_ERROR");
    }
  });
});
