import { apiClient } from "@/shared/api";
import type {
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  WorkspaceResponse,
} from "@/entities/workspace/model/types";

export const workspaceApi = {
  list: () => apiClient.get<WorkspaceResponse[]>("/workspaces"),
  get: (workspaceId: number) => apiClient.get<WorkspaceResponse>(`/workspaces/${workspaceId}`),
  create: (payload: CreateWorkspaceRequest) =>
    apiClient.post<WorkspaceResponse>("/workspaces", payload),
  update: (workspaceId: number, payload: UpdateWorkspaceRequest) =>
    apiClient.patch<WorkspaceResponse>(`/workspaces/${workspaceId}`, payload),
  archive: (workspaceId: number) => apiClient.delete<void>(`/workspaces/${workspaceId}`),
};
