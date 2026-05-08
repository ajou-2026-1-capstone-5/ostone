export type RiskStatus = "ACTIVE" | "INACTIVE";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type {
  RiskDefinitionResponse as RiskDefinition,
  RiskDefinitionSummary as RiskSummary,
  UpdateRiskRequest,
  UpdateRiskStatusRequest,
} from "@/shared/api/generated/zod";
