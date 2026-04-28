export type RiskStatus = "ACTIVE" | "INACTIVE";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskSummary {
  id: number;
  domainPackVersionId: number;
  riskCode: string;
  name: string;
  description: string | null;
  riskLevel: RiskLevel;
  status: RiskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RiskDefinition extends RiskSummary {
  triggerConditionJson: string;
  handlingActionJson: string;
  evidenceJson: string;
  metaJson: string;
}

export interface UpdateRiskRequest {
  name: string;
  description?: string | null;
  riskLevel: RiskLevel;
  triggerConditionJson?: string | null;
  handlingActionJson?: string | null;
  evidenceJson?: string | null;
  metaJson?: string | null;
}

export interface UpdateRiskStatusRequest {
  status: RiskStatus;
}
