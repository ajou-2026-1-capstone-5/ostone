export type PolicyStatus = "ACTIVE" | "INACTIVE";

export interface PolicySummary {
  id: number;
  domainPackVersionId: number;
  policyCode: string;
  name: string;
  description: string | null;
  severity: string | null;
  status: PolicyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyDefinition extends PolicySummary {
  conditionJson: string;
  actionJson: string;
  evidenceJson: string;
  metaJson: string;
}

export interface UpdatePolicyRequest {
  name: string;
  description?: string | null;
  severity?: string | null;
  conditionJson?: string | null;
  actionJson?: string | null;
  evidenceJson?: string | null;
  metaJson?: string | null;
}

export interface UpdatePolicyStatusRequest {
  status: PolicyStatus;
}
