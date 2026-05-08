import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSlotList } from "./useSlotList";
import { ApiRequestError } from "@/shared/api";
import { listSlots } from "@/shared/api/generated/endpoints/slot-definition-controller/slot-definition-controller";
import type { SlotDefinitionSummary } from "@/shared/api/generated/zod";

vi.mock("@/shared/api/generated/endpoints/slot-definition-controller/slot-definition-controller", () => ({
  listSlots: vi.fn(),
}));

const mockedListSlots = vi.mocked(listSlots);
const slotListKey = (...args: number[]) => ["slots", "list", ...args] as const;

function makeWrapperWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { wrapper, queryClient };
}

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

describe("useSlotList", () => {
  beforeEach(() => {
    mockedListSlots.mockReset();
  });

  it("초기 상태는 loading이다", () => {
    mockedListSlots.mockReturnValue(new Promise(() => {}));
    const { wrapper } = makeWrapperWithClient();
    const { result } = renderHook(() => useSlotList(1, 2, 3), { wrapper });
    expect(result.current.status).toBe("loading");
  });

  it("성공 시 ready 상태로 전이된다", async () => {
    mockedListSlots.mockResolvedValue({ data: [stubSlot], status: 200, headers: new Headers() });
    const { wrapper, queryClient } = makeWrapperWithClient();
    const { result } = renderHook(() => useSlotList(1, 2, 3), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    if (result.current.status === "ready") {
      expect(result.current.data).toEqual([stubSlot]);
    }
    expect(queryClient.getQueryData<SlotDefinitionSummary[]>(slotListKey(1, 2, 3))).toEqual([
      stubSlot,
    ]);
  });

  it("빈 배열 응답도 ready 상태로 처리한다", async () => {
    mockedListSlots.mockResolvedValue({ data: [], status: 200, headers: new Headers() });
    const { wrapper } = makeWrapperWithClient();
    const { result } = renderHook(() => useSlotList(1, 2, 3), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    if (result.current.status === "ready") {
      expect(result.current.data).toHaveLength(0);
    }
  });

  it("ApiRequestError 발생 시 error 상태와 httpStatus를 반환한다", async () => {
    mockedListSlots.mockRejectedValue(new ApiRequestError(403, "FORBIDDEN", "접근 금지"));
    const { wrapper } = makeWrapperWithClient();
    const { result } = renderHook(() => useSlotList(1, 2, 3), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("error"));
    if (result.current.status === "error") {
      expect(result.current.httpStatus).toBe(403);
      expect(result.current.code).toBe("FORBIDDEN");
    }
  });

  it("알 수 없는 오류는 UNKNOWN_ERROR로 변환한다", async () => {
    mockedListSlots.mockRejectedValue(new Error("network fail"));
    const { wrapper } = makeWrapperWithClient();
    const { result } = renderHook(() => useSlotList(1, 2, 3), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("error"));
    if (result.current.status === "error") {
      expect(result.current.code).toBe("UNKNOWN_ERROR");
    }
  });
});
