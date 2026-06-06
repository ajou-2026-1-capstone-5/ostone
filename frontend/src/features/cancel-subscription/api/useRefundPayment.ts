import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cancelPayment } from "@/shared/api/generated/endpoints/payment-controller/payment-controller";
import { billingQueryKeys, selectApiData } from "@/shared/api";
import type { BillingOverviewResponse, PaymentResponse } from "@/entities/billing";

interface RefundPaymentParams {
  workspaceId: number;
  paymentKey: string;
  cancelReason: string;
  /** 미지정(undefined)이면 전액 환불. */
  cancelAmount?: number;
}

function isSamePayment(payment: PaymentResponse, updated: PaymentResponse): boolean {
  return (
    (payment.id !== undefined && payment.id === updated.id) ||
    (payment.paymentKey !== undefined && payment.paymentKey === updated.paymentKey) ||
    (payment.orderId !== undefined && payment.orderId === updated.orderId)
  );
}

function replaceOverviewPayment(
  overview: BillingOverviewResponse | undefined,
  updated: PaymentResponse,
): BillingOverviewResponse | undefined {
  if (!overview) {
    return overview;
  }

  const payments = overview.payments ?? [];
  const hasPayment = payments.some((payment) => isSamePayment(payment, updated));
  return {
    ...overview,
    payments: hasPayment
      ? payments.map((payment) =>
          isSamePayment(payment, updated) ? { ...payment, ...updated } : payment,
        )
      : [updated, ...payments],
  };
}

/** POST /payments/{paymentKey}/cancel — 결제 환불(전액/부분). */
export function useRefundPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workspaceId,
      paymentKey,
      cancelReason,
      cancelAmount,
    }: RefundPaymentParams) => {
      const res = await cancelPayment(workspaceId, paymentKey, { cancelReason, cancelAmount });
      return selectApiData(res) as PaymentResponse | undefined;
    },
    onSuccess: (updated, { workspaceId }) => {
      if (updated) {
        queryClient.setQueryData<BillingOverviewResponse | undefined>(
          billingQueryKeys.overview(workspaceId),
          (overview) => replaceOverviewPayment(overview, updated),
        );
      }
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.payments(workspaceId) });
    },
  });
}
