import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Icon } from '../atoms/Icon';
import { Avatar } from '../atoms/Avatar';
import { clearAuthSession, getAuthUser } from '@/shared/lib/auth';

interface AccountMenuProps {
  collapsed: boolean;
}

function deriveInitial(name: string | undefined | null, email: string | undefined | null): string {
  const source = name?.trim() || email?.trim() || '?';
  return source.slice(0, 1).toUpperCase();
}

export function AccountMenu({ collapsed }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const user = getAuthUser();
  const initial = deriveInitial(user?.name, user?.email);
  const displayName = user?.name ?? user?.email ?? '게스트';

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPopoverPos({
      top: rect.top - 8,
      left: collapsed ? rect.right + 8 : rect.left,
      width: collapsed ? 220 : rect.width,
    });
  }, [open, collapsed]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
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
      ref={triggerRef}
      type="button"
      aria-label="계정 메뉴"
      onClick={() => setOpen((v) => !v)}
      data-testid="account-menu-trigger"
      data-state={open ? 'open' : 'closed'}
      style={{
        width: '40px',
        height: '40px',
        borderRadius: 'var(--r-2)',
        border: '1px solid var(--line)',
        background: open ? 'var(--paper-3)' : 'var(--paper)',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        transition: 'background 160ms ease',
      }}
    >
      <Avatar tone="signal" initial={initial} size={28} />
    </button>
  );

  const triggerExpanded = (
    <button
      ref={triggerRef}
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
        fontSize: '13px',
        transition: 'background 160ms ease',
      }}
    >
      <Avatar tone="signal" initial={initial} size={28} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {displayName}
      </span>
      <span style={{ display: 'inline-flex', transform: open ? 'rotate(270deg)' : 'rotate(90deg)', transition: 'transform 160ms ease' }}>
        <Icon name="chevron" size={12} />
      </span>
    </button>
  );

  const popoverStyle: CSSProperties = popoverPos
    ? {
        position: 'fixed',
        top: popoverPos.top,
        left: popoverPos.left,
        transform: 'translateY(-100%)',
        width: popoverPos.width,
        background: 'var(--paper)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-2)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
        padding: 'var(--s-2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--s-1)',
        zIndex: 60,
      }
    : { display: 'none' };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: collapsed ? 'auto' : '100%' }}>
      {collapsed ? triggerCollapsed : triggerExpanded}

      {open && createPortal(
        <div
          ref={popoverRef}
          data-testid="account-menu-popover"
          style={popoverStyle}
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
        </div>,
        document.body,
      )}
    </div>
  );
}
