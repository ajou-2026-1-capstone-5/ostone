import type { DomainPackLifecycleStatus } from "./types";

export interface IntentSlotBindingRequest {
  intentCode: string;
  slotCode: string;
}

export interface WorkflowDraftRequest {
  workflowCode: string;
  name: string;
  description?: string | null;
  graphJson: string;
  intentCode: string;
  isPrimary?: boolean | null;
  routeConditionJson?: string | null;
  evidenceJson?: string | null;
  metaJson?: string | null;
}

export interface CreateDomainPackDraftRequest {
  summaryJson?: string | null;
  intents?: unknown[];
  slots?: unknown[];
  policies?: unknown[];
  risks?: unknown[];
  workflows?: WorkflowDraftRequest[];
  intentSlotBindings?: IntentSlotBindingRequest[];
  sourcePipelineJobId?: number | null;
}

export interface CreateDomainPackDraftResponse {
  versionId: number;
  domainPackId: number;
  versionNo: number;
  lifecycleStatus: DomainPackLifecycleStatus;
  sourcePipelineJobId: number | null;
  intentCount: number;
  slotCount: number;
  policyCount: number;
  riskCount: number;
  workflowCount: number;
  createdAt: string;
}
