export type DomainPackSection = "intents" | "slots" | "policies" | "risks" | "workflows";

export function withVersionSearch(path: string, versionId: number | null): string {
  if (versionId === null) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}versionId=${versionId}`;
}

export function domainPackPath(workspaceId: number, packId: number): string {
  return `/workspaces/${workspaceId}/domain-packs/${packId}`;
}

export function domainPackSectionPath(
  workspaceId: number,
  packId: number,
  versionId: number | null,
  section: DomainPackSection,
  childId?: number,
): string {
  const childPath = childId === undefined ? "" : `/${childId}`;
  return withVersionSearch(`${domainPackPath(workspaceId, packId)}/${section}${childPath}`, versionId);
}

export function shouldReplaceDomainPackChildRoute(currentChildId: number | null): boolean {
  return currentChildId !== null;
}

export function domainPackPathFromBase(basePath: string, packId: number): string {
  return `${basePath}/domain-packs/${packId}`;
}

export function domainPackSectionPathFromBase(
  basePath: string,
  packId: number,
  versionId: number | null,
  section: DomainPackSection,
  childId?: number,
): string {
  const childPath = childId === undefined ? "" : `/${childId}`;
  return withVersionSearch(`${domainPackPathFromBase(basePath, packId)}/${section}${childPath}`, versionId);
}
