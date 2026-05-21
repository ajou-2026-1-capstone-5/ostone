import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRisk } from "@/shared/api/generated/endpoints/risk-definition-controller/risk-definition-controller";
import { ApiRequestError } from "@/shared/api";
import { useRiskDetail } from "./useRiskDetail";

vi.mock(
  "@/shared/api/generated/endpoints/risk-definition-controller/risk-definition-controller",
  () => ({
    getRisk: vi.fn(),
  }),
);

const mockedGetRisk = vi.mocked(getRisk);

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
    mockedGetRisk.mockReset();
  });

  it("riskId가 없으면 idle 상태를 반환한다", () => {
    const { result } = renderHook(() => useRiskDetail(1, 2, 3, null), {
      wrapper: makeWrapper(),
    });

    expect(result.current.status).toBe("idle");
    expect(mockedGetRisk).not.toHaveBeenCalled();
  });

  it("성공 시 ready 상태와 상세 데이터를 반환한다", async () => {
    mockedGetRisk.mockResolvedValue({ data: stubRisk, status: 200, headers: new Headers() });
    const { result } = renderHook(() => useRiskDetail(1, 2, 3, 4), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.status).toBe("ready"));

    if (result.current.status === "ready") {
      expect(result.current.data.riskCode).toBe("RISK_FRAUD");
    }
  });

  it("ApiRequestError를 error 상태로 변환한다", async () => {
    mockedGetRisk.mockRejectedValue(new ApiRequestError(404, "RISK_DEFINITION_NOT_FOUND", "없음"));
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
    mockedGetRisk.mockImplementation(async (_workspaceId, _packId, _versionId, riskId) => ({
      data: {
        ...stubRisk,
        id: riskId,
      },
      status: 200,
      headers: new Headers(),
    }));

    const { result, rerender } = renderHook(
      ({ retryKey, riskId }) => useRiskDetail(1, 2, 3, riskId, retryKey),
      {
        wrapper: makeWrapper(),
        initialProps: { retryKey: 0, riskId: 4 },
      },
    );

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(mockedGetRisk).toHaveBeenCalledTimes(1);
    expect(mockedGetRisk).toHaveBeenLastCalledWith(1, 2, 3, 4);

    rerender({ retryKey: 1, riskId: 4 });

    await waitFor(() => expect(mockedGetRisk).toHaveBeenCalledTimes(2));
    expect(mockedGetRisk).toHaveBeenLastCalledWith(1, 2, 3, 4);

    rerender({ retryKey: 1, riskId: 5 });

    await waitFor(() => expect(mockedGetRisk).toHaveBeenCalledTimes(3));
    expect(mockedGetRisk).toHaveBeenLastCalledWith(1, 2, 3, 5);
  });
});
