import { useQuery } from "@tanstack/react-query";
import { getWorkflow } from "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller";

export function useGetWorkflow(
  wsId: number,
  packId: number,
  versionId: number,
  workflowId: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["workflows", "detail", wsId, packId, versionId, workflowId] as const,
    queryFn: async () => {
      const res = await getWorkflow(wsId, packId, versionId, workflowId);
      return res.data;
    },
    enabled,
  });
}
