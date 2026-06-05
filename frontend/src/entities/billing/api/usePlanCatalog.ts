import { useQuery } from "@tanstack/react-query";

import { listPlans } from "@/shared/api/generated/endpoints/plan-catalog-controller/plan-catalog-controller";
import type { PlanCatalogResponse } from "@/shared/api/generated/zod";
import { billingQueryKeys, selectApiList } from "@/shared/api";

import type { PlanCatalogEntry } from "../model/plans";

function normalize(raw: PlanCatalogResponse): PlanCatalogEntry {
  return {
    planKey: raw.planKey ?? "",
    name: raw.name ?? "",
    amount: raw.amount ?? 0,
    currency: raw.currency ?? "KRW",
    interval: raw.interval ?? "MONTH",
    memberLimit: raw.memberLimit ?? 0,
    datasetUploadLimit: raw.datasetUploadLimit ?? 0,
    pipelineRunHourlyLimit: raw.pipelineRunHourlyLimit ?? 0,
    contactOnly: raw.contactOnly ?? false,
    unlimited: raw.unlimited ?? false,
  };
}

/** GET /api/v1/plans. 활성 요금제 카탈로그를 카드 렌더용으로 정규화하여 조회한다. */
export function usePlanCatalog() {
  return useQuery<PlanCatalogEntry[]>({
    queryKey: billingQueryKeys.plans(),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const res = await listPlans();
      return selectApiList<PlanCatalogResponse>(res).map(normalize);
    },
  });
}
