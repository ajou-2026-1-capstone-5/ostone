import { useListIntents } from "@/shared/api/generated/endpoints/intent-definition-controller/intent-definition-controller";
import { useListSlots } from "@/shared/api/generated/endpoints/slot-definition-controller/slot-definition-controller";
import { useListPolicies } from "@/shared/api/generated/endpoints/policy-definition-controller/policy-definition-controller";
import { useListRisks } from "@/shared/api/generated/endpoints/risk-definition-controller/risk-definition-controller";
import { useListWorkflows } from "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller";
import type { IntentSummary } from "@/entities/intent";
import type { SlotSummary as SlotSummary2 } from "@/entities/slot";
import type { PolicySummary as PolicySummary2 } from "@/entities/policy";
import type { RiskSummary as RiskSummary2 } from "@/entities/risk";
import type { WorkflowSummary as WorkflowSummary2 } from "@/entities/workflow";
import {
  intentQueryKeys,
  policyQueryKeys,
  riskQueryKeys,
  selectApiList,
  slotQueryKeys,
  workflowQueryKeys,
} from "@/shared/api";

function preview<T>(data: T[] | { data?: T[] }): T[] {
  return selectApiList<T>(data).slice(0, 5);
}

export function useIntentPreview(wsId: number, packId: number, versionId: number | null) {
  return useListIntents(wsId, packId, versionId ?? -1, {
    query: {
      enabled: versionId !== null,
      queryKey: intentQueryKeys.list(wsId, packId, versionId ?? -1),
      select: (data) => preview<IntentSummary>(data),
    },
  });
}

export function useSlotPreview(wsId: number, packId: number, versionId: number | null) {
  return useListSlots(wsId, packId, versionId ?? -1, {
    query: {
      enabled: versionId !== null,
      queryKey: slotQueryKeys.list(wsId, packId, versionId ?? -1),
      select: (data) => preview<SlotSummary2>(data),
    },
  });
}

export function usePolicyPreview(wsId: number, packId: number, versionId: number | null) {
  return useListPolicies(wsId, packId, versionId ?? -1, {
    query: {
      enabled: versionId !== null,
      queryKey: policyQueryKeys.list(wsId, packId, versionId ?? -1),
      select: (data) => preview<PolicySummary2>(data),
    },
  });
}

export function useRiskPreview(wsId: number, packId: number, versionId: number | null) {
  return useListRisks(wsId, packId, versionId ?? -1, {
    query: {
      enabled: versionId !== null,
      queryKey: riskQueryKeys.list(wsId, packId, versionId ?? -1),
      select: (data) => preview<RiskSummary2>(data),
    },
  });
}

export function useWorkflowPreview(wsId: number, packId: number, versionId: number | null) {
  return useListWorkflows(wsId, packId, versionId ?? -1, undefined, {
    query: {
      enabled: versionId !== null,
      queryKey: workflowQueryKeys.list(wsId, packId, versionId ?? -1),
      select: (data) => preview<WorkflowSummary2>(data),
    },
  });
}
