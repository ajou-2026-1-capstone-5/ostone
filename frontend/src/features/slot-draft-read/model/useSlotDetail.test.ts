import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSlotDetail } from "./useSlotDetail";
import { ApiRequestError } from "@/shared/api";
import { getSlot } from "@/shared/api/generated/endpoints/slot-definition-controller/slot-definition-controller";
import type { SlotDefinitionResponse } from "@/shared/api/generated/zod";

vi.mock("@/shared/api/generated/endpoints/slot-definition-controller/slot-definition-controller", () => ({
  getSlot: vi.fn(),
}));

const mockedGetSlot = vi.mocked(getSlot);
const slotDetailKey = (...args: number[]) => ["slots", "detail", ...args] as const;

function makeWrapperWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { wrapper, queryClient };
}

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

describe("useSlotDetail", () => {
  beforeEach(() => {
    mockedGetSlot.mockReset();
  });

  it("slotId가 null이면 idle 상태다", () => {
    const { wrapper } = makeWrapperWithClient();
    const { result } = renderHook(() => useSlotDetail(1, 2, 3, null), { wrapper });
    expect(result.current.status).toBe("idle");
    expect(mockedGetSlot).not.toHaveBeenCalled();
  });

  it("slotId가 주어지면 loading 상태로 시작한다", () => {
    mockedGetSlot.mockReturnValue(new Promise(() => {}));
    const { wrapper } = makeWrapperWithClient();
    const { result } = renderHook(() => useSlotDetail(1, 2, 3, 10), { wrapper });
    expect(result.current.status).toBe("loading");
  });

  it("성공 시 ready 상태로 전이되고 validationRuleJson을 포함한다", async () => {
    mockedGetSlot.mockResolvedValue({ data: stubDetail, status: 200, headers: new Headers() });
    const { wrapper, queryClient } = makeWrapperWithClient();
    const { result } = renderHook(() => useSlotDetail(1, 2, 3, 10), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    if (result.current.status === "ready") {
      expect(result.current.data).toEqual(stubDetail);
      expect(result.current.data.validationRuleJson).toBe("{}");
    }
    expect(queryClient.getQueryData<SlotDefinitionResponse>(slotDetailKey(1, 2, 3, 10))).toEqual(
      stubDetail,
    );
  });

  it("404 (SLOT_DEFINITION_NOT_FOUND) 에러 시 httpStatus를 포함한 error 상태가 된다", async () => {
    mockedGetSlot.mockRejectedValue(
      new ApiRequestError(404, "SLOT_DEFINITION_NOT_FOUND", "슬롯을 찾을 수 없습니다."),
    );
    const { wrapper } = makeWrapperWithClient();
    const { result } = renderHook(() => useSlotDetail(1, 2, 3, 99), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("error"));
    if (result.current.status === "error") {
      expect(result.current.httpStatus).toBe(404);
      expect(result.current.code).toBe("SLOT_DEFINITION_NOT_FOUND");
    }
  });

  it("ApiRequestError (403) 발생 시 error 상태가 된다", async () => {
    mockedGetSlot.mockRejectedValue(new ApiRequestError(403, "FORBIDDEN", "접근 금지"));
    const { wrapper } = makeWrapperWithClient();
    const { result } = renderHook(() => useSlotDetail(1, 2, 3, 5), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("error"));
    if (result.current.status === "error") {
      expect(result.current.httpStatus).toBe(403);
      expect(result.current.code).toBe("FORBIDDEN");
    }
  });

  it("retryKey가 변경되면 getSlot이 다시 호출된다", async () => {
    mockedGetSlot.mockResolvedValue({ data: stubDetail, status: 200, headers: new Headers() });
    const { wrapper } = makeWrapperWithClient();
    const { result, rerender } = renderHook(
      ({ key }: { key: number }) => useSlotDetail(1, 2, 3, 10, key),
      { initialProps: { key: 0 }, wrapper },
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(mockedGetSlot).toHaveBeenCalledTimes(1);

    rerender({ key: 1 });
    await waitFor(() => expect(mockedGetSlot).toHaveBeenCalledTimes(2));
  });
});
