import { apiClient } from "@/shared/api";
import type { SlotDefinition, SlotSummary, UpdateSlotRequest, UpdateSlotStatusRequest } from "../model/types";

export const slotKeys = {
  all: ["slots"] as const,
  lists: () => [...slotKeys.all, "list"] as const,
  list: (workspaceId: number, packId: number, versionId: number) =>
    [...slotKeys.lists(), workspaceId, packId, versionId] as const,
  detail: (workspaceId: number, packId: number, versionId: number, slotId: number) =>
    [...slotKeys.all, "detail", workspaceId, packId, versionId, slotId] as const,
};

const basePath = (wsId: number, packId: number, versionId: number) =>
  `/workspaces/${wsId}/domain-packs/${packId}/versions/${versionId}/slots`;

export const slotApi = {
  list: (wsId: number, packId: number, versionId: number) =>
    apiClient.get<SlotSummary[]>(basePath(wsId, packId, versionId)),

  detail: (wsId: number, packId: number, versionId: number, slotId: number) =>
    apiClient.get<SlotDefinition>(`${basePath(wsId, packId, versionId)}/${slotId}`),

  update: (wsId: number, packId: number, versionId: number, slotId: number, body: UpdateSlotRequest) =>
    apiClient.patch<SlotDefinition>(`${basePath(wsId, packId, versionId)}/${slotId}`, body),

  updateStatus: (wsId: number, packId: number, versionId: number, slotId: number, body: UpdateSlotStatusRequest) =>
    apiClient.patch<SlotDefinition>(`${basePath(wsId, packId, versionId)}/${slotId}/status`, body),
};
