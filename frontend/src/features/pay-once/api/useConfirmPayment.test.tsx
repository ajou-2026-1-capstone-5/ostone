import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useConfirmPayment } from "./useConfirmPayment";
import { confirmPayment } from "@/shared/api/generated/endpoints/payment-controller/payment-controller";

vi.mock(
  "@/shared/api/generated/endpoints/payment-controller/payment-controller",
  () => ({
    cancelPayment: vi.fn(),
    confirmPayment: vi.fn(),
    getPayments: vi.fn(),
  }),
);

const mockConfirmPayment = vi.mocked(confirmPayment);

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe("useConfirmPayment", () => {
  beforeEach(() => {
    mockConfirmPayment.mockReset();
  });

  it("초기 상태 idle", () => {
    const { result } = renderHook(() => useConfirmPayment(), { wrapper: createWrapper() });
    expect(result.current.status).toBe("idle");
  });

  it("결제 승인 성공 시 isSuccess", async () => {
    mockConfirmPayment.mockResolvedValue({ data: { id: 1, status: "DONE" } } as never);
    const { result } = renderHook(() => useConfirmPayment(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({ workspaceId: 1, paymentKey: "pay-key", orderId: "order-001", amount: 9900 });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockConfirmPayment).toHaveBeenCalledWith(1, expect.objectContaining({ paymentKey: "pay-key", orderId: "order-001", amount: 9900 }));
  });

  it("API 실패 시 isError", async () => {
    mockConfirmPayment.mockRejectedValue(new Error("confirm error"));
    const { result } = renderHook(() => useConfirmPayment(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({ workspaceId: 1, paymentKey: "key", orderId: "ord", amount: 100 });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
