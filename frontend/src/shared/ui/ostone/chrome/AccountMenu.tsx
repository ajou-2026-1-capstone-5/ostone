import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Icon } from '../atoms/Icon';
import { Avatar } from '../atoms/Avatar';
import { clearAuthSession, getAuthUser } from '@/shared/lib/auth';

interface AccountMenuProps {
  collapsed: boolean;
}

function deriveInitial(name: string | undefined | null, email: string | undefined | null): string {
  const source = (name && name.trim()) || (email && email.trim()) || '?';
  return source.slice(0, 1).toUpperCase();
}

export function AccountMenu({ collapsed }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const user = getAuthUser();
  const initial = deriveInitial(user?.name, user?.email);
  const displayName = user?.name ?? user?.email ?? '게스트';

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleLogout = () => {
    clearAuthSession();
    setOpen(false);
    navigate('/login');
  };

  const handleSettings = () => {
    setOpen(false);
    toast('설정 화면은 준비 중입니다.');
  };

  const triggerCollapsed = (
    <button
      type="button"
      aria-label="계정 메뉴"
      onClick={() => setOpen((v) => !v)}
      data-testid="account-menu-trigger"
      data-state={open ? 'open' : 'closed'}
      style={{
        width: '32px',
        height: '32px',
        borderRadius: 'var(--r-2)',
        border: '1px solid var(--line)',
        background: open ? 'var(--paper-3)' : 'var(--paper)',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
      }}
    >
      <Avatar tone="signal" initial={initial} size={24} />
    </button>
  );

  const triggerExpanded = (
    <button
      type="button"
      aria-label="계정 메뉴"
      onClick={() => setOpen((v) => !v)}
      data-testid="account-menu-trigger"
      data-state={open ? 'open' : 'closed'}
      style={{
        width: '100%',
        height: '40px',
        padding: '0 var(--s-2)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--s-2)',
        background: open ? 'var(--paper-3)' : 'transparent',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-2)',
        cursor: 'pointer',
        textAlign: 'left',
        color: 'var(--ink)',
        fontFamily: 'var(--sans)',
        fontSize: '12px',
      }}
    >
      <Avatar tone="signal" initial={initial} size={24} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {displayName}
      </span>
      <span style={{ display: 'inline-flex', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms ease' }}>
        <Icon name="chevron" size={10} />
      </span>
    </button>
  );

  return (
    <div ref={containerRef} style={{ position: 'relative', width: collapsed ? 'auto' : '100%' }}>
      {collapsed ? triggerCollapsed : triggerExpanded}

      {open && (
        <div
          data-testid="account-menu-popover"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: collapsed ? 0 : 0,
            minWidth: collapsed ? '200px' : '100%',
            background: 'var(--paper)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-2)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            padding: 'var(--s-2)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--s-1)',
            zIndex: 40,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--s-2)',
              padding: '4px var(--s-2) 8px',
              borderBottom: '1px solid var(--line-2)',
            }}
          >
            <Avatar tone="signal" initial={initial} size={24} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontFamily: 'var(--sans)', fontSize: '12px', fontWeight: 500, color: 'var(--ink)' }}>
                {displayName}
              </span>
              {user?.email && user?.name && (
                <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-3)' }}>
                  {user.email}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            data-testid="account-menu-settings"
            onClick={handleSettings}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--s-2)',
              padding: '8px var(--s-2)',
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--r-1)',
              cursor: 'pointer',
              fontFamily: 'var(--sans)',
              fontSize: '12px',
              color: 'var(--ink)',
              textAlign: 'left',
            }}
          >
            <Icon name="info" size={12} />
            설정
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--ink-3)' }}>
              미구현
            </span>
          </button>

          <button
            type="button"
            data-testid="account-menu-logout"
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--s-2)',
              padding: '8px var(--s-2)',
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--r-1)',
              cursor: 'pointer',
              fontFamily: 'var(--sans)',
              fontSize: '12px',
              color: 'var(--ink)',
              textAlign: 'left',
            }}
          >
            <Icon name="arrow" size={12} />
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
