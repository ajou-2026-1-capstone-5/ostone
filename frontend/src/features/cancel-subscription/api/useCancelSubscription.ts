import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cancelSubscription } from "@/shared/api/generated/endpoints/subscription-controller/subscription-controller";
import { billingQueryKeys, selectApiData } from "@/shared/api";
import type { SubscriptionResponse } from "@/entities/billing";

/** DELETE /subscription — INCOMPLETE 는 즉시 해지, 그 외는 기간말 해지 예약(백엔드 규칙). */
export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId }: { workspaceId: number }) => {
      const res = await cancelSubscription(workspaceId);
      return selectApiData(res) as SubscriptionResponse | undefined;
    },
    onSuccess: (updated, { workspaceId }) => {
      queryClient.setQueryData(billingQueryKeys.subscription(workspaceId), updated ?? null);
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.payments(workspaceId) });
    },
  });
}
