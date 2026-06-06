import { selectDefaultWorkspace } from "@/entities/workspace";
import { selectApiData } from "@/shared/api";
import { listWorkspaces } from "@/shared/api/generated/endpoints/workspace-controller/workspace-controller";
import type { WorkspaceResponse } from "@/shared/api/generated/zod";
import { isSuperAdminRole } from "@/shared/lib/auth";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import {
  DEFAULT_POST_LOGIN_PATH,
  resolveReturnToPostLoginDestination,
} from "./resolvePostLoginDestination";

const WORKSPACE_ROUTE_PREFIX = `${DEFAULT_POST_LOGIN_PATH}/`;

async function listCurrentWorkspaces(): Promise<WorkspaceResponse[] | null> {
  try {
    const response = await listWorkspaces();
    return selectApiData<WorkspaceResponse[]>(response) ?? [];
  } catch {
    return null;
  }
}

function resolveDefaultWorkspaceDestination(workspaces: readonly WorkspaceResponse[]): string {
  const workspace = selectDefaultWorkspace(workspaces);

  return typeof workspace?.id === "number"
    ? `/workspaces/${workspace.id}/workflows`
    : DEFAULT_POST_LOGIN_PATH;
}

function getWorkspaceDestinationId(destination: string): number | null {
  if (!destination.startsWith(WORKSPACE_ROUTE_PREFIX)) {
    return null;
  }

  const workspaceIdSegment = destination.slice(WORKSPACE_ROUTE_PREFIX.length).split(/[/?#]/)[0];
  return parseRouteId(workspaceIdSegment);
}

function isWorkspaceRootDestination(destination: string): boolean {
  return (
    destination === DEFAULT_POST_LOGIN_PATH || destination.startsWith(`${DEFAULT_POST_LOGIN_PATH}?`)
  );
}

function canUseWorkspaceDestination(
  destination: string,
  workspaces: readonly WorkspaceResponse[],
): boolean {
  if (isWorkspaceRootDestination(destination)) {
    return true;
  }

  const workspaceId = getWorkspaceDestinationId(destination);
  return workspaceId !== null && workspaces.some((workspace) => workspace.id === workspaceId);
}

export async function resolveDefaultPostLoginDestination(role?: string | null): Promise<string> {
  if (isSuperAdminRole(role)) {
    return "/admin";
  }

  const workspaces = await listCurrentWorkspaces();
  if (workspaces === null) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  return resolveDefaultWorkspaceDestination(workspaces);
}

export async function resolveAuthenticatedPostLoginDestination(
  state: unknown,
  role?: string | null,
): Promise<string> {
  const returnToDestination = resolveReturnToPostLoginDestination(state);

  if (isSuperAdminRole(role)) {
    return returnToDestination?.startsWith("/admin") ? returnToDestination : "/admin";
  }

  if (returnToDestination !== null && !returnToDestination.startsWith("/admin")) {
    if (!returnToDestination.startsWith(DEFAULT_POST_LOGIN_PATH)) {
      return returnToDestination;
    }

    const workspaces = await listCurrentWorkspaces();
    if (workspaces === null) {
      return DEFAULT_POST_LOGIN_PATH;
    }

    return canUseWorkspaceDestination(returnToDestination, workspaces)
      ? returnToDestination
      : resolveDefaultWorkspaceDestination(workspaces);
  }

  return resolveDefaultPostLoginDestination(role);
}
