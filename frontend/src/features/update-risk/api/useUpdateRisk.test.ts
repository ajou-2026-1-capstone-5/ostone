import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { riskApi } from "@/entities/risk";
import { ApiRequestError } from "@/shared/api";
import { toast } from "sonner";
import { RISK_ERROR_MESSAGES } from "./messages";
import { useUpdateRisk } from "./useUpdateRisk";

vi.mock("@/entities/risk", () => ({
  riskApi: {
    update: vi.fn(),
    updateStatus: vi.fn(),
    list: vi.fn(),
    detail: vi.fn(),
  },
  riskKeys: {
    all: ["risks"],
    lists: () => ["risks", "list"],
    list: (...args: number[]) => ["risks", "list", ...args],
    detail: (...args: number[]) => ["risks", "detail", ...args],
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockedUpdate = vi.mocked(riskApi.update);
const mockedUpdateStatus = vi.mocked(riskApi.updateStatus);

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

const params = { workspaceId: 1, packId: 2, versionId: 3, riskId: 4 };

const stubRisk = {
  id: 4,
  domainPackVersionId: 3,
  riskCode: "RISK_FRAUD",
  name: "사기 위험",
  description: null,
  riskLevel: "HIGH",
  triggerConditionJson: "{}",
  handlingActionJson: "{}",
  evidenceJson: "[]",
  metaJson: "{}",
  status: "ACTIVE",
  createdAt: "2026-04-16T10:00:00Z",
  updatedAt: "2026-04-16T10:00:00Z",
} as const;

describe("useUpdateRisk", () => {
  beforeEach(() => {
    mockedUpdate.mockReset();
    mockedUpdateStatus.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("성공 시 toast.success를 호출한다", async () => {
    mockedUpdate.mockResolvedValue({ ...stubRisk, name: "새 위험요소" });
    const { result } = renderHook(() => useUpdateRisk(), { wrapper: makeWrapper() });

    act(() => {
      result.current.mutate({
        ...params,
        body: { name: "새 위험요소", riskLevel: "HIGH" },
      });
    });

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("위험요소가 수정되었습니다."));
  });

  it("RISK_NOT_EDITABLE 에러 시 전용 안내 메시지를 표시한다", async () => {
    mockedUpdate.mockRejectedValue(new ApiRequestError(400, "RISK_NOT_EDITABLE", "수정 불가"));
    const { result } = renderHook(() => useUpdateRisk(), { wrapper: makeWrapper() });

    act(() => {
      result.current.mutate({
        ...params,
        body: { name: "새 위험요소", riskLevel: "HIGH" },
      });
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(RISK_ERROR_MESSAGES.RISK_NOT_EDITABLE),
    );
  });

  it("VALIDATION_ERROR 에러 시 검증 안내 메시지를 표시한다", async () => {
    mockedUpdate.mockRejectedValue(new ApiRequestError(400, "VALIDATION_ERROR", "검증 실패"));
    const { result } = renderHook(() => useUpdateRisk(), { wrapper: makeWrapper() });

    act(() => {
      result.current.mutate({
        ...params,
        body: { name: "새 위험요소", riskLevel: "HIGH" },
      });
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(RISK_ERROR_MESSAGES.VALIDATION_ERROR),
    );
  });
});
