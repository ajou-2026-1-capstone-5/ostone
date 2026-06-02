export const domainPackQueryKeys = {
  all: ["domain-packs"] as const,
  list: (workspaceId: number) => [...domainPackQueryKeys.all, "list", workspaceId] as const,
  detail: (workspaceId: number, packId: number) =>
    [...domainPackQueryKeys.all, "detail", workspaceId, packId] as const,
  version: (workspaceId: number, packId: number, versionId: number) =>
    [...domainPackQueryKeys.all, "version", workspaceId, packId, versionId] as const,
};

export const workspaceMemberQueryKeys = {
  all: ["workspace-members"] as const,
  list: (workspaceId: number, search: string, role: string) =>
    [...workspaceMemberQueryKeys.all, "list", workspaceId, search, role] as const,
};

export const intentQueryKeys = {
  all: ["intents"] as const,
  list: (workspaceId: number, packId: number, versionId: number) =>
    [...intentQueryKeys.all, "list", workspaceId, packId, versionId] as const,
  detail: (workspaceId: number, packId: number, versionId: number, intentId: number) =>
    [...intentQueryKeys.all, "detail", workspaceId, packId, versionId, intentId] as const,
};

export const policyQueryKeys = {
  all: ["policies"] as const,
  list: (workspaceId: number, packId: number, versionId: number) =>
    [...policyQueryKeys.all, "list", workspaceId, packId, versionId] as const,
  detail: (workspaceId: number, packId: number, versionId: number, policyId: number) =>
    [...policyQueryKeys.all, "detail", workspaceId, packId, versionId, policyId] as const,
};

export const riskQueryKeys = {
  all: ["risk"] as const,
  list: (workspaceId: number, packId: number, versionId: number) =>
    [...riskQueryKeys.all, "list", workspaceId, packId, versionId] as const,
  detail: (workspaceId: number, packId: number, versionId: number, riskId: number) =>
    [...riskQueryKeys.all, "detail", workspaceId, packId, versionId, riskId] as const,
};

export const slotQueryKeys = {
  all: ["slots"] as const,
  list: (workspaceId: number, packId: number, versionId: number) =>
    [...slotQueryKeys.all, "list", workspaceId, packId, versionId] as const,
  detail: (workspaceId: number, packId: number, versionId: number, slotId: number) =>
    [...slotQueryKeys.all, "detail", workspaceId, packId, versionId, slotId] as const,
};

export const workflowQueryKeys = {
  all: ["workflows"] as const,
  list: (workspaceId: number, packId: number, versionId: number) =>
    [...workflowQueryKeys.all, "list", workspaceId, packId, versionId] as const,
  listByIntent: (
    workspaceId: number,
    packId: number,
    versionId: number,
    intentDefinitionId: number,
  ) =>
    [
      ...workflowQueryKeys.all,
      "list",
      workspaceId,
      packId,
      versionId,
      "intent",
      intentDefinitionId,
    ] as const,
  detail: (workspaceId: number, packId: number, versionId: number, workflowId: number) =>
    [...workflowQueryKeys.all, "detail", workspaceId, packId, versionId, workflowId] as const,
  transitions: (workspaceId: number, packId: number, versionId: number, workflowId: number) =>
    [...workflowQueryKeys.all, "transitions", workspaceId, packId, versionId, workflowId] as const,
};
