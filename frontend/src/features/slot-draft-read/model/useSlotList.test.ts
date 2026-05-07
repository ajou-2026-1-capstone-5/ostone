import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSlotList } from "./useSlotList";
import { ApiRequestError } from "@/shared/api";
import { listSlots } from "@/shared/api/generated/endpoints/slot-definition-controller/slot-definition-controller";

vi.mock("@/shared/api/generated/endpoints/slot-definition-controller/slot-definition-controller", () => ({
  listSlots: vi.fn(),
}));

const mockedListSlots = vi.mocked(listSlots);

const stubSlot = {
  id: 1,
  domainPackVersionId: 10,
  slotCode: "SLOT_001",
  name: "배송 주소",
  description: null,
  dataType: "STRING",
  isSensitive: false,
  status: "ACTIVE" as const,
  createdAt: "",
  updatedAt: "",
};

describe("useSlotList", () => {
  beforeEach(() => {
    mockedListSlots.mockReset();
  });

  it("초기 상태는 loading이다", () => {
    mockedListSlots.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useSlotList(1, 2, 3));
    expect(result.current.status).toBe("loading");
  });

  it("성공 시 ready 상태로 전이된다", async () => {
    mockedListSlots.mockResolvedValue({ data: [stubSlot], status: 200, headers: new Headers() });
    const { result } = renderHook(() => useSlotList(1, 2, 3));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    if (result.current.status === "ready") {
      expect(result.current.data).toEqual([stubSlot]);
    }
  });

  it("빈 배열 응답도 ready 상태로 처리한다", async () => {
    mockedListSlots.mockResolvedValue({ data: [], status: 200, headers: new Headers() });
    const { result } = renderHook(() => useSlotList(1, 2, 3));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    if (result.current.status === "ready") {
      expect(result.current.data).toHaveLength(0);
    }
  });

  it("ApiRequestError 발생 시 error 상태와 httpStatus를 반환한다", async () => {
    mockedListSlots.mockRejectedValue(new ApiRequestError(403, "FORBIDDEN", "접근 금지"));
    const { result } = renderHook(() => useSlotList(1, 2, 3));
    await waitFor(() => expect(result.current.status).toBe("error"));
    if (result.current.status === "error") {
      expect(result.current.httpStatus).toBe(403);
      expect(result.current.code).toBe("FORBIDDEN");
    }
  });

  it("알 수 없는 오류는 UNKNOWN_ERROR로 변환한다", async () => {
    mockedListSlots.mockRejectedValue(new Error("network fail"));
    const { result } = renderHook(() => useSlotList(1, 2, 3));
    await waitFor(() => expect(result.current.status).toBe("error"));
    if (result.current.status === "error") {
      expect(result.current.code).toBe("UNKNOWN_ERROR");
    }
  });
});
