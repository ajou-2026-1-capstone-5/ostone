import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSlotDetail } from "./useSlotDetail";
import { ApiRequestError } from "@/shared/api";
import { useGetSlot } from "@/shared/api/generated/endpoints/slot-definition-controller/slot-definition-controller";

vi.mock(
  "@/shared/api/generated/endpoints/slot-definition-controller/slot-definition-controller",
  () => ({
    useGetSlot: vi.fn(),
  }),
);

const mockedUseGetSlot = vi.mocked(useGetSlot);

const stubDetail = {
  id: 10,
  domainPackVersionId: 10,
  slotCode: "SLOT_001",
  name: "배송 주소",
  description: undefined,
  dataType: "STRING",
  isSensitive: false,
  validationRuleJson: "{}",
  defaultValueJson: undefined,
  metaJson: "{}",
  status: "ACTIVE" as const,
  createdAt: "",
  updatedAt: "",
};

function mockDetailQuery(overrides: Partial<ReturnType<typeof useGetSlot>> = {}) {
  const result = {
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    data: stubDetail,
    refetch: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
  mockedUseGetSlot.mockReturnValue(result as unknown as ReturnType<typeof useGetSlot>);
  return result;
}

describe("useSlotDetail", () => {
  beforeEach(() => {
    mockedUseGetSlot.mockReset();
  });

  it("slotId가 null이면 idle 상태다", () => {
    mockDetailQuery({ data: undefined });
    const { result } = renderHook(() => useSlotDetail(1, 2, 3, null));

    expect(result.current.status).toBe("idle");
    expect(mockedUseGetSlot).toHaveBeenCalledWith(
      1,
      2,
      3,
      -1,
      expect.objectContaining({
        query: expect.objectContaining({
          enabled: false,
          queryKey: ["slots", "detail", 1, 2, 3, -1],
        }),
      }),
    );
  });

  it("slotId가 주어지면 loading 상태로 시작한다", () => {
    mockDetailQuery({ isLoading: true, data: undefined });
    const { result } = renderHook(() => useSlotDetail(1, 2, 3, 10));
    expect(result.current.status).toBe("loading");
  });

  it("성공 시 ready 상태로 전이되고 validationRuleJson을 포함한다", async () => {
    mockDetailQuery({ data: stubDetail });
    const { result } = renderHook(() => useSlotDetail(1, 2, 3, 10));

    expect(result.current.status).toBe("ready");
    if (result.current.status === "ready") {
      expect(result.current.data).toEqual(stubDetail);
      expect(result.current.data.validationRuleJson).toBe("{}");
    }
    expect(mockedUseGetSlot).toHaveBeenCalledWith(
      1,
      2,
      3,
      10,
      expect.objectContaining({
        query: expect.objectContaining({
          enabled: true,
          queryKey: ["slots", "detail", 1, 2, 3, 10],
        }),
      }),
    );
  });

  it("404 (SLOT_DEFINITION_NOT_FOUND) 에러 시 httpStatus를 포함한 error 상태가 된다", async () => {
    mockDetailQuery({
      isError: true,
      error: new ApiRequestError(404, "SLOT_DEFINITION_NOT_FOUND", "슬롯을 찾을 수 없습니다."),
      data: undefined,
    });
    const { result } = renderHook(() => useSlotDetail(1, 2, 3, 99));

    expect(result.current.status).toBe("error");
    if (result.current.status === "error") {
      expect(result.current.httpStatus).toBe(404);
      expect(result.current.code).toBe("SLOT_DEFINITION_NOT_FOUND");
    }
  });

  it("ApiRequestError (403) 발생 시 error 상태가 된다", async () => {
    mockDetailQuery({
      isError: true,
      error: new ApiRequestError(403, "FORBIDDEN", "접근 금지"),
      data: undefined,
    });
    const { result } = renderHook(() => useSlotDetail(1, 2, 3, 5));

    expect(result.current.status).toBe("error");
    if (result.current.status === "error") {
      expect(result.current.httpStatus).toBe(403);
      expect(result.current.code).toBe("FORBIDDEN");
    }
  });

  it("retryKey가 변경되면 refetch를 호출한다", async () => {
    const refetch = vi.fn().mockResolvedValue({});
    mockDetailQuery({ refetch });
    const { result, rerender } = renderHook(
      ({ key }: { key: number }) => useSlotDetail(1, 2, 3, 10, key),
      { initialProps: { key: 0 } },
    );
    expect(result.current.status).toBe("ready");

    rerender({ key: 1 });
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
  });
});
