import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { riskApi } from "@/entities/risk";
import { ApiRequestError } from "@/shared/api";
import { useRiskDetail } from "./useRiskDetail";

vi.mock("@/entities/risk", () => ({
  riskApi: {
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

const mockedDetail = vi.mocked(riskApi.detail);

const stubRisk = {
  id: 4,
  domainPackVersionId: 3,
  riskCode: "RISK_FRAUD",
  name: "사기 위험",
  description: "부정 거래 징후",
  riskLevel: "HIGH" as const,
  triggerConditionJson: '{"channel":"web"}',
  handlingActionJson: '{"type":"MANUAL_REVIEW"}',
  evidenceJson: "[]",
  metaJson: "{}",
  status: "ACTIVE" as const,
  createdAt: "2026-04-16T10:00:00Z",
  updatedAt: "2026-04-16T10:00:00Z",
};

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useRiskDetail", () => {
  beforeEach(() => {
    mockedDetail.mockReset();
  });

  it("riskId가 없으면 idle 상태를 반환한다", () => {
    const { result } = renderHook(() => useRiskDetail(1, 2, 3, null), {
      wrapper: makeWrapper(),
    });

    expect(result.current.status).toBe("idle");
    expect(mockedDetail).not.toHaveBeenCalled();
  });

  it("성공 시 ready 상태와 상세 데이터를 반환한다", async () => {
    mockedDetail.mockResolvedValue(stubRisk);
    const { result } = renderHook(() => useRiskDetail(1, 2, 3, 4), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.status).toBe("ready"));

    if (result.current.status === "ready") {
      expect(result.current.data.riskCode).toBe("RISK_FRAUD");
    }
  });

  it("ApiRequestError를 error 상태로 변환한다", async () => {
    mockedDetail.mockRejectedValue(new ApiRequestError(404, "RISK_DEFINITION_NOT_FOUND", "없음"));
    const { result } = renderHook(() => useRiskDetail(1, 2, 3, 404), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.status).toBe("error"));

    if (result.current.status === "error") {
      expect(result.current.httpStatus).toBe(404);
      expect(result.current.code).toBe("RISK_DEFINITION_NOT_FOUND");
    }
  });

  it("retryKey가 증가한 뒤 riskId가 바뀌어도 새 상세 조회를 한 번만 호출한다", async () => {
    mockedDetail.mockImplementation(async (_workspaceId, _packId, _versionId, riskId) => ({
      ...stubRisk,
      id: riskId,
    }));

    const { result, rerender } = renderHook(
      ({ retryKey, riskId }) => useRiskDetail(1, 2, 3, riskId, retryKey),
      {
        wrapper: makeWrapper(),
        initialProps: { retryKey: 0, riskId: 4 },
      },
    );

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(mockedDetail).toHaveBeenCalledTimes(1);
    expect(mockedDetail).toHaveBeenLastCalledWith(1, 2, 3, 4);

    rerender({ retryKey: 1, riskId: 4 });

    await waitFor(() => expect(mockedDetail).toHaveBeenCalledTimes(2));
    expect(mockedDetail).toHaveBeenLastCalledWith(1, 2, 3, 4);

    rerender({ retryKey: 1, riskId: 5 });

    await waitFor(() => expect(mockedDetail).toHaveBeenCalledTimes(3));
    expect(mockedDetail).toHaveBeenLastCalledWith(1, 2, 3, 5);
  });
});
