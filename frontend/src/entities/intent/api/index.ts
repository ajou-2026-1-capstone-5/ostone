import { apiClient } from "@/shared/api";
import type { IntentSummary } from "../model/types";

export const intentKeys = {
  all: ['intents'] as const,
  list: (wsId: number, packId: number, versionId: number) =>
    [...intentKeys.all, 'list', wsId, packId, versionId] as const,
};

export const intentApi = {
  list: (wsId: number, packId: number, versionId: number) =>
    apiClient.get<IntentSummary[]>(
      `/workspaces/${wsId}/domain-packs/${packId}/versions/${versionId}/intents`,
    ),
};
