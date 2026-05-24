import type { CSSProperties, ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Icon } from "../atoms/Icon";
import type { IconName } from "../atoms/Icon";
import { AccountMenu } from "./AccountMenu";

export type SidebarActive =
  | "workflows"
  | "consult"
  | "upload"
  | "domain"
  | "intent"
  | "slot"
  | "policy"
  | "risk";

interface SidebarProps {
  active: SidebarActive;
  dark?: boolean;
  basePath?: string;
  switcher?: ReactNode;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

interface TopNavItem {
  key: SidebarActive;
  icon: IconName;
  label: string;
  getPath: (base: string) => string;
}

const TOP_NAV_ITEMS: TopNavItem[] = [
  {
    key: "consult",
    icon: "book",
    label: "Consultation",
    getPath: (base) => `${base}/consultation`,
  },
  {
    key: "upload",
    icon: "upload",
    label: "Uploads",
    getPath: (base) => `${base}/upload`,
  },
];

const DOMAIN_PACKS_LABEL = "Domain Packs";
const DOMAIN_PACKS_ICON: IconName = "folder";

function deriveSidebarColors(dark: boolean) {
  return {
    containerBg: dark ? "var(--dark-bg)" : "var(--paper-2)",
    borderColor: dark ? "var(--dark-line)" : "var(--line)",
    defaultColor: dark ? "var(--dark-ink-3)" : "var(--ink-3)",
    hoverBg: dark ? "var(--dark-bg-2)" : "var(--paper-3)",
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
  collapsed,
  onToggleCollapsed,
}: SidebarProps) {
  const { containerBg, borderColor, defaultColor, hoverBg, activeColor } =
    deriveSidebarColors(dark);

  const handleNavCapture: React.MouseEventHandler<HTMLElement> = (e) => {
    if (collapsed) {
      e.stopPropagation();
      e.preventDefault();
      onToggleCollapsed();
    }
  };

  return (
    <nav
      onClickCapture={handleNavCapture}
      style={{
        width: collapsed ? "72px" : "256px",
        background: containerBg,
        borderRight: `1px solid ${borderColor}`,
        display: "flex",
        flexDirection: "column",
        alignItems: collapsed ? "center" : "stretch",
        padding: "var(--s-3) 0",
        gap: "var(--s-2)",
        height: "100%",
        flexShrink: 0,
        overflowY: "auto",
        overflowX: "hidden",
        cursor: collapsed ? "pointer" : "default",
        transition:
          "width 400ms cubic-bezier(0.32, 0.72, 0.16, 1), background 200ms ease",
      }}
      aria-label="주요 내비게이션"
      data-collapsed={collapsed ? "true" : "false"}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "var(--s-2)",
          marginBottom: "var(--s-2)",
          padding: collapsed ? "0" : "0 var(--s-3)",
          justifyContent: collapsed ? "center" : "flex-start",
          width: collapsed ? "auto" : "100%",
        }}
      >
        {switcher !== undefined && (
          <div
            style={{
              flex: collapsed ? "0 0 auto" : "1 1 0",
              minWidth: 0,
              display: "flex",
              justifyContent: collapsed ? "center" : "flex-start",
            }}
          >
            {switcher}
          </div>
        )}
        {!collapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label="사이드바 접기"
            title="사이드바 접기"
            style={{
              flexShrink: 0,
              width: "40px",
              height: "40px",
              borderRadius: "var(--r-2)",
              border: "1px solid var(--line)",
              background: "var(--paper)",
              color: "var(--ink)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "background 160ms ease, border-color 160ms ease",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                transform: "rotate(180deg)",
                transition: "transform 240ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              <Icon name="chevron" size={14} />
            </span>
          </button>
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
        {TOP_NAV_ITEMS.map((item) => (
          <SidebarLink
            key={item.key}
            to={item.getPath(basePath)}
            icon={item.icon}
            label={item.label}
            collapsed={collapsed}
            isActive={active === item.key}
            activeColor={activeColor}
            defaultColor={defaultColor}
            hoverBg={hoverBg}
          />
        ))}

        <SidebarLink
          to={`${basePath}/domain-packs`}
          icon={DOMAIN_PACKS_ICON}
          label={DOMAIN_PACKS_LABEL}
          collapsed={collapsed}
          isActive={isDomainSectionActive(active)}
          activeColor={activeColor}
          defaultColor={defaultColor}
          hoverBg={hoverBg}
          testId="sidebar-domain-link"
        />
      </div>

      <div
        data-testid="sidebar-account-slot"
        style={{
          marginTop: "auto",
          display: "flex",
          justifyContent: collapsed ? "center" : "stretch",
          paddingLeft: collapsed ? 0 : "var(--s-3)",
          paddingRight: collapsed ? 0 : "var(--s-3)",
          paddingTop: "var(--s-3)",
          position: "sticky",
          bottom: 0,
          background: containerBg,
          zIndex: 50,
        }}
      >
        <AccountMenu collapsed={collapsed} />
      </div>
    </nav>
  );
}

interface SidebarLinkProps {
  to: string;
  icon: IconName;
  label: string;
  collapsed: boolean;
  isActive: boolean;
  activeColor: string;
  defaultColor: string;
  hoverBg: string;
  testId?: string;
}

function SidebarLink({
  to,
  icon,
  label,
  collapsed,
  isActive,
  activeColor,
  defaultColor,
  hoverBg,
  testId,
}: SidebarLinkProps) {
  const collapsedStyle: CSSProperties = {
    width: "40px",
    height: "40px",
    borderRadius: "var(--r-2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: isActive ? activeColor : defaultColor,
    background: isActive ? hoverBg : "transparent",
    textDecoration: "none",
    transition: "background 160ms ease, color 160ms ease",
    margin: "0 auto",
  };

  const expandedStyle: CSSProperties = {
    height: "40px",
    padding: "0 var(--s-3)",
    display: "flex",
    alignItems: "center",
    gap: "var(--s-2)",
    color: isActive ? activeColor : defaultColor,
    background: isActive ? hoverBg : "transparent",
    borderLeft: `3px solid ${isActive ? "var(--signal)" : "transparent"}`,
    textDecoration: "none",
    transition: "background 160ms ease, color 160ms ease",
    fontFamily: "var(--sans)",
    fontSize: "14px",
    fontWeight: isActive ? 500 : 400,
    letterSpacing: "-0.1px",
  };

  return (
    <NavLink
      to={to}
      end
      title={label}
      data-active={isActive ? "true" : "false"}
      data-testid={testId}
      style={collapsed ? collapsedStyle : expandedStyle}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = hoverBg;
          e.currentTarget.style.color = activeColor;
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = defaultColor;
        }
      }}
    >
      <Icon name={icon} size={16} />
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
}
