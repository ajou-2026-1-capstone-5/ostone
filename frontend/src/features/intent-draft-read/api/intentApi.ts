import { apiClient } from "../../../shared/api";
import type { IntentDetail, IntentSummary } from "../../../entities/intent";

export const intentApi = {
  list: (wsId: number, packId: number, versionId: number) =>
    apiClient.get<IntentSummary[]>(
      `/workspaces/${wsId}/domain-packs/${packId}/versions/${versionId}/intents`,
    ),

  detail: (wsId: number, packId: number, versionId: number, intentId: number) =>
    apiClient.get<IntentDetail>(
      `/workspaces/${wsId}/domain-packs/${packId}/versions/${versionId}/intents/${intentId}`,
    ),
};
