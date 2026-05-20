import { useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { NavLink } from 'react-router-dom';
import { Settings as SettingsIcon } from 'lucide-react';
import { Icon } from '../atoms/Icon';
import type { IconName } from '../atoms/Icon';
import { AccountMenu } from './AccountMenu';
import { WorkflowSettingsPanel, type WorkflowSettingEntry } from './WorkflowSettingsPanel';
import {
  SORT_DIR_OPTIONS,
  SORT_FIELD_OPTIONS,
  TOP_N_OPTIONS,
  compareWorkflows,
  readSidebarWorkflowSettings,
  writeSidebarWorkflowSettings,
  type SidebarWorkflowSettings,
} from '@/shared/lib/workflowSettings';

const SORT_FIELD_KO_LABELS: Record<(typeof SORT_FIELD_OPTIONS)[number]['value'], string> = {
  workflowCode: '코드',
  name: '이름',
};

const SORT_DIR_KO_LABELS: Record<(typeof SORT_DIR_OPTIONS)[number]['value'], string> = {
  asc: '오름차순',
  desc: '내림차순',
};

export type SidebarActive =
  | 'workflows'
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
  { key: 'consult', icon: 'book', label: 'Consultation', getPath: (base) => `${base}/consultation` },
  { key: 'upload', icon: 'upload', label: 'Uploads', getPath: (base) => `${base}/upload` },
];

const DOMAIN_PACKS_LABEL = 'Domain Packs';
const DOMAIN_PACKS_ICON: IconName = 'folder';

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
  { key: 'workflows', label: 'All Workflows', activeKey: 'workflows' },
];

function categoryPath(base: string, packId: number, versionId: number | null, key: PackCategoryItem['key']): string {
  if (versionId === null) return `${base}/domain-packs/${packId}`;
  return `${base}/domain-packs/${packId}/versions/${versionId}/${key}`;
}

function workflowPath(base: string, packId: number, versionId: number, workflowId: number): string {
  return `${base}/domain-packs/${packId}/versions/${versionId}/workflows/${workflowId}`;
}

const PACK_HOVER_HANDLERS = {
  onMouseEnter: (hoverBg: string, activeColor: string) => (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.background = hoverBg;
    e.currentTarget.style.color = activeColor;
  },
  onMouseLeave: (defaultColor: string) => (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.background = 'transparent';
    e.currentTarget.style.color = defaultColor;
  },
};

