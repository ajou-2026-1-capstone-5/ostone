import { useQueries, useQuery } from '@tanstack/react-query';
import {
  getDomainPack,
  getListDomainPacksQueryOptions,
  listDomainPacks,
} from '@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller';
import { listWorkflows } from '@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller';
import { unwrapApiResponse } from '@/shared/api/unwrapApiResponse';
import type {
  DomainPackDetailResult,
  DomainPackSummaryResult,
  WorkflowDefinitionSummary,
} from '@/shared/api/generated/zod';
import type { SidebarTreeData, SidebarTreePack } from './Sidebar';

interface UseSidebarTreeDataParams {
  workspaceId: number | null;
  enabled: boolean;
}

interface PackVersionPair {
  pack: DomainPackSummaryResult;
  versionId: number | null;
}

/** Pick the latest version (highest versionNo) — newest assumed first when no versionNo. */
function pickLatestVersionId(detail: DomainPackDetailResult | undefined): number | null {
  if (!detail?.versions || detail.versions.length === 0) return null;
  const sorted = [...detail.versions].sort((a, b) => (b.versionNo ?? 0) - (a.versionNo ?? 0));
  return sorted[0]?.versionId ?? null;
}

export function useSidebarTreeData({ workspaceId, enabled }: UseSidebarTreeDataParams): SidebarTreeData {
  const wsId = workspaceId ?? 0;
  const isEnabled = enabled && workspaceId !== null;

  const packsQuery = useQuery({
    ...getListDomainPacksQueryOptions(wsId, { query: { enabled: isEnabled } }),
    queryFn: async ({ signal }) => listDomainPacks(wsId, { signal }),
  });

  const packs = (unwrapApiResponse<DomainPackSummaryResult[]>(packsQuery.data) ?? []).filter(
    (p): p is DomainPackSummaryResult & { packId: number } => typeof p.packId === 'number',
  );

  const packDetailQueries = useQueries({
    queries: packs.map((pack) => ({
      queryKey: ['sidebar-tree', 'pack-detail', wsId, pack.packId] as const,
      queryFn: async ({ signal }: { signal?: AbortSignal }) =>
        getDomainPack(wsId, pack.packId, { signal }),
      enabled: isEnabled,
    })),
  });

  const packVersionPairs: PackVersionPair[] = packs.map((pack, idx) => {
    const detail = unwrapApiResponse<DomainPackDetailResult>(packDetailQueries[idx]?.data);
    return { pack, versionId: pickLatestVersionId(detail) };
  });

  const workflowQueries = useQueries({
    queries: packVersionPairs.map((pair) => ({
      queryKey: ['sidebar-tree', 'workflows', wsId, pair.pack.packId, pair.versionId ?? 0] as const,
      queryFn: async ({ signal }: { signal?: AbortSignal }) =>
        pair.versionId !== null
          ? listWorkflows(wsId, pair.pack.packId!, pair.versionId, { signal })
          : Promise.resolve(undefined as never),
      enabled: isEnabled && pair.versionId !== null,
    })),
  });

  const loading =
    packsQuery.isLoading ||
    packDetailQueries.some((q) => q.isLoading) ||
    workflowQueries.some((q) => q.isLoading);

  const error = packsQuery.isError
    ? '도메인팩 목록 조회 실패'
    : packDetailQueries.find((q) => q.isError)
      ? '도메인팩 상세 조회 실패'
      : workflowQueries.find((q) => q.isError)
        ? '워크플로우 목록 조회 실패'
        : null;

  const treePacks: SidebarTreePack[] = packVersionPairs.map((pair, idx) => {
    const wfList = unwrapApiResponse<WorkflowDefinitionSummary[]>(workflowQueries[idx]?.data) ?? [];
    const workflows = wfList
      .filter((wf): wf is WorkflowDefinitionSummary & { id: number } => typeof wf.id === 'number')
      .map((wf) => ({
        id: wf.id,
        name: wf.name || wf.workflowCode || `wf-${wf.id}`,
      }));
    return {
      packId: pair.pack.packId!,
      name: pair.pack.name || `pack-${pair.pack.packId}`,
      versionId: pair.versionId,
      workflows,
    };
  });

  return {
    loading,
    error,
    packs: treePacks,
  };
}
