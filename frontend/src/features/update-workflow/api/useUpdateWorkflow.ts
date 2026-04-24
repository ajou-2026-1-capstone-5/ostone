import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { workflowKeys, patchWorkflow } from "@/entities/workflow";
import type { UpdateWorkflowRequest } from "@/entities/workflow";
import { ApiRequestError } from "@/shared/api";

interface UpdateWorkflowParams {
  wsId: number;
  packId: number;
  versionId: number;
  workflowId: number;
  body: UpdateWorkflowRequest;
}

const ERROR_MESSAGES: Record<string, string> = {
  WORKFLOW_NOT_EDITABLE: "DRAFT 상태의 버전에서만 수정할 수 있습니다.",
  GRAPH_JSON_TOO_LARGE: "그래프 데이터가 너무 큽니다.",
  WORKFLOW_INVALID_START_NODE: "START 노드가 정확히 1개여야 합니다.",
  WORKFLOW_INVALID_TERMINAL_NODE: "TERMINAL 노드가 최소 1개 필요합니다.",
  WORKFLOW_DANGLING_EDGE: "엣지의 연결 대상 노드가 존재하지 않습니다.",
  WORKFLOW_UNREACHABLE_NODE: "모든 노드가 START에서 도달 가능해야 합니다.",
  WORKFLOW_CYCLE_DETECTED: "그래프에 순환 경로가 있습니다.",
  WORKFLOW_UNLABELED_BRANCH: "DECISION 노드의 모든 분기에 label이 필요합니다.",
  WORKFLOW_ACTION_NODE_POLICY_REF_MISSING: "ACTION 노드의 policyRef 값이 필요합니다.",
  WORKFLOW_ACTION_NODE_POLICY_REF_INVALID_CHARS: "ACTION 노드의 policyRef 형식이 유효하지 않습니다.",
  WORKFLOW_ACTION_NODE_POLICY_REF_NOT_FOUND: "ACTION 노드의 policyRef가 이 버전에 존재하지 않습니다.",
  WORKFLOW_EDGE_ID_MISSING: "그래프 구조가 유효하지 않습니다.",
  WORKFLOW_EDGE_ID_DUPLICATE: "그래프 구조가 유효하지 않습니다.",
};

export function useUpdateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ wsId, packId, versionId, workflowId, body }: UpdateWorkflowParams) =>
      patchWorkflow(wsId, packId, versionId, workflowId, body),
    onSuccess: (_, { wsId, packId, versionId, workflowId }) => {
      queryClient.invalidateQueries({
        queryKey: workflowKeys.detail(wsId, packId, versionId, workflowId),
      });
      queryClient.invalidateQueries({
        queryKey: workflowKeys.list(wsId, packId, versionId),
      });
      toast.success("워크플로우가 수정되었습니다.");
    },
    onError: (error: unknown) => {
      const code = error instanceof ApiRequestError ? error.code : "";
      toast.error(ERROR_MESSAGES[code] ?? "워크플로우 수정에 실패했습니다.");
    },
  });
}
