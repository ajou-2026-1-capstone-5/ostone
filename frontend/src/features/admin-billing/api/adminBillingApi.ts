import { apiClient } from "@/shared/api";

export interface AdminBillingCustomerResponse {
  workspaceId: number;
  workspaceKey: string;
  workspaceName: string;
  subscription: {
    status: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    nextBillingAt: string | null;
    planName: string | null;
    planAmount: number | null;
  };
  recentPayment: {
    id: number;
    amount: number;
    status: string;
    approvedAt: string | null;
  } | null;
  failedStatus: string | null;
}

export interface AdminBillingRefundResponse {
  paymentId: number;
  workspaceId: number;
  refundAmount: number;
  paymentStatus: string;
  transactionKey: string;
  canceledAt: string;
  reason: string;
}

export async function fetchAdminBillingCustomers(): Promise<AdminBillingCustomerResponse[]> {
  // OpenAPI generated endpoint is not available until this branch's backend spec is regenerated.
  return apiClient.get<AdminBillingCustomerResponse[]>("/admin/billing/customers");
}

export async function refundAdminBillingPayment(
  paymentId: number,
  reason: string,
): Promise<AdminBillingRefundResponse> {
  // OpenAPI generated endpoint is not available until this branch's backend spec is regenerated.
  return apiClient.post<AdminBillingRefundResponse>(
    `/admin/billing/payments/${paymentId}/refunds`,
    {
      reason,
    },
  );
}
