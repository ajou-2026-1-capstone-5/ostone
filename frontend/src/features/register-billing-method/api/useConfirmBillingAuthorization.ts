import { useMutation, useQueryClient } from "@tanstack/react-query";

import { issueBillingKey } from "@/shared/api/generated/endpoints/subscription-controller/subscription-controller";
import { billingQueryKeys, selectApiData } from "@/shared/api";
import type { BillingAuthorizationResponse } from "@/entities/billing";

interface ConfirmBillingParams {
  workspaceId: number;
  authKey: string;
  customerKey: string;
}

/**
 * POST /billing/authorizations — 리다이렉트 복귀(/billing/success)에서 authKey/customerKey 로 빌링키를 발급하고
 * 구독을 활성화한다. authKey/customerKey 는 수신 즉시 서버로 전달만 하고 저장/로깅하지 않는다.
 */
export function useConfirmBillingAuthorization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId, authKey, customerKey }: ConfirmBillingParams) => {
      const res = await issueBillingKey(workspaceId, { authKey, customerKey });
      return selectApiData(res) as BillingAuthorizationResponse | undefined;
    },
    onSuccess: (result, { workspaceId }) => {
      if (result?.subscription) {
        queryClient.setQueryData(billingQueryKeys.subscription(workspaceId), result.subscription);
      }
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.payments(workspaceId) });
    },
  });
}
