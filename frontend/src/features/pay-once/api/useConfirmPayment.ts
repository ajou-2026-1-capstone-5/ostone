import { useMutation, useQueryClient } from "@tanstack/react-query";

import { confirmPayment } from "@/shared/api/generated/endpoints/payment-controller/payment-controller";
import { billingQueryKeys, selectApiData } from "@/shared/api";
import type { PaymentResponse } from "@/entities/billing";

interface ConfirmPaymentParams {
  workspaceId: number;
  paymentKey: string;
  orderId: string;
  amount: number;
}

/**
 * POST /payments/confirm — 위젯 일회성 결제 복귀 시 승인. paymentKey 는 수신 즉시 서버로 전달만 한다.
 * 동일 orderId 중복 호출 가드는 호출 측(success 랜딩)이 orderGuard 로 수행한다.
 */
export function useConfirmPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId, paymentKey, orderId, amount }: ConfirmPaymentParams) => {
      const res = await confirmPayment(workspaceId, { paymentKey, orderId, amount });
      return selectApiData(res) as PaymentResponse | undefined;
    },
    onSuccess: (_result, { workspaceId }) => {
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.payments(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.subscription(workspaceId) });
    },
  });
}
