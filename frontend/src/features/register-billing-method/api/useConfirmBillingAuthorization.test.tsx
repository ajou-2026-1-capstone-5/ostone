import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useConfirmBillingAuthorization } from "./useConfirmBillingAuthorization";
import { issueBillingKey } from "@/shared/api/generated/endpoints/subscription-controller/subscription-controller";

vi.mock(
  "@/shared/api/generated/endpoints/subscription-controller/subscription-controller",
  () => ({
    cancelSubscription: vi.fn(),
    createSubscription: vi.fn(),
    getSubscription: vi.fn(),
    issueBillingKey: vi.fn(),
  }),
);

const mockIssueBillingKey = vi.mocked(issueBillingKey);

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const stubBillingAuth = {
  billingKey: "billing-key-123",
  subscription: { id: 1, workspaceId: 1, status: "ACTIVE", customerKey: "ws_1" },
};

describe("useConfirmBillingAuthorization", () => {
  beforeEach(() => {
    mockIssueBillingKey.mockReset();
  });

  it("초기 상태 idle", () => {
    const { result } = renderHook(() => useConfirmBillingAuthorization(), { wrapper: createWrapper() });
    expect(result.current.status).toBe("idle");
  });

  it("빌링 인증 성공 시 isSuccess (subscription 포함)", async () => {
    mockIssueBillingKey.mockResolvedValue({ data: stubBillingAuth } as never);
    const { result } = renderHook(() => useConfirmBillingAuthorization(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({ workspaceId: 1, authKey: "auth-key", customerKey: "ws_1" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockIssueBillingKey).toHaveBeenCalledWith(1, { authKey: "auth-key", customerKey: "ws_1" });
    expect(result.current.data?.billingKey).toBe("billing-key-123");
  });

  it("subscription 없는 성공 응답도 처리", async () => {
    mockIssueBillingKey.mockResolvedValue({ data: { billingKey: "key", subscription: null } } as never);
    const { result } = renderHook(() => useConfirmBillingAuthorization(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({ workspaceId: 2, authKey: "auth", customerKey: "ws_2" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("API 실패 시 isError", async () => {
    mockIssueBillingKey.mockRejectedValue(new Error("auth error"));
    const { result } = renderHook(() => useConfirmBillingAuthorization(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({ workspaceId: 3, authKey: "bad", customerKey: "ws_3" });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
