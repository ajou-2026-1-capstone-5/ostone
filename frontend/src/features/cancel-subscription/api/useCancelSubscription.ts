import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cancelSubscription } from "@/shared/api/generated/endpoints/subscription-controller/subscription-controller";
import { billingQueryKeys, selectApiData } from "@/shared/api";
import type { BillingOverviewResponse, SubscriptionResponse } from "@/entities/billing";

function replaceOverviewSubscription(
  overview: BillingOverviewResponse | undefined,
  updated: SubscriptionResponse,
): BillingOverviewResponse | undefined {
  if (!overview) {
    return overview;
  }

  return {
    ...overview,
    subscription: updated,
  };
}

/** DELETE /subscription — INCOMPLETE 는 즉시 해지, 그 외는 기간말 해지 예약(백엔드 규칙). */
export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId }: { workspaceId: number }) => {
      const res = await cancelSubscription(workspaceId);
      return selectApiData(res) as SubscriptionResponse | undefined;
    },
    onSuccess: (updated, { workspaceId }) => {
      if (updated) {
        queryClient.setQueryData(billingQueryKeys.subscription(workspaceId), updated);
        queryClient.setQueryData<BillingOverviewResponse | undefined>(
          billingQueryKeys.overview(workspaceId),
          (overview) => replaceOverviewSubscription(overview, updated),
        );
      } else {
        void queryClient.invalidateQueries({ queryKey: billingQueryKeys.subscription(workspaceId) });
        void queryClient.invalidateQueries({ queryKey: billingQueryKeys.overview(workspaceId) });
      }
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.payments(workspaceId) });
    },
  });
}
