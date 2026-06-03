import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRefundPayment } from "./useRefundPayment";
import { cancelPayment } from "@/shared/api/generated/endpoints/payment-controller/payment-controller";

vi.mock(
  "@/shared/api/generated/endpoints/payment-controller/payment-controller",
  () => ({
    cancelPayment: vi.fn(),
    confirmPayment: vi.fn(),
    getPayments: vi.fn(),
  }),
);

const mockCancelPayment = vi.mocked(cancelPayment);

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe("useRefundPayment", () => {
  beforeEach(() => {
    mockCancelPayment.mockReset();
  });

  it("초기 상태 idle", () => {
    const { result } = renderHook(() => useRefundPayment(), { wrapper: createWrapper() });
    expect(result.current.status).toBe("idle");
  });

  it("환불 성공 시 isSuccess 상태", async () => {
    mockCancelPayment.mockResolvedValue({ data: { id: 1, status: "CANCELED" } } as never);
    const { result } = renderHook(() => useRefundPayment(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({
        workspaceId: 1,
        paymentKey: "pay-key-001",
        cancelReason: "고객 요청",
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCancelPayment).toHaveBeenCalledWith(1, "pay-key-001", expect.objectContaining({ cancelReason: "고객 요청" }));
  });

  it("API 실패 시 isError 상태", async () => {
    mockCancelPayment.mockRejectedValue(new Error("gateway error"));
    const { result } = renderHook(() => useRefundPayment(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({ workspaceId: 1, paymentKey: "key", cancelReason: "사유" });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
