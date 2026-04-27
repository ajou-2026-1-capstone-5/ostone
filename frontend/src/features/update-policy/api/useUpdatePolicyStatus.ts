import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { policyApi, policyKeys } from "@/entities/policy";
import type { PolicyDefinition, PolicyStatus, PolicySummary } from "@/entities/policy";
import { ApiRequestError } from "@/shared/api";
import { POLICY_ERROR_MESSAGES } from "./messages";

interface UpdatePolicyStatusParams {
  workspaceId: number;
  packId: number;
  versionId: number;
  policyId: number;
  status: PolicyStatus;
}

export const UPDATE_POLICY_STATUS_MUTATION_KEY = ["updatePolicyStatus"] as const;

export function useUpdatePolicyStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: UPDATE_POLICY_STATUS_MUTATION_KEY,
    mutationFn: ({ workspaceId, packId, versionId, policyId, status }: UpdatePolicyStatusParams) =>
      policyApi.updateStatus(workspaceId, packId, versionId, policyId, { status }),
    onMutate: async ({ workspaceId, packId, versionId, policyId, status }) => {
      const detailKey = policyKeys.detail(workspaceId, packId, versionId, policyId);
      const listKey = policyKeys.list(workspaceId, packId, versionId);

      await queryClient.cancelQueries({ queryKey: detailKey });
      await queryClient.cancelQueries({ queryKey: listKey });

      const previousDetail = queryClient.getQueryData<PolicyDefinition>(detailKey);
      const previousList = queryClient.getQueryData<PolicySummary[]>(listKey);

      queryClient.setQueryData<PolicyDefinition>(detailKey, (old) =>
        old ? { ...old, status } : old,
      );
      queryClient.setQueryData<PolicySummary[]>(listKey, (old) =>
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
        policyKeys.detail(workspaceId, packId, versionId, policyId),
        updatedPolicy,
      );
      queryClient.setQueryData<PolicySummary[]>(
        policyKeys.list(workspaceId, packId, versionId),
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
