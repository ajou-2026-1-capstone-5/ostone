import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { policyApi } from "@/entities/policy";
import { ApiRequestError } from "@/shared/api";
import { usePolicyDetail } from "./usePolicyDetail";

vi.mock("@/entities/policy", () => ({
  policyApi: {
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

const mockedDetail = vi.mocked(policyApi.detail);

const stubPolicy = {
  id: 4,
  domainPackVersionId: 3,
  policyCode: "POL_REFUND",
  name: "환불 정책",
  description: "환불 조건",
  severity: "HIGH",
  conditionJson: "{}",
  actionJson: "{}",
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

describe("usePolicyDetail", () => {
  beforeEach(() => {
    mockedDetail.mockReset();
  });

  it("policyId가 없으면 idle 상태를 반환한다", () => {
    const { result } = renderHook(() => usePolicyDetail(1, 2, 3, null), {
      wrapper: makeWrapper(),
    });

    expect(result.current.status).toBe("idle");
    expect(mockedDetail).not.toHaveBeenCalled();
  });

  it("성공 시 ready 상태와 상세 데이터를 반환한다", async () => {
    mockedDetail.mockResolvedValue(stubPolicy);
    const { result } = renderHook(() => usePolicyDetail(1, 2, 3, 4), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.status).toBe("ready"));

    if (result.current.status === "ready") {
      expect(result.current.data.policyCode).toBe("POL_REFUND");
    }
  });

  it("ApiRequestError를 error 상태로 변환한다", async () => {
    mockedDetail.mockRejectedValue(new ApiRequestError(404, "POLICY_NOT_FOUND", "없음"));
    const { result } = renderHook(() => usePolicyDetail(1, 2, 3, 404), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.status).toBe("error"));

    if (result.current.status === "error") {
      expect(result.current.httpStatus).toBe(404);
      expect(result.current.code).toBe("POLICY_NOT_FOUND");
    }
  });
});
