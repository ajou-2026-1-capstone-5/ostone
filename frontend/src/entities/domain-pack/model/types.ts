export interface DomainPackDraftEntryResponse {
  workspaceId: number;
  packId: number;
  versionId: number;
  packName: string;
  versionNo: number;
}

export type DomainPackLifecycleStatus = 'DRAFT' | 'PUBLISHED';

export interface DomainPackVersionSummary {
  versionId: number;
  versionNo: number;
  lifecycleStatus: DomainPackLifecycleStatus;
  sourcePipelineJobId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DomainPackDetail {
  packId: number;
  workspaceId: number;
  code: string;
  name: string;
  description: string | null;
  versions: DomainPackVersionSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface DomainPackVersionDetail {
  versionId: number;
  packId: number;
  versionNo: number;
  lifecycleStatus: DomainPackLifecycleStatus;
  sourcePipelineJobId: number | null;
  summaryJson: string;
  intentCount: number;
  slotCount: number;
  policyCount: number;
  riskCount: number;
  workflowCount: number;
  createdAt: string;
  updatedAt: string;
}
