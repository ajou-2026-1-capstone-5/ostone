import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { ApiRequestError } from "@/shared/api";
import { SLOT_ERROR_MESSAGES } from "../messages";

vi.mock("@/shared/api/generated/endpoints/update-slot-controller/update-slot-controller", () => ({
  updateSlot: vi.fn(),
}));

vi.mock("@/shared/api/generated/endpoints/update-slot-status-controller/update-slot-status-controller", () => ({
  updateSlotStatus: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { updateSlot } from "@/shared/api/generated/endpoints/update-slot-controller/update-slot-controller";
import { updateSlotStatus } from "@/shared/api/generated/endpoints/update-slot-status-controller/update-slot-status-controller";
import { toast } from "sonner";
import { useUpdateSlot } from "../useUpdateSlot";
import { useUpdateSlotStatus } from "../useUpdateSlotStatus";

const mockedUpdateSlot = vi.mocked(updateSlot);
const mockedUpdateSlotStatus = vi.mocked(updateSlotStatus);
const slotKeys = {
  list: (...args: number[]) => ["slots", "list", ...args] as const,
  detail: (...args: number[]) => ["slots", "detail", ...args] as const,
};

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

function makeWrapperWithClient() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
  return { wrapper, qc };
}

const params = { workspaceId: 1, packId: 2, versionId: 3, slotId: 4 };

const stubSlot = {
  id: 4,
  domainPackVersionId: 3,
  slotCode: "S001",
  name: "테스트 슬롯",
  description: null,
  dataType: "STRING",
  isSensitive: false,
  validationRuleJson: "{}",
  defaultValueJson: null,
  metaJson: "{}",
  status: "ACTIVE" as const,
  createdAt: "",
  updatedAt: "",
};

describe("useUpdateSlot", () => {
  beforeEach(() => {
    mockedUpdateSlot.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("성공 시 toast.success를 호출한다", async () => {
    mockedUpdateSlot.mockResolvedValue({ data: { ...stubSlot, description: undefined, defaultValueJson: undefined }, status: 200, headers: new Headers() });
    const { result } = renderHook(() => useUpdateSlot(), { wrapper: makeWrapper() });

    act(() => {
      result.current.mutate({ ...params, body: { name: "새 이름" } });
    });

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("슬롯이 수정되었습니다."));
  });

  it("SLOT_NOT_EDITABLE 에러 시 전용 안내 메시지를 toast.error로 표시한다", async () => {
    mockedUpdateSlot.mockRejectedValue(new ApiRequestError(422, "SLOT_NOT_EDITABLE", "수정 불가"));
    const { result } = renderHook(() => useUpdateSlot(), { wrapper: makeWrapper() });

    act(() => {
      result.current.mutate({ ...params, body: { name: "새 이름" } });
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(SLOT_ERROR_MESSAGES.SLOT_NOT_EDITABLE),
    );
  });

  it("네트워크 오류 시 일반 실패 메시지를 toast.error로 표시한다", async () => {
    mockedUpdateSlot.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => useUpdateSlot(), { wrapper: makeWrapper() });

    act(() => {
      result.current.mutate({ ...params, body: { name: "새 이름" } });
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(SLOT_ERROR_MESSAGES.UPDATE_FAILED),
    );
  });
});

describe("useUpdateSlotStatus", () => {
  beforeEach(() => {
    mockedUpdateSlotStatus.mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("성공 시 toast.error를 호출하지 않고 invalidateQueries를 호출한다", async () => {
    mockedUpdateSlotStatus.mockResolvedValue({ data: { ...stubSlot, description: undefined, defaultValueJson: undefined, status: "INACTIVE" }, status: 200, headers: new Headers() });
    const { wrapper, qc } = makeWrapperWithClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useUpdateSlotStatus(), { wrapper });

    act(() => {
      result.current.mutate({ ...params, status: "INACTIVE" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.error).not.toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: slotKeys.detail(params.workspaceId, params.packId, params.versionId, params.slotId),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: slotKeys.list(params.workspaceId, params.packId, params.versionId),
    });
  });

  it("오류 시 STATUS_FAILED 메시지를 toast.error로 표시한다", async () => {
    mockedUpdateSlotStatus.mockRejectedValue(new Error("fail"));
    const { result } = renderHook(() => useUpdateSlotStatus(), { wrapper: makeWrapper() });

    act(() => {
      result.current.mutate({ ...params, status: "INACTIVE" });
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(SLOT_ERROR_MESSAGES.STATUS_FAILED),
    );
  });
});
