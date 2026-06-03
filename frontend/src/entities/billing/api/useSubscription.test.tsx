import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSubscription } from "./useSubscription";
import { ApiRequestError } from "@/shared/api";
import { getSubscription } from "@/shared/api/generated/endpoints/subscription-controller/subscription-controller";

vi.mock(
  "@/shared/api/generated/endpoints/subscription-controller/subscription-controller",
  () => ({
    getSubscription: vi.fn(),
  }),
);

const mockGetSubscription = vi.mocked(getSubscription);

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const stubSubscription = {
  id: 1,
  workspaceId: 42,
  status: "ACTIVE",
  customerKey: "ws_42",
  createdAt: "2024-01-01T00:00:00Z",
};

describe("useSubscription", () => {
  beforeEach(() => {
    mockGetSubscription.mockReset();
  });

  it("workspaceId가 null이면 query가 비활성 상태", () => {
    const { result } = renderHook(() => useSubscription(null), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("구독 정보를 성공적으로 조회", async () => {
    mockGetSubscription.mockResolvedValue({ data: stubSubscription } as never);
    const { result } = renderHook(() => useSubscription(42), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(stubSubscription);
    expect(mockGetSubscription).toHaveBeenCalledWith(42);
  });

  it("404 에러(구독 없음)는 null로 처리", async () => {
    mockGetSubscription.mockRejectedValue(new ApiRequestError(404, "SUBSCRIPTION_NOT_FOUND", "구독 없음"));
    const { result } = renderHook(() => useSubscription(10), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("404 외 에러는 isError 상태로 전파", async () => {
    mockGetSubscription.mockRejectedValue(new ApiRequestError(500, "INTERNAL_ERROR", "서버 오류"));
    const { result } = renderHook(() => useSubscription(11), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("일반 Error도 isError 상태로 전파", async () => {
    mockGetSubscription.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => useSubscription(12), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
