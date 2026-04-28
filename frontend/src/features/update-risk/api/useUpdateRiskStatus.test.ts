import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { riskApi, riskKeys } from "@/entities/risk";
import type { RiskDefinition, RiskSummary } from "@/entities/risk";
import { ApiRequestError } from "@/shared/api";
import { toast } from "sonner";
import { RISK_ERROR_MESSAGES } from "./messages";
import { useUpdateRiskStatus } from "./useUpdateRiskStatus";

vi.mock("@/entities/risk", () => ({
  riskApi: {
    updateStatus: vi.fn(),
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

const mockedUpdateStatus = vi.mocked(riskApi.updateStatus);

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
    mockedUpdateStatus.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("성공 시 detail/list query cache를 갱신한다", async () => {
    mockedUpdateStatus.mockResolvedValue({ ...stubRisk, status: "INACTIVE" });
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

  it("RISK_NOT_EDITABLE 오류 시 rollback 후 전용 메시지를 표시한다", async () => {
    mockedUpdateStatus.mockRejectedValue(
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
