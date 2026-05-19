import { useState, type ReactNode, type CSSProperties } from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from '../atoms/Icon';
import type { IconName } from '../atoms/Icon';
import { Avatar } from '../atoms/Avatar';

export type SidebarActive =
  | 'operator'
  | 'workflows'
  | 'pipeline'
  | 'consult'
  | 'upload'
  | 'domain'
  | 'intent'
  | 'slot'
  | 'policy'
  | 'risk';

export interface SidebarTreeWorkflow {
  id: number;
  name: string;
}

export interface SidebarTreePack {
  packId: number;
  name: string;
  versionId: number | null;
  workflows: SidebarTreeWorkflow[];
}

export interface SidebarTreeData {
  packs: SidebarTreePack[];
  loading: boolean;
  error: string | null;
}

interface SidebarProps {
  active: SidebarActive;
  dark?: boolean;
  basePath?: string;
  switcher?: ReactNode;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  tree?: SidebarTreeData;
  activePackId?: number | null;
  activeWorkflowId?: number | null;
}

interface TopNavItem {
  key: SidebarActive;
  icon: IconName;
  label: string;
  getPath: (base: string) => string;
}

const TOP_NAV_ITEMS: TopNavItem[] = [
  { key: 'operator', icon: 'msg', label: 'Operator', getPath: (base) => `${base}/chat-demo` },
  { key: 'workflows', icon: 'grid', label: 'Workflows', getPath: (base) => `${base}/workflows` },
  { key: 'pipeline', icon: 'flow', label: 'Pipeline', getPath: (base) => `${base}/pipeline` },
  { key: 'consult', icon: 'book', label: 'Consultation', getPath: (base) => `${base}/consultation` },
  { key: 'upload', icon: 'upload', label: 'Uploads', getPath: (base) => `${base}/upload` },
];

const DOMAIN_NAV_ITEM: TopNavItem = {
  key: 'domain',
  icon: 'folder',
  label: 'Domain Packs',
  getPath: (base) => `${base}/domain-packs`,
};

interface PackCategoryItem {
  key: 'intents' | 'slots' | 'policies' | 'risks' | 'workflows';
  label: string;
  activeKey: SidebarActive;
}

const PACK_CATEGORIES: PackCategoryItem[] = [
  { key: 'intents', label: 'Intents', activeKey: 'intent' },
  { key: 'slots', label: 'Slots', activeKey: 'slot' },
  { key: 'policies', label: 'Policies', activeKey: 'policy' },
  { key: 'risks', label: 'Risks', activeKey: 'risk' },
  { key: 'workflows', label: 'Workflows', activeKey: 'workflows' },
];

function categoryPath(base: string, packId: number, versionId: number | null, key: PackCategoryItem['key']): string {
  if (versionId === null) return `${base}/domain-packs/${packId}`;
  return `${base}/domain-packs/${packId}/versions/${versionId}/${key}`;
}

function workflowPath(base: string, packId: number, versionId: number, workflowId: number): string {
  return `${base}/domain-packs/${packId}/versions/${versionId}/workflows/${workflowId}`;
}

