import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCancelSubscription } from "./useCancelSubscription";
import { cancelSubscription } from "@/shared/api/generated/endpoints/subscription-controller/subscription-controller";

vi.mock(
  "@/shared/api/generated/endpoints/subscription-controller/subscription-controller",
  () => ({
    cancelSubscription: vi.fn(),
    createSubscription: vi.fn(),
    getSubscription: vi.fn(),
    issueBillingKey: vi.fn(),
  }),
);

const mockCancelSubscription = vi.mocked(cancelSubscription);

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const stubSubscription = { id: 1, workspaceId: 1, status: "CANCELED", customerKey: "ws_1" };

describe("useCancelSubscription", () => {
  beforeEach(() => {
    mockCancelSubscription.mockReset();
  });

  it("초기 상태 idle", () => {
    const { result } = renderHook(() => useCancelSubscription(), { wrapper: createWrapper() });
    expect(result.current.status).toBe("idle");
  });

  it("구독 해지 성공 시 isSuccess 상태", async () => {
    mockCancelSubscription.mockResolvedValue({ data: stubSubscription } as never);
    const { result } = renderHook(() => useCancelSubscription(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({ workspaceId: 1 });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCancelSubscription).toHaveBeenCalledWith(1);
  });

  it("API 실패 시 isError 상태", async () => {
    mockCancelSubscription.mockRejectedValue(new Error("api error"));
    const { result } = renderHook(() => useCancelSubscription(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({ workspaceId: 2 });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
