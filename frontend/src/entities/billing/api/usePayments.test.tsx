import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePayments } from "./usePayments";
import { getPayments } from "@/shared/api/generated/endpoints/payment-controller/payment-controller";

vi.mock(
  "@/shared/api/generated/endpoints/payment-controller/payment-controller",
  () => ({
    getPayments: vi.fn(),
  }),
);

const mockGetPayments = vi.mocked(getPayments);

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const stubPayment = {
  id: 1,
  amount: 9900,
  status: "DONE",
  method: "card",
  createdAt: "2024-01-01T00:00:00Z",
};

describe("usePayments", () => {
  beforeEach(() => {
    mockGetPayments.mockReset();
  });

  it("workspaceId가 null이면 query가 비활성 상태", () => {
    const { result } = renderHook(() => usePayments(null), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("enabled=false이면 query가 비활성 상태", () => {
    const { result } = renderHook(() => usePayments(1, false), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("결제 내역을 성공적으로 조회", async () => {
    mockGetPayments.mockResolvedValue({ data: [stubPayment] } as never);
    const { result } = renderHook(() => usePayments(1), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([stubPayment]);
    expect(mockGetPayments).toHaveBeenCalledWith(1);
  });

  it("빈 목록 반환", async () => {
    mockGetPayments.mockResolvedValue({ data: [] } as never);
    const { result } = renderHook(() => usePayments(2), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("API 실패 시 isError 상태", async () => {
    mockGetPayments.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => usePayments(3), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
