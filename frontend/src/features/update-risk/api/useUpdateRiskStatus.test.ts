import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RiskDefinition, RiskSummary } from "@/entities/risk";
import { ApiRequestError } from "@/shared/api";
import { toast } from "sonner";
import { RISK_ERROR_MESSAGES } from "./messages";
import { useUpdateRiskStatus } from "./useUpdateRiskStatus";

vi.mock(
  "@/shared/api/generated/endpoints/update-risk-status-controller/update-risk-status-controller",
  () => ({
    updateRiskStatus: vi.fn(),
  }),
);

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { updateRiskStatus } from "@/shared/api/generated/endpoints/update-risk-status-controller/update-risk-status-controller";

const mockedUpdateRiskStatus = vi.mocked(updateRiskStatus);
const riskKeys = {
  list: (...args: number[]) => ["risk", "list", ...args] as const,
  detail: (...args: number[]) => ["risk", "detail", ...args] as const,
};

function makeWrapperWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { wrapper, queryClient };
}

const params = { workspaceId: 1, packId: 2, versionId: 3, riskId: 4 };

const stubRisk: RiskDefinition = {
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
};

describe("useUpdateRiskStatus", () => {
  beforeEach(() => {
    mockedUpdateRiskStatus.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("성공 시 detail/list query cache를 갱신한다", async () => {
    const updatedRisk: RiskDefinition = { ...stubRisk, status: "INACTIVE" };
    mockedUpdateRiskStatus.mockResolvedValue({
      data: updatedRisk,
      status: 200,
      headers: new Headers(),
    });
    const { wrapper, queryClient } = makeWrapperWithClient();
    const detailKey = riskKeys.detail(
      params.workspaceId,
      params.packId,
      params.versionId,
      params.riskId,
    );
    const listKey = riskKeys.list(params.workspaceId, params.packId, params.versionId);
    queryClient.setQueryData<RiskDefinition>(detailKey, stubRisk);
    queryClient.setQueryData<RiskSummary[]>(listKey, [stubRisk]);

    const { result } = renderHook(() => useUpdateRiskStatus(), { wrapper });

    act(() => {
      result.current.mutate({ ...params, status: "INACTIVE" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData<RiskDefinition>(detailKey)?.status).toBe("INACTIVE");
    expect(queryClient.getQueryData<RiskSummary[]>(listKey)?.[0]?.status).toBe("INACTIVE");
  });

  it("성공 시 raw API response 형태로 저장된 목록 캐시 상태도 갱신한다", async () => {
    const updatedRisk: RiskDefinition = {
      ...stubRisk,
      status: "INACTIVE",
      updatedAt: "2026-04-17T10:00:00Z",
    };
    mockedUpdateRiskStatus.mockResolvedValue({
      data: updatedRisk,
      status: 200,
      headers: new Headers(),
    });
    const { wrapper, queryClient } = makeWrapperWithClient();
    const listKey = riskKeys.list(params.workspaceId, params.packId, params.versionId);
    queryClient.setQueryData(listKey, {
      data: [stubRisk],
      status: 200,
    });

    const { result } = renderHook(() => useUpdateRiskStatus(), { wrapper });

    act(() => {
      result.current.mutate({ ...params, status: "INACTIVE" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(listKey)).toEqual({
      data: [
        expect.objectContaining({
          id: 4,
          status: "INACTIVE",
          updatedAt: "2026-04-17T10:00:00Z",
        }),
      ],
      status: 200,
    });
  });

  it("상태 변경 응답 data가 없으면 rollback 후 실패 메시지를 표시한다", async () => {
    mockedUpdateRiskStatus.mockResolvedValue({
      data: undefined,
      status: 200,
      headers: new Headers(),
    } as Awaited<ReturnType<typeof updateRiskStatus>>);
    const { wrapper, queryClient } = makeWrapperWithClient();
    const detailKey = riskKeys.detail(
      params.workspaceId,
      params.packId,
      params.versionId,
      params.riskId,
    );
    const listKey = riskKeys.list(params.workspaceId, params.packId, params.versionId);
    queryClient.setQueryData<RiskDefinition>(detailKey, stubRisk);
    queryClient.setQueryData<RiskSummary[]>(listKey, [stubRisk]);

    const { result } = renderHook(() => useUpdateRiskStatus(), { wrapper });

    act(() => {
      result.current.mutate({ ...params, status: "INACTIVE" });
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(RISK_ERROR_MESSAGES.STATUS_FAILED),
    );
    expect(result.current.isError).toBe(true);
    expect(queryClient.getQueryData<RiskDefinition>(detailKey)?.status).toBe("ACTIVE");
    expect(queryClient.getQueryData<RiskSummary[]>(listKey)?.[0]?.status).toBe("ACTIVE");
  });

  it("RISK_NOT_EDITABLE 오류 시 rollback 후 전용 메시지를 표시한다", async () => {
    mockedUpdateRiskStatus.mockRejectedValue(
      new ApiRequestError(400, "RISK_NOT_EDITABLE", "수정 불가"),
    );
    const { wrapper, queryClient } = makeWrapperWithClient();
    const detailKey = riskKeys.detail(
      params.workspaceId,
      params.packId,
      params.versionId,
      params.riskId,
    );
    const listKey = riskKeys.list(params.workspaceId, params.packId, params.versionId);
    queryClient.setQueryData<RiskDefinition>(detailKey, stubRisk);
    queryClient.setQueryData<RiskSummary[]>(listKey, [stubRisk]);

    const { result } = renderHook(() => useUpdateRiskStatus(), { wrapper });

    act(() => {
      result.current.mutate({ ...params, status: "INACTIVE" });
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(RISK_ERROR_MESSAGES.RISK_NOT_EDITABLE),
    );
    expect(queryClient.getQueryData<RiskDefinition>(detailKey)?.status).toBe("ACTIVE");
    expect(queryClient.getQueryData<RiskSummary[]>(listKey)?.[0]?.status).toBe("ACTIVE");
  });
});
