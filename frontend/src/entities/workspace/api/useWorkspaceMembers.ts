import { useQuery } from "@tanstack/react-query";

import { listWorkspaceMembers } from "@/shared/api/generated/endpoints/workspace-controller/workspace-controller";
import { selectApiList } from "@/shared/api/apiResponse";
import { workspaceMemberQueryKeys } from "@/shared/api/queryKeys";

import type { WorkspaceMemberResponse, WorkspaceMemberRole } from "../model/types";

interface UseWorkspaceMembersParams {
  workspaceId: number | null;
  search: string;
  role: WorkspaceMemberRole | "";
}

function buildWorkspaceMemberParams(
  search: string,
  role: WorkspaceMemberRole | "",
): { q?: string; role?: WorkspaceMemberRole } | undefined {
  const trimmedSearch = search.trim();
  const params: { q?: string; role?: WorkspaceMemberRole } = {};

  if (trimmedSearch) {
    params.q = trimmedSearch;
  }
  if (role) {
    params.role = role;
  }

  return Object.keys(params).length > 0 ? params : undefined;
}

export function useWorkspaceMembers({ workspaceId, search, role }: UseWorkspaceMembersParams) {
  const enabled = workspaceId !== null;
  const wsId = workspaceId ?? 0;
  const trimmedSearch = search.trim();
  const params = buildWorkspaceMemberParams(search, role);

  return useQuery({
    queryKey: workspaceMemberQueryKeys.list(wsId, trimmedSearch, role),
    enabled,
    queryFn: async () => {
      const response = await listWorkspaceMembers(wsId, params);
      return selectApiList(response) as WorkspaceMemberResponse[];
    },
  });
}
