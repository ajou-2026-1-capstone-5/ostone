import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGetPolicy } from "./useGetPolicy";

vi.mock("@/shared/api/generated/endpoints/policy-definition-controller/policy-definition-controller", () => ({
  getPolicy: vi.fn(),
}));

import { getPolicy } from "@/shared/api/generated/endpoints/policy-definition-controller/policy-definition-controller";

const mockedGetPolicy = vi.mocked(getPolicy);

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
    mockedGetPolicy.mockReset();
  });

  it("enabled 상태면 정책 상세를 조회한다", async () => {
    mockedGetPolicy.mockResolvedValue({ data: stubPolicy as any, status: 200, headers: new Headers() });

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
    expect(mockedGetPolicy).toHaveBeenCalledWith(1, 2, 3, 4);
  });
});
