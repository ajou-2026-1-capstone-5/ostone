import { ApiRequestError } from "@/shared/api";

export type WorkspaceStatus = "ACTIVE" | "ARCHIVED";
export type WorkspaceMemberRole = "OWNER" | "ADMIN" | "REVIEWER" | "OPERATOR";
const WORKSPACE_MEMBER_ROLES = ["OWNER", "ADMIN", "REVIEWER", "OPERATOR"] as const;

export interface WorkspaceResponse {
  id: number;
  workspaceKey: string;
  name: string;
  description: string | null;
  status: WorkspaceStatus;
  myRole: WorkspaceMemberRole;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkspaceRequest {
  workspaceKey: string;
  name: string;
  description?: string;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  description?: string | null;
}

export interface WorkspaceFieldErrors {
  workspaceKey?: string;
  name?: string;
  description?: string;
}

export const WORKSPACE_KEY_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export function validateCreateWorkspaceForm(
  name: string,
  description: string,
): WorkspaceFieldErrors {
  const errors: WorkspaceFieldErrors = {};

  if (!name.trim()) {
    errors.name = "이름을 입력해주세요.";
  } else if (name.length > 255) {
    errors.name = "이름은 255자 이하여야 합니다.";
  }

  if (description.length > 2000) {
    errors.description = "설명은 2000자 이하여야 합니다.";
  }

  return errors;
}

export function generateWorkspaceKey(name: string): string {
  const normalizedBase = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  const base = normalizedBase.length >= 3 ? normalizedBase : "workspace";
  const suffix = Math.random().toString(36).slice(2, 8);
  const limitedBase = base.slice(0, Math.max(3, 100 - suffix.length - 1)).replace(/-+$/g, "") || "workspace";

  return `${limitedBase}-${suffix}`;
}

export function normalizeWorkspaceMemberRole(role: string | null | undefined): WorkspaceMemberRole | null {
  if (!role) {
    return null;
  }

  const normalized = role.trim().toUpperCase().replace(/^ROLE_/, "");
  return WORKSPACE_MEMBER_ROLES.find((candidate) => candidate === normalized) ?? null;
}

export function validateUpdateWorkspaceForm(
  name: string,
  description: string,
): WorkspaceFieldErrors {
  const errors: WorkspaceFieldErrors = {};

  if (!name.trim()) {
    errors.name = "이름을 입력해주세요.";
  } else if (name.length > 255) {
    errors.name = "이름은 255자 이하여야 합니다.";
  }

  if (description.length > 2000) {
    errors.description = "설명은 2000자 이하여야 합니다.";
  }

  return errors;
}

export function mapWorkspaceActionError(error: unknown): string {
  if (!(error instanceof ApiRequestError)) {
    return "서버에 연결할 수 없습니다.";
  }

  switch (error.code) {
    case "WORKSPACE_KEY_CONFLICT":
      return "이미 사용 중인 워크스페이스 키입니다.";
    case "WORKSPACE_INVALID_KEY":
      return "워크스페이스 키 형식이 올바르지 않습니다.";
    case "WORKSPACE_NOT_FOUND":
      return "워크스페이스를 찾을 수 없습니다.";
    case "WORKSPACE_ACCESS_DENIED":
      return "접근 권한이 없습니다.";
    default:
      return error.message || "요청 처리 중 오류가 발생했습니다.";
  }
}