function deriveSidebarColors(dark: boolean) {
  return {
    containerBg: dark ? 'var(--dark-bg)' : 'var(--paper-2)',
    borderColor: dark ? 'var(--dark-line)' : 'var(--line)',
    defaultColor: dark ? 'var(--dark-ink-3)' : 'var(--ink-3)',
    hoverBg: dark ? 'var(--dark-bg-2)' : 'var(--paper-3)',
    activeColor: dark ? 'var(--dark-ink)' : 'var(--ink)',
  };
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
  const { containerBg, borderColor, defaultColor, hoverBg, activeColor } = deriveSidebarColors(dark);

  const [workflowSettings, setWorkflowSettings] = useState<SidebarWorkflowSettings>(() =>
    readSidebarWorkflowSettings(),
  );
  const [settingsPanelPackId, setSettingsPanelPackId] = useState<number | null>(null);

  useEffect(() => {
    writeSidebarWorkflowSettings(workflowSettings);
  }, [workflowSettings]);

  const updateWorkflowSettings = (patch: Partial<SidebarWorkflowSettings>) => {
    setWorkflowSettings((prev) => ({ ...prev, ...patch }));
  };

  const toggleSettingsPanel = (packId: number) => {
    setSettingsPanelPackId((prev) => (prev === packId ? null : packId));
  };

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
        width: collapsed ? '72px' : '256px',
        background: containerBg,
        borderRight: `1px solid ${borderColor}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: collapsed ? 'center' : 'stretch',
        padding: 'var(--s-3) 0',
        gap: 'var(--s-2)',
        height: '100%',
        flexShrink: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        cursor: collapsed ? 'pointer' : 'default',
        transition: 'width 400ms cubic-bezier(0.32, 0.72, 0.16, 1), background 200ms ease',
      }}
      aria-label="주요 내비게이션"
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 'var(--s-2)',
          marginBottom: 'var(--s-2)',
          padding: collapsed ? '0' : '0 var(--s-3)',
          justifyContent: collapsed ? 'center' : 'flex-start',
          width: collapsed ? 'auto' : '100%',
        }}
      >
        {switcher !== undefined && (
          <div
            style={{
              flex: collapsed ? '0 0 auto' : '1 1 0',
              minWidth: 0,
              display: 'flex',
              justifyContent: collapsed ? 'center' : 'flex-start',
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
              width: '40px',
              height: '40px',
              borderRadius: 'var(--r-2)',
              border: '1px solid var(--line)',
              background: 'var(--paper)',
              color: 'var(--ink)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 160ms ease, border-color 160ms ease',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                transform: 'rotate(180deg)',
                transition: 'transform 240ms cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <Icon name="chevron" size={14} />
            </span>
          </button>
        )}
      </div>

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

        <DomainPacksNode
          basePath={basePath}
          collapsed={collapsed}
          active={active}
          tree={tree}
          activePackId={activePackId}
          activeWorkflowId={activeWorkflowId}
          activeColor={activeColor}
          defaultColor={defaultColor}
          hoverBg={hoverBg}
          workflowSettings={workflowSettings}
          settingsPanelPackId={settingsPanelPackId}
          onToggleSettingsPanel={toggleSettingsPanel}
          onUpdateWorkflowSettings={updateWorkflowSettings}
        />
      </div>

      <div
        data-testid="sidebar-account-slot"
        style={{
          marginTop: 'auto',
          display: 'flex',
          justifyContent: collapsed ? 'center' : 'stretch',
          paddingLeft: collapsed ? 0 : 'var(--s-3)',
          paddingRight: collapsed ? 0 : 'var(--s-3)',
          paddingTop: 'var(--s-3)',
          position: 'sticky',
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
}

function SidebarLink({ to, icon, label, collapsed, isActive, activeColor, defaultColor, hoverBg }: SidebarLinkProps) {
  const collapsedStyle: CSSProperties = {
    width: '40px',
    height: '40px',
    borderRadius: 'var(--r-2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: isActive ? activeColor : defaultColor,
    background: isActive ? hoverBg : 'transparent',
    textDecoration: 'none',
    transition: 'background 160ms ease, color 160ms ease',
    margin: '0 auto',
  };

  const expandedStyle: CSSProperties = {
    height: '40px',
    padding: '0 var(--s-3)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--s-2)',
    color: isActive ? activeColor : defaultColor,
    background: isActive ? hoverBg : 'transparent',
    borderLeft: `3px solid ${isActive ? 'var(--signal)' : 'transparent'}`,
    textDecoration: 'none',
    transition: 'background 160ms ease, color 160ms ease',
    fontFamily: 'var(--sans)',
    fontSize: '14px',
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
      <Icon name={icon} size={16} />
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
}

interface DomainPacksNodeProps {
  basePath: string;
  collapsed: boolean;
  active: SidebarActive;
  tree?: SidebarTreeData;
  activePackId: number | null;
  activeWorkflowId: number | null;
  activeColor: string;
  defaultColor: string;
  hoverBg: string;
  workflowSettings: SidebarWorkflowSettings;
  settingsPanelPackId: number | null;
  onToggleSettingsPanel: (packId: number) => void;
  onUpdateWorkflowSettings: (patch: Partial<SidebarWorkflowSettings>) => void;
}

function DomainPacksNode({
  basePath,
  collapsed,
  active,
  tree,
  activePackId,
  activeWorkflowId,
  activeColor,
  defaultColor,
  hoverBg,
  workflowSettings,
  settingsPanelPackId,
  onToggleSettingsPanel,
  onUpdateWorkflowSettings,
}: DomainPacksNodeProps) {
  const isDomainActive =
    active === 'domain' || active === 'intent' || active === 'slot' || active === 'policy' || active === 'risk' || active === 'workflows';
  const [open, setOpen] = useState<boolean>(isDomainActive);
  const [prevIsDomainActive, setPrevIsDomainActive] = useState(isDomainActive);
  if (isDomainActive !== prevIsDomainActive) {
    setPrevIsDomainActive(isDomainActive);
    if (isDomainActive) setOpen(true);
  }

  if (collapsed) {
    return (
      <SidebarLink
        to={`${basePath}/domain-packs`}
        icon={DOMAIN_PACKS_ICON}
        label={DOMAIN_PACKS_LABEL}
        collapsed
        isActive={isDomainActive}
        activeColor={activeColor}
        defaultColor={defaultColor}
        hoverBg={hoverBg}
      />
    );
  }

  return (
    <div data-testid="sidebar-domain-section">
      <button
        type="button"
        aria-expanded={open}
        aria-label={DOMAIN_PACKS_LABEL}
        onClick={() => setOpen((v) => !v)}
        data-active={isDomainActive ? 'true' : 'false'}
        data-testid="sidebar-domain-toggle"
        style={{
          width: '100%',
          height: '40px',
          padding: '0 var(--s-3)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--s-2)',
          color: isDomainActive ? activeColor : defaultColor,
          background: isDomainActive ? hoverBg : 'transparent',
          borderLeft: `3px solid ${isDomainActive ? 'var(--signal)' : 'transparent'}`,
          border: 'none',
          borderRight: 'none',
          borderTop: 'none',
          borderBottom: 'none',
          textAlign: 'left',
          cursor: 'pointer',
          fontFamily: 'var(--sans)',
          fontSize: '14px',
          fontWeight: isDomainActive ? 500 : 400,
          letterSpacing: '-0.1px',
          transition: 'background 160ms ease, color 160ms ease',
        }}
        onMouseEnter={PACK_HOVER_HANDLERS.onMouseEnter(hoverBg, activeColor)}
        onMouseLeave={(e) => {
          if (!isDomainActive) {
            PACK_HOVER_HANDLERS.onMouseLeave(defaultColor)(e);
          }
        }}
      >
        <Icon name={DOMAIN_PACKS_ICON} size={16} />
        <span style={{ flex: 1 }}>{DOMAIN_PACKS_LABEL}</span>
        <span
          style={{
            display: 'inline-flex',
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 160ms ease',
          }}
        >
          <Icon name="chevron" size={12} />
        </span>
      </button>

      {open && tree && (
        <SidebarPackTree
          tree={tree}
          basePath={basePath}
          active={active}
          activePackId={activePackId}
          activeWorkflowId={activeWorkflowId}
          activeColor={activeColor}
          defaultColor={defaultColor}
          hoverBg={hoverBg}
          workflowSettings={workflowSettings}
          settingsPanelPackId={settingsPanelPackId}
          onToggleSettingsPanel={onToggleSettingsPanel}
          onUpdateWorkflowSettings={onUpdateWorkflowSettings}
        />
      )}
    </div>
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
  workflowSettings: SidebarWorkflowSettings;
  settingsPanelPackId: number | null;
  onToggleSettingsPanel: (packId: number) => void;
  onUpdateWorkflowSettings: (patch: Partial<SidebarWorkflowSettings>) => void;
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
  workflowSettings,
  settingsPanelPackId,
  onToggleSettingsPanel,
  onUpdateWorkflowSettings,
}: SidebarPackTreeProps) {
  if (tree.loading) {
    return (
      <div
        data-testid="sidebar-tree-loading"
        style={{
          padding: 'var(--s-2) var(--s-3) var(--s-2) 32px',
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
          padding: 'var(--s-2) var(--s-3) var(--s-2) 32px',
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
          padding: 'var(--s-2) var(--s-3) var(--s-2) 32px',
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
          workflowSettings={workflowSettings}
          settingsPanelOpen={settingsPanelPackId === pack.packId}
          onToggleSettingsPanel={() => onToggleSettingsPanel(pack.packId)}
          onUpdateWorkflowSettings={onUpdateWorkflowSettings}
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
  workflowSettings: SidebarWorkflowSettings;
  settingsPanelOpen: boolean;
  onToggleSettingsPanel: () => void;
  onUpdateWorkflowSettings: (patch: Partial<SidebarWorkflowSettings>) => void;
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
  workflowSettings,
  settingsPanelOpen,
  onToggleSettingsPanel,
  onUpdateWorkflowSettings,
}: PackNodeProps) {
  const isCurrentPack = activePackId === pack.packId;
  const [open, setOpen] = useState(isCurrentPack);
  const [prevIsCurrentPack, setPrevIsCurrentPack] = useState(isCurrentPack);
  if (isCurrentPack !== prevIsCurrentPack) {
    setPrevIsCurrentPack(isCurrentPack);
    if (isCurrentPack) setOpen(true);
  }

  const sortedWorkflows = useMemo(() => {
    return [...pack.workflows].sort((a, b) =>
      compareWorkflows(a, b, workflowSettings.sortField, workflowSettings.sortDir),
    );
  }, [pack.workflows, workflowSettings.sortField, workflowSettings.sortDir]);

  const visibleWorkflows = sortedWorkflows.slice(0, workflowSettings.topN);
  const hiddenCount = Math.max(0, sortedWorkflows.length - visibleWorkflows.length);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  const settingsEntries: WorkflowSettingEntry[] = [
    {
      key: 'topN',
      label: '표시 개수',
      value: workflowSettings.topN,
      options: TOP_N_OPTIONS.map((n) => ({ value: n, label: String(n) })),
      onChange: (next) => onUpdateWorkflowSettings({ topN: Number(next) }),
    },
    {
      key: 'sortField',
      label: '정렬 기준',
      value: workflowSettings.sortField,
      options: SORT_FIELD_OPTIONS.map((o) => ({ value: o.value, label: SORT_FIELD_KO_LABELS[o.value] })),
      onChange: (next) =>
        onUpdateWorkflowSettings({
          sortField: next === 'name' ? 'name' : 'workflowCode',
        }),
    },
    {
      key: 'sortDir',
      label: '정렬 방식',
      value: workflowSettings.sortDir,
      options: SORT_DIR_OPTIONS.map((o) => ({ value: o.value, label: SORT_DIR_KO_LABELS[o.value] })),
      onChange: (next) =>
        onUpdateWorkflowSettings({ sortDir: next === 'desc' ? 'desc' : 'asc' }),
    },
  ];

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
          padding: '8px var(--s-3) 8px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--s-2)',
          cursor: 'pointer',
          fontFamily: 'var(--sans)',
          fontSize: '13px',
          fontWeight: isCurrentPack ? 500 : 400,
          color: isCurrentPack ? activeColor : defaultColor,
          letterSpacing: '-0.1px',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 120ms ease',
          }}
        >
          <Icon name="chevron" size={10} />
        </span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {pack.name}
        </span>
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {PACK_CATEGORIES.map((cat) => {
            const isActiveCat = isCurrentPack && active === cat.activeKey;
            const isWorkflowsCat = cat.key === 'workflows';
            const navLinkStyle: CSSProperties = {
              padding: '4px var(--s-3) 4px 48px',
              borderLeft: `3px solid ${isActiveCat ? 'var(--signal)' : 'transparent'}`,
              background: isActiveCat ? hoverBg : 'transparent',
              fontFamily: 'var(--sans)',
              fontSize: '12px',
              fontWeight: isActiveCat ? 500 : 400,
              color: isActiveCat ? activeColor : defaultColor,
              textDecoration: 'none',
              letterSpacing: '-0.1px',
              display: 'block',
              flex: 1,
            };

            if (!isWorkflowsCat) {
              return (
                <NavLink
                  key={cat.key}
                  to={categoryPath(basePath, pack.packId, pack.versionId, cat.key)}
                  end
                  data-testid={`sidebar-cat-${pack.packId}-${cat.key}`}
                  style={navLinkStyle}
                >
                  {cat.label}
                </NavLink>
              );
            }

            return (
              <div key={cat.key} style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'stretch' }}>
                  <NavLink
                    to={categoryPath(basePath, pack.packId, pack.versionId, cat.key)}
                    end
                    data-testid={`sidebar-cat-${pack.packId}-${cat.key}`}
                    style={navLinkStyle}
                  >
                    {cat.label}
                  </NavLink>
                  <button
                    ref={settingsButtonRef}
                    type="button"
                    onClick={onToggleSettingsPanel}
                    aria-label="워크플로우 표시 설정"
                    aria-expanded={settingsPanelOpen}
                    data-testid={`sidebar-workflows-settings-toggle-${pack.packId}`}
                    style={{
                      width: '28px',
                      flexShrink: 0,
                      background: settingsPanelOpen ? hoverBg : 'transparent',
                      border: 'none',
                      color: settingsPanelOpen ? activeColor : defaultColor,
                      cursor: 'pointer',
                      padding: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <SettingsIcon size={14} />
                  </button>
                </div>

                {settingsPanelOpen && (
                  <WorkflowSettingsPanel
                    entries={settingsEntries}
                    testId={`sidebar-workflows-settings-${pack.packId}`}
                    style={{ left: 'var(--s-3)', top: 'calc(100% + 4px)' }}
                    onClickOutside={onToggleSettingsPanel}
                    anchorRef={settingsButtonRef}
                  />
                )}

                {isActiveCat && (
                  <div
                    data-testid={`sidebar-workflows-list-${pack.packId}`}
                    style={{ display: 'flex', flexDirection: 'column' }}
                  >
                    {visibleWorkflows.length === 0 ? (
                      <span
                        data-testid={`sidebar-workflows-empty-${pack.packId}`}
                        style={{
                          padding: '4px var(--s-3) 4px 64px',
                          fontFamily: 'var(--mono)',
                          fontSize: '10px',
                          color: defaultColor,
                        }}
                      >
                        no workflows
                      </span>
                    ) : (
                      visibleWorkflows.map((wf) => {
                        const isActiveWf = activeWorkflowId === wf.id;
                        return (
                          <NavLink
                            key={wf.id}
                            to={
                              pack.versionId !== null
                                ? workflowPath(basePath, pack.packId, pack.versionId, wf.id)
                                : '#'
                            }
                            end
                            data-testid={`sidebar-workflow-${wf.id}`}
                            style={{
                              padding: '4px var(--s-3) 4px 64px',
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
                              display: 'block',
                            }}
                          >
                            {wf.name}
                          </NavLink>
                        );
                      })
                    )}
                    {hiddenCount > 0 && (
                      <NavLink
                        to={categoryPath(basePath, pack.packId, pack.versionId, 'workflows')}
                        end
                        data-testid={`sidebar-workflows-overflow-${pack.packId}`}
                        style={{
                          padding: '4px var(--s-3) 4px 64px',
                          fontFamily: 'var(--mono)',
                          fontSize: '10px',
                          color: defaultColor,
                          textDecoration: 'none',
                          letterSpacing: '0.4px',
                        }}
                      >
                        +{hiddenCount} more
                      </NavLink>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
