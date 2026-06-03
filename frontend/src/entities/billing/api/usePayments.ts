import { useQuery } from "@tanstack/react-query";

import { getPayments } from "@/shared/api/generated/endpoints/payment-controller/payment-controller";
import { billingQueryKeys, selectApiList } from "@/shared/api";

import type { PaymentResponse } from "../model/types";

/** GET /payments. 결제 내역(영수증 링크) 목록. */
export function usePayments(workspaceId: number | null, enabled = true) {
  const isEnabled = workspaceId !== null && enabled;
  const wsId = workspaceId ?? 0;

  return useQuery<PaymentResponse[]>({
    queryKey: billingQueryKeys.payments(wsId),
    enabled: isEnabled,
    queryFn: async () => {
      const res = await getPayments(wsId);
      return selectApiList(res) as PaymentResponse[];
    },
  });
}
