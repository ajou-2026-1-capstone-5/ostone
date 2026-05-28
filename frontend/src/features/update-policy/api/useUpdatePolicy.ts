import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { updatePolicy } from "@/shared/api/generated/endpoints/update-policy-controller/update-policy-controller";
import type { PolicyDefinitionSummary, UpdatePolicyRequest } from "@/shared/api/generated/zod";
import { ApiRequestError, policyQueryKeys, selectApiData } from "@/shared/api";
import { POLICY_ERROR_MESSAGES } from "./messages";

interface UpdatePolicyParams {
  workspaceId: number;
  packId: number;
  versionId: number;
  policyId: number;
  body: UpdatePolicyRequest;
}

export function useUpdatePolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId, packId, versionId, policyId, body }: UpdatePolicyParams) => {
      const res = await updatePolicy(workspaceId, packId, versionId, policyId, body);
      return selectApiData(res);
    },
    onSuccess: (updatedPolicy, { workspaceId, packId, versionId, policyId }) => {
      if (!updatedPolicy) return;
      queryClient.setQueryData(
        policyQueryKeys.detail(workspaceId, packId, versionId, policyId),
        updatedPolicy,
      );
      queryClient.setQueryData<PolicyDefinitionSummary[]>(
        policyQueryKeys.list(workspaceId, packId, versionId),
        (old) =>
          old?.map((item) =>
            item.id === policyId
              ? {
                  ...item,
                  name: updatedPolicy.name,
                  description: updatedPolicy.description,
                  severity: updatedPolicy.severity,
                  status: updatedPolicy.status,
                  updatedAt: updatedPolicy.updatedAt,
                }
              : item,
          ),
      );
      toast.success("정책이 수정되었습니다.");
    },
    onError: (error: unknown) => {
      if (error instanceof ApiRequestError) {
        if (error.code === "POLICY_NOT_EDITABLE") {
          toast.error(POLICY_ERROR_MESSAGES.POLICY_NOT_EDITABLE);
          return;
        }
        if (error.code === "VALIDATION_ERROR") {
          toast.error(POLICY_ERROR_MESSAGES.VALIDATION_ERROR);
          return;
        }
      }
      toast.error(POLICY_ERROR_MESSAGES.UPDATE_FAILED);
    },
  });
}
