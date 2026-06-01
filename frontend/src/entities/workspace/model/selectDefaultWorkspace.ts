import type { WorkspaceResponse } from "./types";

export function selectDefaultWorkspace(
  workspaces: readonly WorkspaceResponse[],
): WorkspaceResponse | null {
  return workspaces.find((workspace) => workspace.status === "ACTIVE") ?? workspaces[0] ?? null;
}
