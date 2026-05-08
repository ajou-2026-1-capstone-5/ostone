import {
  getWorkflow,
  listWorkflows,
} from "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller";

export const workflowApi = {
  list: async (wsId: number, packId: number, versionId: number) => {
    const res = await listWorkflows(wsId, packId, versionId);
    return res.data;
  },

  detail: async (wsId: number, packId: number, versionId: number, workflowId: number) => {
    const res = await getWorkflow(wsId, packId, versionId, workflowId);
    return res.data;
  },
};
