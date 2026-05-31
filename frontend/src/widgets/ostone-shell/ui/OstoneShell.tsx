import { type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { Sidebar, Topbar, type SidebarActive } from "@/shared/ui/ostone/chrome";
import type { Crumb, CrumbItem } from "@/shared/ui/ostone/chrome/Topbar";
import { WorkspaceMarker } from "@/shared/ui/ostone/chrome/WorkspaceMarker";

interface OstoneShellProps {
  active: SidebarActive;
  crumbs: Crumb[];
  topbarRight?: ReactNode;
  sidebarSwitcher?: ReactNode;
  dark?: boolean;
  basePath?: string;
  children: ReactNode;
}

interface SidebarBaseProps {
  active: SidebarActive;
  dark: boolean;
  basePath: string;
  switcher: ReactNode;
}

const TOP_LEVEL_CRUMB_BY_ACTIVE: Partial<Record<SidebarActive, string>> = {
  workflows: "응대 흐름 관리",
  upload: "상담 로그 수집",
  consult: "상담 응대",
  domain: "도메인팩 관리",
  chat: "사용자 화면 미리보기",
  intent: "상담 유형",
  slot: "확인 항목",
  policy: "응대 기준",
  risk: "주의 사항",
};

function labelOf(c: Crumb): string {
  return typeof c === "string" ? c : c.label;
}

function asItem(c: Crumb): CrumbItem {
  return typeof c === "string" ? { label: c } : c;
}

function resolveDisplayCrumbs(active: SidebarActive, crumbs: Crumb[]): Crumb[] {
  const first = crumbs[0] ? labelOf(crumbs[0]) : null;
  const second = crumbs[1] ? labelOf(crumbs[1]) : null;
  if (first === "CARD-CS" && second === "실시간 상담") {
    return ["상담 응대"];
  }

  if (first === "CARD-CS" && second === "Pipeline · Datasets") {
    return ["상담 로그 수집"];
  }

  if (second === "Domain Packs") {
    const sectionMap: Record<string, string> = {
      Workflows: "응대 흐름",
      WORKFLOWS: "응대 흐름",
      Intents: "상담 유형",
      INTENTS: "상담 유형",
      Slots: "확인 항목",
      SLOTS: "확인 항목",
      Policies: "응대 기준",
      POLICIES: "응대 기준",
      Risks: "주의 사항",
      RISKS: "주의 사항",
    };
    return crumbs.map((crumb) => {
      const label = labelOf(crumb);
      const nextLabel = label === "Domain Packs" ? "도메인팩 관리" : (sectionMap[label] ?? label);
      return typeof crumb === "string" ? nextLabel : { ...crumb, label: nextLabel };
    });
  }

  const topLevelCrumb = TOP_LEVEL_CRUMB_BY_ACTIVE[active];
  if (crumbs.length === 1 && topLevelCrumb && typeof crumbs[0] === "string") {
    return [topLevelCrumb];
  }

  return crumbs.map(asItem);
}

export function OstoneShell({
  active,
  crumbs,
  topbarRight,
  sidebarSwitcher,
  dark = false,
  basePath,
  children,
}: OstoneShellProps) {
  const { workspaceId } = useParams();
  const resolvedBasePath = basePath ?? (workspaceId ? `/workspaces/${workspaceId}` : "/workspaces");
  const numericWorkspaceId = workspaceId ? Number(workspaceId) : null;
  const safeWorkspaceId =
    numericWorkspaceId !== null && Number.isFinite(numericWorkspaceId) ? numericWorkspaceId : null;
  const displayCrumbs = resolveDisplayCrumbs(active, crumbs);

  const fallbackSwitcher = sidebarSwitcher ?? (
    <WorkspaceMarker workspaceId={safeWorkspaceId} collapsed={false} />
  );

  const sidebarBaseProps: SidebarBaseProps = {
    active,
    dark,
    basePath: resolvedBasePath,
    switcher: fallbackSwitcher,
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: dark ? "var(--dark-bg)" : "var(--paper)",
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <Sidebar {...sidebarBaseProps} />
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        <div style={{ flexShrink: 0 }}>
          <Topbar crumbs={displayCrumbs} right={topbarRight} dark={dark} />
        </div>
        <main style={{ flex: 1, overflow: "auto" }}>{children}</main>
      </div>
    </div>
  );
}
