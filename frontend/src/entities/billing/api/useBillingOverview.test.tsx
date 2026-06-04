import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getBillingOverview } from "@/shared/api/generated/endpoints/billing-overview-controller/billing-overview-controller";

import { useBillingOverview } from "./useBillingOverview";

vi.mock(
  "@/shared/api/generated/endpoints/billing-overview-controller/billing-overview-controller",
  () => ({
    getBillingOverview: vi.fn(),
  }),
);

const mockGetBillingOverview = vi.mocked(getBillingOverview);

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const overview = {
  subscription: {
    id: 1,
    workspaceId: 42,
    planKey: "PRO",
    status: "ACTIVE",
    customerKey: "ws_42",
    cancelAtPeriodEnd: false,
    currentPeriodStart: "2024-01-01T00:00:00Z",
    currentPeriodEnd: "2024-02-01T00:00:00Z",
    memberLimit: 10,
    datasetUploadLimit: 20,
    pipelineRunLimit: 30,
  },
  billingKey: {
    id: 7,
    cardCompany: "신한카드",
    cardNumberMasked: "1234-****-****-5678",
    status: "ACTIVE",
  },
  payments: [],
  quotaUsages: [{ resource: "MEMBER", used: 3, limit: 10, warning: false }],
};

describe("useBillingOverview", () => {
  beforeEach(() => {
    mockGetBillingOverview.mockReset();
  });

  it("workspaceId가 null이면 query가 비활성 상태", () => {
    const { result } = renderHook(() => useBillingOverview(null), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
    expect(mockGetBillingOverview).not.toHaveBeenCalled();
  });

  it("billing overview를 성공적으로 조회한다", async () => {
    mockGetBillingOverview.mockResolvedValue({ data: overview } as never);

    const { result } = renderHook(() => useBillingOverview(42), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(overview);
    expect(mockGetBillingOverview).toHaveBeenCalledWith(42);
  });

  it("API response가 비어 있으면 empty overview로 정규화한다", async () => {
    mockGetBillingOverview.mockResolvedValue(undefined as never);

    const { result } = renderHook(() => useBillingOverview(42), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      subscription: null,
      billingKey: null,
      payments: [],
      quotaUsages: [],
    });
  });

  it("API 실패 시 isError 상태로 전파한다", async () => {
    mockGetBillingOverview.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useBillingOverview(42), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
