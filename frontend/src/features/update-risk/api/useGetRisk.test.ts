import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGetRisk } from "./useGetRisk";

vi.mock("@/shared/api/generated/endpoints/risk-definition-controller/risk-definition-controller", () => ({
  getRisk: vi.fn(),
}));

import { getRisk } from "@/shared/api/generated/endpoints/risk-definition-controller/risk-definition-controller";

const mockedGetRisk = vi.mocked(getRisk);

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
    mockedGetRisk.mockReset();
  });

  it("enabled 상태면 위험요소 상세를 조회한다", async () => {
    mockedGetRisk.mockResolvedValue({ data: stubRisk, status: 200, headers: new Headers() });

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
    expect(mockedGetRisk).toHaveBeenCalledWith(1, 2, 3, 4);
  });
});
