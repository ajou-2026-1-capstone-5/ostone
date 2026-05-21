import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { updatePolicyStatus } from "@/shared/api/generated/endpoints/update-policy-status-controller/update-policy-status-controller";
import type {
  PolicyDefinitionResponse,
  PolicyDefinitionSummary,
  UpdatePolicyStatusRequest,
} from "@/shared/api/generated/zod";
import { ApiRequestError } from "@/shared/api";
import { POLICY_ERROR_MESSAGES } from "./messages";

interface UpdatePolicyStatusParams {
  workspaceId: number;
  packId: number;
  versionId: number;
  policyId: number;
  status: UpdatePolicyStatusRequest["status"];
}

export const UPDATE_POLICY_STATUS_MUTATION_KEY = ["updatePolicyStatus"] as const;

export function useUpdatePolicyStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: UPDATE_POLICY_STATUS_MUTATION_KEY,
    mutationFn: async ({
      workspaceId,
      packId,
      versionId,
      policyId,
      status,
    }: UpdatePolicyStatusParams) => {
      const res = await updatePolicyStatus(workspaceId, packId, versionId, policyId, { status });
      return res.data;
    },
    onMutate: async ({ workspaceId, packId, versionId, policyId, status }) => {
      const detailKey = ["policies", "detail", workspaceId, packId, versionId, policyId] as const;
      const listKey = ["policies", "list", workspaceId, packId, versionId] as const;

      await queryClient.cancelQueries({ queryKey: detailKey });
      await queryClient.cancelQueries({ queryKey: listKey });

      const previousDetail = queryClient.getQueryData<PolicyDefinitionResponse>(detailKey);
      const previousList = queryClient.getQueryData<PolicyDefinitionSummary[]>(listKey);

      queryClient.setQueryData<PolicyDefinitionResponse>(detailKey, (old) =>
        old ? { ...old, status } : old,
      );
      queryClient.setQueryData<PolicyDefinitionSummary[]>(listKey, (old) =>
        old?.map((item) => (item.id === policyId ? { ...item, status } : item)),
      );

      return { previousDetail, previousList, detailKey, listKey };
    },
    onError: (error, _vars, context) => {
      if (context) {
        queryClient.setQueryData(context.detailKey, context.previousDetail);
        queryClient.setQueryData(context.listKey, context.previousList);
      }

      if (error instanceof ApiRequestError) {
        if (error.code === "POLICY_CODE_REFERENCED_BY_WORKFLOW") {
          toast.error(POLICY_ERROR_MESSAGES.POLICY_CODE_REFERENCED_BY_WORKFLOW);
          return;
        }
        if (error.code === "POLICY_NOT_EDITABLE") {
          toast.error(POLICY_ERROR_MESSAGES.POLICY_NOT_EDITABLE);
          return;
        }
      }

      toast.error(POLICY_ERROR_MESSAGES.STATUS_FAILED);
    },
    onSuccess: (updatedPolicy, { workspaceId, packId, versionId, policyId }) => {
      queryClient.setQueryData(
        ["policies", "detail", workspaceId, packId, versionId, policyId] as const,
        updatedPolicy,
      );
      queryClient.setQueryData<PolicyDefinitionSummary[]>(
        ["policies", "list", workspaceId, packId, versionId] as const,
        (old) =>
          old?.map((item) =>
            item.id === policyId
              ? {
                  ...item,
                  status: updatedPolicy.status,
                  updatedAt: updatedPolicy.updatedAt,
                }
              : item,
          ),
      );
    },
  });
}
