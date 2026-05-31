export type DomainPackSection = "intents" | "slots" | "policies" | "risks" | "workflows";

export const SECTION_LABEL: Record<DomainPackSection, string> = {
  intents: "상담 유형",
  slots: "확인 항목",
  policies: "응대 기준",
  risks: "주의 사항",
  workflows: "응대 흐름",
};

export interface DomainPackCrumbInput {
  wsId: number;
  pId: number;
  vId: number;
  packName: string;
  versionNo: number;
  section?: { label: string; path: DomainPackSection };
  selectedLabel?: string | null;
}

export function buildDomainPackCrumbs({
  wsId,
  pId,
  vId,
  packName,
  versionNo,
  section,
  selectedLabel,
}: DomainPackCrumbInput): Array<{ label: string; href?: string }> {
  const crumbs: Array<{ label: string; href?: string }> = [
    { label: `WS · ${wsId}`, href: `/workspaces/${wsId}/domain-packs` },
    { label: packName, href: domainPackPath(wsId, pId) },
    {
      label: `#${versionNo}`,
      href: withVersionSearch(domainPackPath(wsId, pId), vId),
    },
  ];
  if (section) {
    crumbs.push({
      label: section.label,
      href: domainPackSectionPath(wsId, pId, vId, section.path),
    });
  }
  if (selectedLabel) {
    crumbs.push({ label: selectedLabel });
  }
  return crumbs;
}

export function withVersionSearch(path: string, versionId: number | null): string {
  if (versionId === null) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}versionId=${versionId}`;
}

export function domainPackListPath(workspaceId: number): string {
  return `/workspaces/${workspaceId}/domain-packs`;
}

export function domainPackPath(workspaceId: number, packId: number): string {
  return `${domainPackListPath(workspaceId)}/${packId}`;
}

export function domainPackSectionPath(
  workspaceId: number,
  packId: number,
  versionId: number | null,
  section: DomainPackSection,
  childId?: number,
): string {
  const childPath = childId === undefined ? "" : `/${childId}`;
  return withVersionSearch(
    `${domainPackPath(workspaceId, packId)}/${section}${childPath}`,
    versionId,
  );
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
  return withVersionSearch(
    `${domainPackPathFromBase(basePath, packId)}/${section}${childPath}`,
    versionId,
  );
}
