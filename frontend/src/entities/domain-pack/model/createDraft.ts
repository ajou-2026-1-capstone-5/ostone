import type { DomainPackLifecycleStatus } from './types';

export interface IntentSlotBindingRequest {
  intentCode: string;
  slotCode: string;
}

export interface IntentWorkflowBindingRequest {
  intentCode: string;
  workflowCode: string;
}

export interface CreateDomainPackDraftRequest {
  summaryJson?: string | null;
  intents?: unknown[];
  slots?: unknown[];
  policies?: unknown[];
  risks?: unknown[];
  workflows?: unknown[];
  intentSlotBindings?: IntentSlotBindingRequest[];
  intentWorkflowBindings?: IntentWorkflowBindingRequest[];
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
