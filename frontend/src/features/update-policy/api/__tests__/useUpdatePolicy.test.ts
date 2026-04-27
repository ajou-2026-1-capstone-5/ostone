import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { policyApi, policyKeys } from "@/entities/policy";
import type { PolicyDefinition, PolicySummary } from "@/entities/policy";
import { ApiRequestError } from "@/shared/api";
import { toast } from "sonner";
import { POLICY_ERROR_MESSAGES } from "../messages";
import { useUpdatePolicy } from "../useUpdatePolicy";
import { useUpdatePolicyStatus } from "../useUpdatePolicyStatus";

vi.mock("@/entities/policy", () => ({
  policyApi: {
    update: vi.fn(),
    updateStatus: vi.fn(),
    list: vi.fn(),
    detail: vi.fn(),
  },
  policyKeys: {
    all: ["policies"],
    lists: () => ["policies", "list"],
    list: (...args: number[]) => ["policies", "list", ...args],
    detail: (...args: number[]) => ["policies", "detail", ...args],
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockedUpdate = vi.mocked(policyApi.update);
const mockedUpdateStatus = vi.mocked(policyApi.updateStatus);

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function makeWrapperWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { wrapper, queryClient };
}

const params = { workspaceId: 1, packId: 2, versionId: 3, policyId: 4 };

const stubPolicy: PolicyDefinition = {
  id: 4,
  domainPackVersionId: 3,
  policyCode: "POL_REFUND",
  name: "환불 정책",
  description: null,
  severity: "HIGH",
  conditionJson: "{}",
  actionJson: "{}",
  evidenceJson: "[]",
  metaJson: "{}",
  status: "ACTIVE",
  createdAt: "2026-04-16T10:00:00Z",
  updatedAt: "2026-04-16T10:00:00Z",
};

describe("useUpdatePolicy", () => {
  beforeEach(() => {
    mockedUpdate.mockReset();
    mockedUpdateStatus.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("성공 시 toast.success를 호출한다", async () => {
    mockedUpdate.mockResolvedValue({ ...stubPolicy, name: "새 정책" });
    const { result } = renderHook(() => useUpdatePolicy(), { wrapper: makeWrapper() });

    act(() => {
      result.current.mutate({ ...params, body: { name: "새 정책" } });
    });

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("정책이 수정되었습니다."));
  });

  it("POLICY_NOT_EDITABLE 에러 시 전용 안내 메시지를 표시한다", async () => {
    mockedUpdate.mockRejectedValue(new ApiRequestError(400, "POLICY_NOT_EDITABLE", "수정 불가"));
    const { result } = renderHook(() => useUpdatePolicy(), { wrapper: makeWrapper() });

    act(() => {
      result.current.mutate({ ...params, body: { name: "새 정책" } });
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(POLICY_ERROR_MESSAGES.POLICY_NOT_EDITABLE),
    );
  });

  it("VALIDATION_ERROR 에러 시 검증 안내 메시지를 표시한다", async () => {
    mockedUpdate.mockRejectedValue(new ApiRequestError(400, "VALIDATION_ERROR", "검증 실패"));
    const { result } = renderHook(() => useUpdatePolicy(), { wrapper: makeWrapper() });

    act(() => {
      result.current.mutate({ ...params, body: { name: "새 정책" } });
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(POLICY_ERROR_MESSAGES.VALIDATION_ERROR),
    );
  });

  it("일반 오류 시 UPDATE_FAILED 메시지를 표시한다", async () => {
    mockedUpdate.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => useUpdatePolicy(), { wrapper: makeWrapper() });

    act(() => {
      result.current.mutate({ ...params, body: { name: "새 정책" } });
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(POLICY_ERROR_MESSAGES.UPDATE_FAILED),
    );
  });
});

describe("useUpdatePolicyStatus", () => {
  beforeEach(() => {
    mockedUpdate.mockReset();
    mockedUpdateStatus.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("성공 시 detail/list query cache를 갱신한다", async () => {
    mockedUpdateStatus.mockResolvedValue({ ...stubPolicy, status: "INACTIVE" });
    const { wrapper, queryClient } = makeWrapperWithClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    queryClient.setQueryData<PolicyDefinition>(
      policyKeys.detail(params.workspaceId, params.packId, params.versionId, params.policyId),
      stubPolicy,
    );

    const { result } = renderHook(() => useUpdatePolicyStatus(), { wrapper });

    act(() => {
      result.current.mutate({ ...params, status: "INACTIVE" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(
      queryClient.getQueryData<PolicyDefinition>(
        policyKeys.detail(params.workspaceId, params.packId, params.versionId, params.policyId),
      )?.status,
    ).toBe("INACTIVE");
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("POLICY_CODE_REFERENCED_BY_WORKFLOW 오류 시 rollback 후 전용 메시지를 표시한다", async () => {
    mockedUpdateStatus.mockRejectedValue(
      new ApiRequestError(400, "POLICY_CODE_REFERENCED_BY_WORKFLOW", "참조 중"),
    );
    const { wrapper, queryClient } = makeWrapperWithClient();
    const listKey = policyKeys.list(params.workspaceId, params.packId, params.versionId);
    const detailKey = policyKeys.detail(
      params.workspaceId,
      params.packId,
      params.versionId,
      params.policyId,
    );
    queryClient.setQueryData<PolicyDefinition>(detailKey, stubPolicy);
    queryClient.setQueryData<PolicySummary[]>(listKey, [stubPolicy]);

    const { result } = renderHook(() => useUpdatePolicyStatus(), { wrapper });

    act(() => {
      result.current.mutate({ ...params, status: "INACTIVE" });
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        POLICY_ERROR_MESSAGES.POLICY_CODE_REFERENCED_BY_WORKFLOW,
      ),
    );
    expect(queryClient.getQueryData<PolicyDefinition>(detailKey)?.status).toBe("ACTIVE");
    expect(queryClient.getQueryData<PolicySummary[]>(listKey)?.[0]?.status).toBe("ACTIVE");
  });

  it("POLICY_NOT_EDITABLE 오류 시 전용 메시지를 표시한다", async () => {
    mockedUpdateStatus.mockRejectedValue(
      new ApiRequestError(400, "POLICY_NOT_EDITABLE", "수정 불가"),
    );
    const { result } = renderHook(() => useUpdatePolicyStatus(), { wrapper: makeWrapper() });

    act(() => {
      result.current.mutate({ ...params, status: "INACTIVE" });
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(POLICY_ERROR_MESSAGES.POLICY_NOT_EDITABLE),
    );
  });
});
