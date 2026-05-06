import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from '../atoms/Icon';
import type { IconName } from '../atoms/Icon';
import { Avatar } from '../atoms/Avatar';

export type SidebarActive =
  | 'workflows'
  | 'domain'
  | 'pipeline'
  | 'consult'
  | 'upload';

interface SidebarProps {
  active: SidebarActive;
  dark?: boolean;
  basePath?: string;
  switcher?: ReactNode;
}

const NAV_ITEMS: { key: SidebarActive; icon: IconName; label: string; getPath: (base: string) => string }[] = [
  { key: 'workflows', icon: 'grid', label: 'Workflows', getPath: (base) => `${base}/workflows` },
  { key: 'domain', icon: 'folder', label: 'Domain Packs', getPath: (base) => `${base}/domain-packs` },
  { key: 'pipeline', icon: 'flow', label: 'Pipeline', getPath: (base) => `${base}/pipeline` },
  { key: 'consult', icon: 'msg', label: 'Consultation', getPath: (base) => `${base}/consultation` },
  { key: 'upload', icon: 'upload', label: 'Uploads', getPath: (base) => `${base}/upload` },
];

export function Sidebar({ active, dark = false, basePath = '/workspaces', switcher }: SidebarProps) {
  const containerBg = dark ? 'var(--dark-bg)' : 'var(--paper-2)';
  const borderColor = dark ? 'var(--dark-line)' : 'var(--line)';
  const defaultColor = dark ? 'var(--dark-ink-3)' : 'var(--ink-3)';
  const hoverBg = dark ? 'var(--dark-bg-2)' : 'var(--paper-3)';
  const activeColor = dark ? 'var(--dark-ink)' : 'var(--ink)';

  return (
    <nav
      style={{
        width: '56px',
        background: containerBg,
        borderRight: `1px solid ${borderColor}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 'var(--s-3) 0',
        gap: 'var(--s-2)',
        height: '100%',
        flexShrink: 0,
      }}
      aria-label="주요 낸비게이션"
    >
      <div style={{ marginBottom: 'var(--s-4)' }}>
        {switcher}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--s-1)',
          flex: 1,
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.key;

          return (
            <NavLink
              key={item.key}
              to={item.getPath(basePath)}
              end
              title={item.label}
              data-active={isActive ? 'true' : 'false'}
              style={{
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
              }}
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
              <Icon name={item.icon} size={16} />
            </NavLink>
          );
        })}
      </div>

      <div style={{ marginTop: 'auto' }}>
        <Avatar tone="signal" initial="BS" size={28} />
      </div>
    </nav>
  );
}
