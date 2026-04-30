import { useQuery } from '@tanstack/react-query';
import { intentApi, intentKeys } from '@/entities/intent';
import { slotApi, slotKeys } from '@/entities/slot';
import { policyApi, policyKeys } from '@/entities/policy';
import { riskApi, riskKeys } from '@/entities/risk';
import { fetchWorkflowList, workflowQueryKeys } from '@/entities/workflow';

export function useIntentPreview(wsId: number, packId: number, versionId: number | null) {
  return useQuery({
    queryKey: intentKeys.list(wsId, packId, versionId ?? -1),
    queryFn: () => intentApi.list(wsId, packId, versionId!),
    enabled: versionId !== null,
    select: (data) => data.slice(0, 5),
  });
}

export function useSlotPreview(wsId: number, packId: number, versionId: number | null) {
  return useQuery({
    queryKey: slotKeys.list(wsId, packId, versionId ?? -1),
    queryFn: () => slotApi.list(wsId, packId, versionId!),
    enabled: versionId !== null,
    select: (data) => data.slice(0, 5),
  });
}

export function usePolicyPreview(wsId: number, packId: number, versionId: number | null) {
  return useQuery({
    queryKey: policyKeys.list(wsId, packId, versionId ?? -1),
    queryFn: () => policyApi.list(wsId, packId, versionId!),
    enabled: versionId !== null,
    select: (data) => data.slice(0, 5),
  });
}

export function useRiskPreview(wsId: number, packId: number, versionId: number | null) {
  return useQuery({
    queryKey: riskKeys.list(wsId, packId, versionId ?? -1),
    queryFn: () => riskApi.list(wsId, packId, versionId!),
    enabled: versionId !== null,
    select: (data) => data.slice(0, 5),
  });
}

export function useWorkflowPreview(wsId: number, packId: number, versionId: number | null) {
  return useQuery({
    queryKey: workflowQueryKeys.list(wsId, packId, versionId ?? -1),
    queryFn: () => fetchWorkflowList(wsId, packId, versionId!),
    enabled: versionId !== null,
    select: (data) => data.slice(0, 5),
  });
}
