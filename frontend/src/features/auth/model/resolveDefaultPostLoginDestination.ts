import { selectDefaultWorkspace } from "@/entities/workspace";
import { selectApiData } from "@/shared/api";
import { listWorkspaces } from "@/shared/api/generated/endpoints/workspace-controller/workspace-controller";
import type { WorkspaceResponse } from "@/shared/api/generated/zod";
import { isSuperAdminRole } from "@/shared/lib/auth";
import { DEFAULT_POST_LOGIN_PATH } from "./resolvePostLoginDestination";

export async function resolveDefaultPostLoginDestination(role?: string | null): Promise<string> {
  if (isSuperAdminRole(role)) {
    return "/admin";
  }

  try {
    const response = await listWorkspaces();
    const workspaces = selectApiData<WorkspaceResponse[]>(response) ?? [];
    const workspace = selectDefaultWorkspace(workspaces);

    return typeof workspace?.id === "number"
      ? `/workspaces/${workspace.id}/workflows`
      : DEFAULT_POST_LOGIN_PATH;
  } catch {
    return DEFAULT_POST_LOGIN_PATH;
  }
}
