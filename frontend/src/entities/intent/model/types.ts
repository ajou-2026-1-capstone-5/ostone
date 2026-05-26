export type {
  IntentDefinitionDetail as IntentDetail,
  IntentDefinitionSummary as IntentSummary,
} from "@/shared/api/generated/zod";

import type { IntentDefinitionSummary } from "@/shared/api/generated/zod";

export interface IntentTreeNode extends IntentDefinitionSummary {
  children: IntentTreeNode[];
}

export type IntentListState =
  | { status: "loading" }
  | { status: "error"; code: string; message: string; httpStatus?: number }
  | { status: "ready"; data: IntentDefinitionSummary[] };
