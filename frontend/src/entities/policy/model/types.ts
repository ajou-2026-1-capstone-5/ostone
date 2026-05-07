export type PolicyStatus = "ACTIVE" | "INACTIVE";

export type {
  PolicyDefinitionResponse as PolicyDefinition,
  PolicyDefinitionSummary as PolicySummary,
  UpdatePolicyRequest,
  UpdatePolicyStatusRequest,
} from "@/shared/api/generated/zod";
