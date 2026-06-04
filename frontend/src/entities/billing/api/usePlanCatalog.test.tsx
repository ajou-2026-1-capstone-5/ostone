import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listPlans } from "@/shared/api/generated/endpoints/plan-catalog-controller/plan-catalog-controller";

import { usePlanCatalog } from "./usePlanCatalog";

vi.mock("@/shared/api/generated/endpoints/plan-catalog-controller/plan-catalog-controller", () => ({
  listPlans: vi.fn(),
}));

const mockListPlans = vi.mocked(listPlans);

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe("usePlanCatalog", () => {
  beforeEach(() => {
    mockListPlans.mockReset();
  });

  it("카탈로그 응답을 정규화하여 반환한다", async () => {
    mockListPlans.mockResolvedValue({
      data: [
        {
          planKey: "pro_monthly",
          name: "Pro (Monthly)",
          amount: 29000,
          currency: "KRW",
          interval: "MONTH",
          memberLimit: 3,
          datasetUploadLimit: 10,
          pipelineRunHourlyLimit: 1,
          contactOnly: false,
          unlimited: false,
        },
      ],
    } as never);

    const { result } = renderHook(() => usePlanCatalog(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]).toMatchObject({
      planKey: "pro_monthly",
      memberLimit: 3,
      pipelineRunHourlyLimit: 1,
      contactOnly: false,
    });
  });

  it("누락 필드는 안전한 기본값으로 정규화한다", async () => {
    mockListPlans.mockResolvedValue({
      data: [{ planKey: "enterprise", contactOnly: true }],
    } as never);

    const { result } = renderHook(() => usePlanCatalog(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]).toMatchObject({
      planKey: "enterprise",
      amount: 0,
      currency: "KRW",
      contactOnly: true,
      unlimited: false,
    });
  });

  it("API 실패 시 isError 상태로 전파한다", async () => {
    mockListPlans.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => usePlanCatalog(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
