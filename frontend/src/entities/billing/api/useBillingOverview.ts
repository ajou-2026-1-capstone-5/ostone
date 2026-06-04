import { useQuery } from "@tanstack/react-query";

import { getBillingOverview } from "@/shared/api/generated/endpoints/billing-overview-controller/billing-overview-controller";
import { billingQueryKeys, selectApiData } from "@/shared/api";

import type { BillingOverviewResponse } from "../model/types";

/** GET /billing/overview. 구독, 결제수단, 결제내역, quota 사용량을 한 화면용으로 조회한다. */
export function useBillingOverview(workspaceId: number | null) {
  const enabled = workspaceId !== null;
  const wsId = workspaceId ?? 0;

  return useQuery<BillingOverviewResponse>({
    queryKey: billingQueryKeys.overview(wsId),
    enabled,
    retry: false,
    queryFn: async () => {
      const res = await getBillingOverview(wsId);
      return (selectApiData(res) ?? {
        subscription: null,
        billingKey: null,
        payments: [],
        quotaUsages: [],
      }) as BillingOverviewResponse;
    },
  });
}
