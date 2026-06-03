import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cancelPayment } from "@/shared/api/generated/endpoints/payment-controller/payment-controller";
import { billingQueryKeys, selectApiData } from "@/shared/api";
import type { PaymentResponse } from "@/entities/billing";

interface RefundPaymentParams {
  workspaceId: number;
  paymentKey: string;
  cancelReason: string;
  /** 미지정(undefined)이면 전액 환불. */
  cancelAmount?: number;
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
    onSuccess: (_result, { workspaceId }) => {
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.payments(workspaceId) });
    },
  });
}
