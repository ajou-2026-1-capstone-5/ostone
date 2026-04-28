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
