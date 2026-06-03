import { useQuery } from "@tanstack/react-query";

import { getSubscription } from "@/shared/api/generated/endpoints/subscription-controller/subscription-controller";
import { ApiRequestError, billingQueryKeys, selectApiData } from "@/shared/api";

import type { SubscriptionResponse } from "../model/types";

/**
 * GET /subscription. 구독이 없으면 백엔드가 404(SubscriptionNotFound)를 반환하므로 이를 에러가 아닌
 * "구독 없음(null)" 상태로 변환한다. null 이면 요금제/등록 CTA 를 보여준다.
 */
export function useSubscription(workspaceId: number | null) {
  const enabled = workspaceId !== null;
  const wsId = workspaceId ?? 0;

  return useQuery<SubscriptionResponse | null>({
    queryKey: billingQueryKeys.subscription(wsId),
    enabled,
    retry: false,
    queryFn: async () => {
      try {
        const res = await getSubscription(wsId);
        return (selectApiData(res) ?? null) as SubscriptionResponse | null;
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 404) {
          return null;
        }
        throw error;
      }
    },
  });
}
