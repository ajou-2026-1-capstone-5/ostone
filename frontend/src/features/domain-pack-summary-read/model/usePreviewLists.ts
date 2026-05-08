import { useListIntents } from '@/shared/api/generated/endpoints/intent-definition-controller/intent-definition-controller';
import { useListSlots } from '@/shared/api/generated/endpoints/slot-definition-controller/slot-definition-controller';
import { useListPolicies } from '@/shared/api/generated/endpoints/policy-definition-controller/policy-definition-controller';
import { useListRisks } from '@/shared/api/generated/endpoints/risk-definition-controller/risk-definition-controller';
import { useListWorkflows } from '@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller';
import type { IntentSummary } from '@/entities/intent';
import type { SlotSummary as SlotSummary2 } from '@/entities/slot';
import type { PolicySummary as PolicySummary2 } from '@/entities/policy';
import type { RiskSummary as RiskSummary2 } from '@/entities/risk';
import type { WorkflowSummary as WorkflowSummary2 } from '@/entities/workflow';

export function useIntentPreview(wsId: number, packId: number, versionId: number | null) {
  return useListIntents(wsId, packId, versionId ?? -1, {
    query: {
      enabled: versionId !== null,
      select: (data: { data: IntentSummary[] }) => data.data.slice(0, 5),
    },
  });
}

export function useSlotPreview(wsId: number, packId: number, versionId: number | null) {
  return useListSlots(wsId, packId, versionId ?? -1, {
    query: {
      enabled: versionId !== null,
      select: (data: { data: SlotSummary2[] }) => data.data.slice(0, 5),
    },
  });
}

export function usePolicyPreview(wsId: number, packId: number, versionId: number | null) {
  return useListPolicies(wsId, packId, versionId ?? -1, {
    query: {
      enabled: versionId !== null,
      select: (data: { data: PolicySummary2[] }) => data.data.slice(0, 5),
    },
  });
}

export function useRiskPreview(wsId: number, packId: number, versionId: number | null) {
  return useListRisks(wsId, packId, versionId ?? -1, {
    query: {
      enabled: versionId !== null,
      select: (data: { data: RiskSummary2[] }) => data.data.slice(0, 5),
    },
  });
}

export function useWorkflowPreview(wsId: number, packId: number, versionId: number | null) {
  return useListWorkflows(wsId, packId, versionId ?? -1, {
    query: {
      enabled: versionId !== null,
      select: (data: { data: WorkflowSummary2[] }) => data.data.slice(0, 5),
    },
  });
}