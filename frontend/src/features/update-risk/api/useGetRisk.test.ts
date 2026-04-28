import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { riskApi } from "@/entities/risk";
import { useGetRisk } from "./useGetRisk";

vi.mock("@/entities/risk", () => ({
  riskApi: {
    detail: vi.fn(),
  },
  riskKeys: {
    detail: (...args: number[]) => ["risks", "detail", ...args],
  },
}));

const mockedDetail = vi.mocked(riskApi.detail);

const stubRisk = {
  id: 4,
  domainPackVersionId: 3,
  riskCode: "RISK_FRAUD",
  name: "사기 위험",
  description: null,
  riskLevel: "HIGH" as const,
  triggerConditionJson: "{}",
  handlingActionJson: "{}",
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

describe("useGetRisk", () => {
  beforeEach(() => {
    mockedDetail.mockReset();
  });

  it("enabled 상태면 위험요소 상세를 조회한다", async () => {
    mockedDetail.mockResolvedValue(stubRisk);

    const { result } = renderHook(
      () =>
        useGetRisk({
          workspaceId: 1,
          packId: 2,
          versionId: 3,
          riskId: 4,
          enabled: true,
        }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.data).toEqual(stubRisk));
    expect(mockedDetail).toHaveBeenCalledWith(1, 2, 3, 4);
  });
});
