import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../atoms/Icon';
import { unwrapApiResponse } from '@/shared/api/unwrapApiResponse';
import { useListWorkspaces } from '@/shared/api/generated/endpoints/workspace-controller/workspace-controller';
import type { WorkspaceResponse } from '@/shared/api/generated/zod';

interface WorkspaceMarkerProps {
  workspaceId: number | null;
  collapsed: boolean;
}

function deriveInitial(name: string | null | undefined): string {
  if (!name) return '?';
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed.slice(0, 1).toUpperCase();
}

export function WorkspaceMarker({ workspaceId, collapsed }: WorkspaceMarkerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const query = useListWorkspaces({ query: { enabled: workspaceId !== null } });
  const workspaces = (unwrapApiResponse(query.data) as WorkspaceResponse[] | undefined) ?? [];
  const current = workspaces.find((w) => w.id === workspaceId);
  const name = current?.name ?? null;
  const initial = deriveInitial(name);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSwitch = (id: number) => {
    setOpen(false);
    navigate(`/workspaces/${id}/workflows`);
  };

  if (collapsed) {
    return (
      <button
        type="button"
        aria-label={name ? `현재 워크스페이스: ${name}` : '워크스페이스'}
        title={name ?? '워크스페이스'}
        onClick={() => setOpen((v) => !v)}
        data-testid="workspace-marker"
        style={{
          width: '32px',
          height: '32px',
          borderRadius: 'var(--r-2)',
          border: '1px solid var(--line)',
          background: 'var(--paper)',
          color: 'var(--ink)',
          fontFamily: 'var(--mono)',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {initial}
      </button>
    );
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        aria-label="워크스페이스 선택"
        onClick={() => setOpen((v) => !v)}
        data-testid="workspace-marker"
        style={{
          width: '100%',
          height: '36px',
          padding: '0 var(--s-2)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--s-2)',
          background: open ? 'var(--paper-3)' : 'var(--paper)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-2)',
          color: 'var(--ink)',
          fontFamily: 'var(--sans)',
          fontSize: '12px',
          fontWeight: 500,
          letterSpacing: '-0.1px',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            width: '22px',
            height: '22px',
            borderRadius: 'var(--r-1)',
            background: 'var(--paper-3)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--mono)',
            fontWeight: 600,
            fontSize: '11px',
            color: 'var(--ink)',
            flexShrink: 0,
          }}
        >
          {initial}
        </span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name ?? '워크스페이스 선택'}
        </span>
        <span style={{ display: 'inline-flex', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms ease' }}>
          <Icon name="chevron" size={10} />
        </span>
      </button>

      {open && (
        <div
          data-testid="workspace-marker-menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'var(--paper)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-2)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            zIndex: 30,
            padding: 'var(--s-1) 0',
            maxHeight: '260px',
            overflowY: 'auto',
          }}
        >
          {workspaces.length === 0 && (
            <div
              style={{
                padding: 'var(--s-2) var(--s-3)',
                fontFamily: 'var(--mono)',
                fontSize: '10px',
                color: 'var(--ink-3)',
              }}
            >
              워크스페이스 없음
            </div>
          )}
          {workspaces.map((ws) => {
            const isCurrent = ws.id === workspaceId;
            return (
              <button
                key={ws.id}
                type="button"
                onClick={() => ws.id != null && handleSwitch(ws.id)}
                data-testid={`workspace-option-${ws.id}`}
                style={{
                  width: '100%',
                  padding: '8px var(--s-3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--s-2)',
                  background: isCurrent ? 'var(--paper-3)' : 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'var(--sans)',
                  fontSize: '12px',
                  color: 'var(--ink)',
                }}
              >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ws.name ?? `Workspace ${ws.id}`}
                </span>
                {isCurrent && <Icon name="check" size={12} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
