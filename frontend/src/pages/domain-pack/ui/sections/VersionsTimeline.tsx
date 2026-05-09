import { Mono, Dot } from '@/shared/ui/ostone/atoms';

interface VersionEntry {
  version: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  active?: boolean;
}

const VERSIONS: VersionEntry[] = [
  { version: 'v0.4', status: 'DRAFT', active: true },
  { version: 'v0.3', status: 'PUBLISHED' },
  { version: 'v0.2', status: 'PUBLISHED' },
  { version: 'v0.1', status: 'ARCHIVED' },
];

function statusTone(status: VersionEntry['status']): 'signal' | 'info' | 'mute' {
  switch (status) {
    case 'DRAFT':
      return 'signal';
    case 'PUBLISHED':
      return 'info';
    case 'ARCHIVED':
      return 'mute';
    default:
      return 'mute';
  }
}

export function VersionsTimeline() {
  return (
    <div style={{ padding: '12px' }}>
      <div
        className="t-eyebrow"
        style={{ marginBottom: '8px', display: 'block' }}
      >
        Versions
      </div>
      {VERSIONS.map((v) => (
        <div
          key={v.version}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 8px',
            borderRadius: 'var(--r-2)',
            background: v.active ? 'var(--paper-3)' : 'transparent',
            marginBottom: '2px',
          }}
        >
          <Mono style={{ fontSize: '11px', color: 'var(--ink)' }}>
            {v.version}
          </Mono>
          <Mono style={{ fontSize: '10px', color: 'var(--ink-3)' }}>
            {v.status}
          </Mono>
          <Dot tone={statusTone(v.status)} size={6} />
        </div>
      ))}
    </div>
  );
}
