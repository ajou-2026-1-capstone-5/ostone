import { useQuery } from "@tanstack/react-query";
import type { WorkflowSummary } from "@/entities/workflow";
import { workflowApi } from "../api/workflowApi";

export function useWorkflowList(wsId: number, packId: number, versionId: number) {
  return useQuery<WorkflowSummary[]>({
    queryKey: ["workflows", "list", wsId, packId, versionId] as const,
    queryFn: () => workflowApi.list(wsId, packId, versionId),
  });
}
