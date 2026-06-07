import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  DEMO_SELECTION_PATH,
  PUBLIC_DEMO_SELECTION_LABEL,
  PUBLIC_DEMO_SELECTION_NEW_TAB_LABEL,
} from "@/shared/lib/demoRoutes";
import {
  buildWorkspacePreviewChatPath,
  WORKSPACE_PREVIEW_LABEL,
  WORKSPACE_PREVIEW_NEW_TAB_LABEL,
} from "@/shared/lib/userChatRoutes";
import { Icon } from "../atoms/Icon";
import type { IconName } from "../atoms/Icon";
import { AccountMenu } from "./AccountMenu";

export type SidebarActive =
  | "dashboard"
  | "workflows"
  | "simulation"
  | "consult"
  | "chat"
  | "upload"
  | "domain"
  | "settings"
  | "intent"
  | "slot"
  | "policy"
  | "risk";

interface SidebarProps {
  active: SidebarActive;
  dark?: boolean;
  basePath?: string;
  switcher?: ReactNode;
}

interface TopNavItem {
  key: SidebarActive;
  icon: IconName;
  label: string;
  getPath: (base: string) => string;
  openInNewTab?: boolean;
}

const TOP_NAV_ITEMS: TopNavItem[] = [
  {
    key: "dashboard",
    icon: "grid",
    label: "대시보드",
    getPath: (base) => `${base}/dashboard`,
  },
  {
    key: "consult",
    icon: "book",
    label: "상담 응대",
    getPath: (base) => `${base}/consultation`,
  },
  {
    key: "simulation",
    icon: "play",
    label: "시뮬레이션",
    getPath: (base) => `${base}/simulation`,
  },
  {
    key: "chat",
    icon: "msg",
    label: WORKSPACE_PREVIEW_LABEL,
    getPath: buildWorkspacePreviewChatPath,
    openInNewTab: true,
  },
  {
    key: "upload",
    icon: "upload",
    label: "상담 로그 수집",
    getPath: (base) => `${base}/upload`,
  },
  {
    key: "settings",
    icon: "settings",
    label: "워크스페이스 설정",
    getPath: (base) => `${base}/settings/members`,
  },
];

const DOMAIN_PACKS_LABEL = "도메인팩 관리";
const DOMAIN_PACKS_ICON: IconName = "folder";
const SIDEBAR_WIDTH = "200px";

function deriveSidebarColors(dark: boolean) {
  return {
    containerBg: dark ? "var(--dark-bg)" : "var(--paper-2)",
    borderColor: dark ? "var(--dark-line)" : "var(--line)",
    defaultColor: dark ? "var(--dark-ink-3)" : "var(--ink-3)",
    hoverBg: dark ? "var(--dark-bg-2)" : "var(--paper-3)",
    activeBg: dark ? "var(--dark-bg-2)" : "var(--paper-3)",
    activeColor: dark ? "var(--dark-ink)" : "var(--ink)",
  };
}

function isDomainSectionActive(active: SidebarActive): boolean {
  return (
    active === "domain" ||
    active === "intent" ||
    active === "slot" ||
    active === "policy" ||
    active === "risk" ||
    active === "workflows"
  );
}

