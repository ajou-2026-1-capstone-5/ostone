import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { policyApi } from "@/entities/policy";
import { useGetPolicy } from "./useGetPolicy";

vi.mock("@/entities/policy", () => ({
  policyApi: {
    detail: vi.fn(),
  },
  policyKeys: {
    detail: (...args: number[]) => ["policies", "detail", ...args],
  },
}));

const mockedDetail = vi.mocked(policyApi.detail);

const stubPolicy = {
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
  status: "ACTIVE" as const,
  createdAt: "",
  updatedAt: "",
};

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useGetPolicy", () => {
  beforeEach(() => {
    mockedDetail.mockReset();
  });

  it("enabled 상태면 정책 상세를 조회한다", async () => {
    mockedDetail.mockResolvedValue(stubPolicy);

    const { result } = renderHook(
      () =>
        useGetPolicy({
          workspaceId: 1,
          packId: 2,
          versionId: 3,
          policyId: 4,
          enabled: true,
        }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.data).toEqual(stubPolicy));
    expect(mockedDetail).toHaveBeenCalledWith(1, 2, 3, 4);
  });
});
