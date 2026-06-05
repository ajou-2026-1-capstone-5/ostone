import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { updatePolicyStatus } from "@/shared/api/generated/endpoints/update-policy-status-controller/update-policy-status-controller";
import type {
  PolicyDefinitionResponse,
  PolicyDefinitionSummary,
  UpdatePolicyStatusRequest,
} from "@/shared/api/generated/zod";
import { ApiRequestError, policyQueryKeys, requireApiData } from "@/shared/api";
import { POLICY_ERROR_MESSAGES } from "./messages";

interface UpdatePolicyStatusParams {
  workspaceId: number;
  packId: number;
  versionId: number;
  policyId: number;
  status: UpdatePolicyStatusRequest["status"];
}

type PolicyListCache =
  | PolicyDefinitionSummary[]
  | ({ data?: PolicyDefinitionSummary[] } & Record<string, unknown>);

type PolicyStatusPatch = Pick<PolicyDefinitionSummary, "status"> &
  Partial<Pick<PolicyDefinitionSummary, "updatedAt">>;

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
      return requireApiData<PolicyDefinitionResponse>(
        res,
        "응대 기준 상태 변경 응답을 확인할 수 없습니다.",
      );
    },
    onMutate: async ({ workspaceId, packId, versionId, policyId, status }) => {
      const detailKey = policyQueryKeys.detail(workspaceId, packId, versionId, policyId);
      const listKey = policyQueryKeys.list(workspaceId, packId, versionId);

      await queryClient.cancelQueries({ queryKey: detailKey });
      await queryClient.cancelQueries({ queryKey: listKey });

      const previousDetail = queryClient.getQueryData<PolicyDefinitionResponse>(detailKey);
      const previousList = queryClient.getQueryData<PolicyListCache>(listKey);

      queryClient.setQueryData<PolicyDefinitionResponse>(detailKey, (old) =>
        old ? { ...old, status } : old,
      );
      queryClient.setQueryData<PolicyListCache>(listKey, (old) =>
        updatePolicyStatusListCache(old, policyId, { status }),
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
        policyQueryKeys.detail(workspaceId, packId, versionId, policyId),
        updatedPolicy,
      );
      queryClient.setQueryData<PolicyListCache>(
        policyQueryKeys.list(workspaceId, packId, versionId),
        (old) => updatePolicyStatusListCache(old, policyId, updatedPolicy),
      );
    },
  });
}

function updatePolicyStatusListCache<T extends PolicyListCache | undefined>(
  old: T,
  policyId: number,
  patch: PolicyStatusPatch,
): T {
  const updateItem = (item: PolicyDefinitionSummary): PolicyDefinitionSummary =>
    item.id === policyId
      ? {
          ...item,
          status: patch.status,
          updatedAt: patch.updatedAt ?? item.updatedAt,
        }
      : item;

  if (Array.isArray(old)) {
    return old.map(updateItem) as T;
  }

  if (old && typeof old === "object" && Array.isArray(old.data)) {
    return { ...old, data: old.data.map(updateItem) } as T;
  }

  return old;
}