export function Sidebar({
  active,
  dark = false,
  basePath = "/workspaces",
  switcher,
}: SidebarProps) {
  const { containerBg, borderColor, defaultColor, hoverBg, activeBg, activeColor } =
    deriveSidebarColors(dark);

  return (
    <nav
      style={{
        width: SIDEBAR_WIDTH,
        background: containerBg,
        borderRight: `1px solid ${borderColor}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        padding: "var(--s-3) 0",
        gap: "var(--s-2)",
        height: "100%",
        flexShrink: 0,
        overflowY: "auto",
        overflowX: "hidden",
        cursor: "default",
        transition: "background 200ms ease",
      }}
      aria-label="주요 내비게이션"
      data-collapsed="false"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "var(--s-2)",
          marginBottom: "var(--s-2)",
          padding: "0 var(--s-3)",
          justifyContent: "flex-start",
          width: "100%",
        }}
      >
        {switcher !== undefined && (
          <div
            style={{
              flex: "1 1 0",
              minWidth: 0,
              display: "flex",
              justifyContent: "flex-start",
            }}
          >
            {switcher}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--s-1)",
          flex: 1,
          width: "100%",
        }}
      >
        {TOP_NAV_ITEMS.map((item) => {
          const to = item.getPath(basePath);
          const label =
            item.key === "chat" && to === DEMO_SELECTION_PATH
              ? PUBLIC_DEMO_SELECTION_LABEL
              : item.label;

          return (
            <SidebarLink
              key={item.key}
              to={to}
              icon={item.icon}
              label={label}
              isActive={active === item.key}
              activeColor={activeColor}
              defaultColor={defaultColor}
              hoverBg={hoverBg}
              activeBg={activeBg}
              testId={`sidebar-link-${item.key}`}
              target={item.openInNewTab ? "_blank" : undefined}
              newTabLabel={item.openInNewTab ? getNewTabLabel(to) : undefined}
            />
          );
        })}

        <SidebarLink
          to={`${basePath}/domain-packs`}
          icon={DOMAIN_PACKS_ICON}
          label={DOMAIN_PACKS_LABEL}
          isActive={isDomainSectionActive(active)}
          activeColor={activeColor}
          defaultColor={defaultColor}
          hoverBg={hoverBg}
          activeBg={activeBg}
          testId="sidebar-domain-link"
        />
      </div>

      <div
        data-testid="sidebar-account-slot"
        style={{
          marginTop: "auto",
          display: "flex",
          alignItems: "stretch",
          paddingLeft: "var(--s-3)",
          paddingRight: "var(--s-3)",
          paddingTop: "var(--s-3)",
          position: "sticky",
          bottom: 0,
          background: containerBg,
          zIndex: 50,
        }}
      >
        <AccountMenu collapsed={false} />
      </div>
    </nav>
  );
}

interface SidebarLinkProps {
  to: string;
  icon: IconName;
  label: string;
  isActive: boolean;
  activeColor: string;
  defaultColor: string;
  hoverBg: string;
  activeBg: string;
  testId?: string;
  target?: "_blank";
  newTabLabel?: string;
}

function getNewTabLabel(to: string): string {
  return to === DEMO_SELECTION_PATH
    ? PUBLIC_DEMO_SELECTION_NEW_TAB_LABEL
    : WORKSPACE_PREVIEW_NEW_TAB_LABEL;
}

function buildLinkStyle({
  isActive,
  activeColor,
  defaultColor,
  activeBg,
}: {
  isActive: boolean;
  activeColor: string;
  defaultColor: string;
  activeBg: string;
}): CSSProperties {
  return {
    height: "40px",
    padding: "0 var(--s-3)",
    display: "flex",
    alignItems: "center",
    gap: "var(--s-2)",
    color: isActive ? activeColor : defaultColor,
    background: isActive ? activeBg : "transparent",
    borderLeft: `3px solid ${isActive ? "var(--signal)" : "transparent"}`,
    textDecoration: "none",
    transition: "background 160ms ease, color 160ms ease",
    fontFamily: "var(--font-sans)",
    fontSize: "13.5px",
    fontWeight: isActive ? 540 : 450,
    letterSpacing: "-0.18px",
  };
}

function SidebarLink({
  to,
  icon,
  label,
  isActive,
  activeColor,
  defaultColor,
  hoverBg,
  activeBg,
  testId,
  target,
  newTabLabel,
}: SidebarLinkProps) {
  const expandedStyle: CSSProperties = buildLinkStyle({
    isActive,
    activeColor,
    defaultColor,
    activeBg,
  });

  const handleMouseEnter = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isActive) {
      e.currentTarget.style.background = hoverBg;
      e.currentTarget.style.color = activeColor;
    }
  };

  const handleMouseLeave = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isActive) {
      e.currentTarget.style.background = "transparent";
      e.currentTarget.style.color = defaultColor;
    }
  };

  const opensInNewTab = target === "_blank";
  const content = (
    <>
      <Icon name={icon} size={16} />
      <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
      {opensInNewTab ? (
        <ExternalLink
          size={13}
          role="img"
          aria-label={newTabLabel ?? "새 탭에서 열림"}
          style={{ flexShrink: 0, color: "var(--ink-3)" }}
        />
      ) : null}
    </>
  );

  if (opensInNewTab) {
    return (
      <a
        href={to}
        title={label}
        target="_blank"
        rel="noopener noreferrer"
        data-active={isActive ? "true" : "false"}
        data-testid={testId}
        style={expandedStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {content}
      </a>
    );
  }

  return (
    <NavLink
      to={to}
      end
      title={label}
      data-active={isActive ? "true" : "false"}
      data-testid={testId}
      style={expandedStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {content}
    </NavLink>
  );
}
