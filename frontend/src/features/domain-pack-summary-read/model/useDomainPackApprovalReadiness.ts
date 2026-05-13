import type { DomainPackVersionDetail, DomainPackVersionSummary } from "@/entities/domain-pack";
import { unwrapApiResponse } from "@/shared/api";
import { useListIntents } from "@/shared/api/generated/endpoints/intent-definition-controller/intent-definition-controller";
import type { IntentDefinitionSummary } from "@/shared/api/generated/zod";
import {
  buildDomainPackApprovalReadiness,
  type DomainPackApprovalReadiness,
} from "./buildDomainPackApprovalReadiness";

interface UseDomainPackApprovalReadinessParams {
  workspaceId: number;
  packId: number;
  version?: DomainPackVersionDetail;
  versions: DomainPackVersionSummary[];
}

export function useDomainPackApprovalReadiness({
  workspaceId,
  packId,
  version,
  versions,
}: UseDomainPackApprovalReadinessParams): DomainPackApprovalReadiness {
  const versionId = version?.versionId;
  const intentActionPath =
    versionId == null
      ? undefined
      : `/workspaces/${workspaceId}/domain-packs/${packId}/versions/${versionId}/intents`;
  const shouldLoadIntents =
    version?.lifecycleStatus === "DRAFT" &&
    versionId != null &&
    isSelectedVersionLatest(version, versions);

  const intentQuery = useListIntents<IntentDefinitionSummary[] | undefined>(
    workspaceId,
    packId,
    versionId ?? -1,
    {
      query: {
        enabled: shouldLoadIntents,
        select: (res) => unwrapApiResponse<IntentDefinitionSummary[]>(res),
      },
    },
  );

  if (shouldLoadIntents && intentQuery.isLoading) {
    return {
      ready: false,
      isLoading: true,
      isError: false,
      blockers: [],
      retry: () => {
        void intentQuery.refetch();
      },
    };
  }

  if (shouldLoadIntents && intentQuery.isError) {
    return {
      ready: false,
      isLoading: false,
      isError: true,
      blockers: [
        {
          type: "SERVER",
          message: "승인 준비 상태를 확인하지 못했습니다.",
        },
      ],
      retry: () => {
        void intentQuery.refetch();
      },
    };
  }

  const readiness = buildDomainPackApprovalReadiness({
    version,
    versions,
    intents: shouldLoadIntents ? intentQuery.data : [],
    intentActionPath,
  });

  return {
    ...readiness,
    isLoading: false,
    isError: false,
    retry: () => {
      void intentQuery.refetch();
    },
  };
}

function isSelectedVersionLatest(
  version: DomainPackVersionDetail,
  versions: DomainPackVersionSummary[],
): boolean {
  if (version.versionNo == null) return false;

  const versionNos = versions
    .map((candidate) => candidate.versionNo)
    .filter((versionNo): versionNo is number => versionNo != null);

  if (versionNos.length === 0) return false;

  return version.versionNo === Math.max(...versionNos);
}