export function Sidebar({
  active,
  dark = false,
  basePath = '/workspaces',
  switcher,
  collapsed,
  onToggleCollapsed,
  tree,
  activePackId = null,
  activeWorkflowId = null,
}: SidebarProps) {
  const containerBg = dark ? 'var(--dark-bg)' : 'var(--paper-2)';
  const borderColor = dark ? 'var(--dark-line)' : 'var(--line)';
  const defaultColor = dark ? 'var(--dark-ink-3)' : 'var(--ink-3)';
  const hoverBg = dark ? 'var(--dark-bg-2)' : 'var(--paper-3)';
  const activeColor = dark ? 'var(--dark-ink)' : 'var(--ink)';

  return (
    <nav
      style={{
        width: collapsed ? '56px' : '240px',
        background: containerBg,
        borderRight: `1px solid ${borderColor}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: collapsed ? 'center' : 'stretch',
        padding: collapsed ? 'var(--s-3) 0' : 'var(--s-3) 0',
        gap: 'var(--s-2)',
        height: '100%',
        flexShrink: 0,
        overflowY: 'auto',
      }}
      aria-label="주요 내비게이션"
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      {switcher !== undefined && (
        <div
          style={{
            marginBottom: 'var(--s-2)',
            display: 'flex',
            justifyContent: collapsed ? 'center' : 'flex-start',
            paddingLeft: collapsed ? 0 : 'var(--s-3)',
            paddingRight: collapsed ? 0 : 'var(--s-3)',
          }}
        >
          {switcher}
        </div>
      )}

      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
        title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
        style={{
          alignSelf: collapsed ? 'center' : 'flex-end',
          marginRight: collapsed ? 0 : 'var(--s-3)',
          marginBottom: 'var(--s-2)',
          width: '28px',
          height: '28px',
          borderRadius: 'var(--r-2)',
          border: `1px solid ${borderColor}`,
          background: 'transparent',
          color: defaultColor,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <Icon name={collapsed ? 'chevron' : 'close'} size={12} />
      </button>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--s-1)',
          flex: 1,
          width: '100%',
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

        {!collapsed && (
          <div
            style={{
              marginTop: 'var(--s-3)',
              paddingLeft: 'var(--s-3)',
              paddingRight: 'var(--s-3)',
              fontFamily: 'var(--mono)',
              fontSize: '10px',
              letterSpacing: '0.6px',
              textTransform: 'uppercase',
              color: defaultColor,
              marginBottom: 'var(--s-1)',
            }}
            data-testid="sidebar-section-label"
          >
            Domain Packs
          </div>
        )}

        <SidebarLink
          to={DOMAIN_NAV_ITEM.getPath(basePath)}
          icon={DOMAIN_NAV_ITEM.icon}
          label={DOMAIN_NAV_ITEM.label}
          collapsed={collapsed}
          isActive={active === 'domain'}
          activeColor={activeColor}
          defaultColor={defaultColor}
          hoverBg={hoverBg}
        />

        {!collapsed && tree && (
          <SidebarPackTree
            tree={tree}
            basePath={basePath}
            active={active}
            activePackId={activePackId}
            activeWorkflowId={activeWorkflowId}
            activeColor={activeColor}
            defaultColor={defaultColor}
            hoverBg={hoverBg}
          />
        )}
      </div>

      <div
        style={{
          marginTop: 'auto',
          display: 'flex',
          justifyContent: collapsed ? 'center' : 'flex-start',
          paddingLeft: collapsed ? 0 : 'var(--s-3)',
          paddingRight: collapsed ? 0 : 'var(--s-3)',
          paddingTop: 'var(--s-3)',
        }}
      >
        <Avatar tone="signal" initial="BS" size={28} />
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
}

function SidebarLink({ to, icon, label, collapsed, isActive, activeColor, defaultColor, hoverBg }: SidebarLinkProps) {
  const collapsedStyle: CSSProperties = {
    width: '36px',
    height: '36px',
    borderRadius: 'var(--r-2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: isActive ? activeColor : defaultColor,
    background: isActive ? hoverBg : 'transparent',
    textDecoration: 'none',
    transition: 'background 120ms ease, color 120ms ease',
    margin: '0 auto',
  };

  const expandedStyle: CSSProperties = {
    height: '32px',
    padding: '0 var(--s-3)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--s-2)',
    color: isActive ? activeColor : defaultColor,
    background: isActive ? hoverBg : 'transparent',
    borderLeft: `3px solid ${isActive ? 'var(--signal)' : 'transparent'}`,
    textDecoration: 'none',
    transition: 'background 120ms ease, color 120ms ease',
    fontFamily: 'var(--sans)',
    fontSize: '13px',
    fontWeight: isActive ? 500 : 400,
    letterSpacing: '-0.1px',
  };

  return (
    <NavLink
      to={to}
      end
      title={label}
      data-active={isActive ? 'true' : 'false'}
      style={collapsed ? collapsedStyle : expandedStyle}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = hoverBg;
          e.currentTarget.style.color = activeColor;
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = defaultColor;
        }
      }}
    >
      <Icon name={icon} size={collapsed ? 16 : 14} />
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
}

interface SidebarPackTreeProps {
  tree: SidebarTreeData;
  basePath: string;
  active: SidebarActive;
  activePackId: number | null;
  activeWorkflowId: number | null;
  activeColor: string;
  defaultColor: string;
  hoverBg: string;
}

function SidebarPackTree({
  tree,
  basePath,
  active,
  activePackId,
  activeWorkflowId,
  activeColor,
  defaultColor,
  hoverBg,
}: SidebarPackTreeProps) {
  if (tree.loading) {
    return (
      <div
        data-testid="sidebar-tree-loading"
        style={{
          padding: 'var(--s-2) var(--s-3)',
          fontFamily: 'var(--mono)',
          fontSize: '10px',
          color: defaultColor,
        }}
      >
        loading…
      </div>
    );
  }

  if (tree.error) {
    return (
      <div
        role="alert"
        data-testid="sidebar-tree-error"
        style={{
          padding: 'var(--s-2) var(--s-3)',
          fontFamily: 'var(--mono)',
          fontSize: '10px',
          color: 'var(--danger)',
        }}
      >
        도메인팩 로드 실패
      </div>
    );
  }

  if (tree.packs.length === 0) {
    return (
      <div
        data-testid="sidebar-tree-empty"
        style={{
          padding: 'var(--s-2) var(--s-3)',
          fontFamily: 'var(--mono)',
          fontSize: '10px',
          color: defaultColor,
        }}
      >
        도메인팩이 없습니다
      </div>
    );
  }

  return (
    <div data-testid="sidebar-tree" style={{ display: 'flex', flexDirection: 'column' }}>
      {tree.packs.map((pack) => (
        <PackNode
          key={pack.packId}
          pack={pack}
          basePath={basePath}
          active={active}
          activePackId={activePackId}
          activeWorkflowId={activeWorkflowId}
          activeColor={activeColor}
          defaultColor={defaultColor}
          hoverBg={hoverBg}
        />
      ))}
    </div>
  );
}

interface PackNodeProps {
  pack: SidebarTreePack;
  basePath: string;
  active: SidebarActive;
  activePackId: number | null;
  activeWorkflowId: number | null;
  activeColor: string;
  defaultColor: string;
  hoverBg: string;
}

function PackNode({
  pack,
  basePath,
  active,
  activePackId,
  activeWorkflowId,
  activeColor,
  defaultColor,
  hoverBg,
}: PackNodeProps) {
  const isCurrentPack = activePackId === pack.packId;
  const [open, setOpen] = useState(isCurrentPack);
  const [workflowsOpen, setWorkflowsOpen] = useState(isCurrentPack && active === 'workflows');

  return (
    <div data-testid={`sidebar-pack-${pack.packId}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: '6px var(--s-3)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--s-2)',
          cursor: 'pointer',
          fontFamily: 'var(--sans)',
          fontSize: '12px',
          fontWeight: isCurrentPack ? 500 : 400,
          color: isCurrentPack ? activeColor : defaultColor,
          letterSpacing: '-0.1px',
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'inline-flex', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 120ms ease' }}>
          <Icon name="chevron" size={10} />
        </span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pack.name}</span>
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {PACK_CATEGORIES.map((cat) => {
            const isActiveCat = isCurrentPack && active === cat.activeKey;
            if (cat.key === 'workflows') {
              return (
                <div key={cat.key}>
                  <button
                    type="button"
                    onClick={() => setWorkflowsOpen((v) => !v)}
                    aria-expanded={workflowsOpen}
                    style={{
                      width: '100%',
                      background: isActiveCat ? hoverBg : 'transparent',
                      border: 'none',
                      borderLeft: `3px solid ${isActiveCat ? 'var(--signal)' : 'transparent'}`,
                      padding: '4px var(--s-3) 4px 32px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--s-1)',
                      cursor: 'pointer',
                      fontFamily: 'var(--sans)',
                      fontSize: '12px',
                      color: isActiveCat ? activeColor : defaultColor,
                      letterSpacing: '-0.1px',
                      textAlign: 'left',
                    }}
                    data-testid={`sidebar-cat-${pack.packId}-workflows`}
                  >
                    <span style={{ display: 'inline-flex', transform: workflowsOpen ? 'rotate(90deg)' : 'none', transition: 'transform 120ms ease' }}>
                      <Icon name="chevron" size={9} />
                    </span>
                    <span>{cat.label}</span>
                  </button>
                  {workflowsOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <NavLink
                        to={categoryPath(basePath, pack.packId, pack.versionId, 'workflows')}
                        end
                        style={({ isActive }) => ({
                          padding: '4px var(--s-3) 4px 48px',
                          fontFamily: 'var(--mono)',
                          fontSize: '10px',
                          color: isActive ? activeColor : defaultColor,
                          textDecoration: 'none',
                          letterSpacing: '0.4px',
                          textTransform: 'uppercase',
                        })}
                      >
                        all workflows
                      </NavLink>
                      {pack.workflows.map((wf) => {
                        const isActiveWf = isCurrentPack && activeWorkflowId === wf.id;
                        return (
                          <NavLink
                            key={wf.id}
                            to={pack.versionId !== null ? workflowPath(basePath, pack.packId, pack.versionId, wf.id) : '#'}
                            end
                            data-testid={`sidebar-workflow-${wf.id}`}
                            style={{
                              padding: '4px var(--s-3) 4px 48px',
                              borderLeft: `3px solid ${isActiveWf ? 'var(--signal)' : 'transparent'}`,
                              background: isActiveWf ? hoverBg : 'transparent',
                              fontFamily: 'var(--sans)',
                              fontSize: '12px',
                              fontWeight: isActiveWf ? 500 : 400,
                              color: isActiveWf ? activeColor : defaultColor,
                              textDecoration: 'none',
                              letterSpacing: '-0.1px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {wf.name}
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <NavLink
                key={cat.key}
                to={categoryPath(basePath, pack.packId, pack.versionId, cat.key)}
                end
                data-testid={`sidebar-cat-${pack.packId}-${cat.key}`}
                style={{
                  padding: '4px var(--s-3) 4px 32px',
                  borderLeft: `3px solid ${isActiveCat ? 'var(--signal)' : 'transparent'}`,
                  background: isActiveCat ? hoverBg : 'transparent',
                  fontFamily: 'var(--sans)',
                  fontSize: '12px',
                  fontWeight: isActiveCat ? 500 : 400,
                  color: isActiveCat ? activeColor : defaultColor,
                  textDecoration: 'none',
                  letterSpacing: '-0.1px',
                }}
              >
                {cat.label}
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}
