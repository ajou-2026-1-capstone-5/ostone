export type {
  IntentDefinitionDetail as IntentDetail,
  IntentDefinitionSummary as IntentSummary,
} from "@/shared/api/generated/zod";

import type { IntentDefinitionSummary } from "@/shared/api/generated/zod";

export interface IntentTreeNode extends IntentDefinitionSummary {
  children: IntentTreeNode[];
}
