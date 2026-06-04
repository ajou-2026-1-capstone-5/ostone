import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { apiClient } from "@/shared/api";
import { fetchAdminBillingCustomers, refundAdminBillingPayment } from "./adminBillingApi";

vi.mock("@/shared/api", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedApiClient = vi.mocked(apiClient);

describe("adminBillingApi", () => {
  beforeEach(() => {
    mockedApiClient.get.mockReset();
    mockedApiClient.post.mockReset();
  });

  it("고객사 결제 현황을 조회한다", async () => {
    mockedApiClient.get.mockResolvedValueOnce([]);

    await expect(fetchAdminBillingCustomers()).resolves.toEqual([]);

    expect(mockedApiClient.get).toHaveBeenCalledWith("/admin/billing/customers");
  });

  it("전체 환불을 요청한다", async () => {
    mockedApiClient.post.mockResolvedValueOnce({
      paymentId: 10,
      workspaceId: 1,
      refundAmount: 29000,
      paymentStatus: "CANCELED",
      transactionKey: "tx_cancel_1",
      canceledAt: "2026-06-03T12:00:00Z",
      reason: "고객 요청",
    });

    await refundAdminBillingPayment(10, "고객 요청");

    expect(mockedApiClient.post).toHaveBeenCalledWith("/admin/billing/payments/10/refunds", {
      reason: "고객 요청",
    });
  });
});
