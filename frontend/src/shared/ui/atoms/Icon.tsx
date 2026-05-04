import React from 'react';
import { cn } from '@/shared/lib/utils';

export type IconName =
  | 'arrow'
  | 'expand'
  | 'plus'
  | 'search'
  | 'upload'
  | 'file'
  | 'folder'
  | 'grid'
  | 'flow'
  | 'close'
  | 'check'
  | 'chevron'
  | 'dot3'
  | 'user'
  | 'bot'
  | 'msg'
  | 'spark'
  | 'branch'
  | 'db'
  | 'eye'
  | 'edit'
  | 'play'
  | 'clock'
  | 'filter'
  | 'download'
  | 'book'
  | 'shield'
  | 'info'
  | 'pause'
  | 'csv'
  | 'parquet'
  | 'jsonl';

const glyphs: Record<IconName, React.JSX.Element> = {
  arrow: <path d="M5 12h14M12 5l7 7-7 7" />,
  expand: <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="7" />
      <path d="m21 21-5.2-5.2" />
    </>
  ),
  upload: (
    <>
      <path d="M12 3v12m0-12 4 4m-4-4-4 4" />
      <path d="M16 21H8a2 2 0 0 1-2-2v-2" />
    </>
  ),
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </>
  ),
  folder: <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </>
  ),
  flow: (
    <>
      <path d="M12 3v10m0 0a3 3 0 1 0 0 6m0-6a3 3 0 1 1 0-6" />
      <path d="M3 19h6m12 0h-6" />
    </>
  ),
  close: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="m5 12 5 5L20 7" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  dot3: (
    <>
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </>
  ),
  user: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  bot: (
    <>
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M9 13h.01M15 13h.01" />
      <path d="M12 3v5m-3-3 3-3 3 3" />
    </>
  ),
  msg: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  spark: <path d="M12 3c.5 3.5 3 6 6.5 7-3.5 1-6 3.5-7 6.5C10.5 13 8 10.5 3.5 9.5 7 8.5 9.5 6 10.5 3Z" />,
  branch: <path d="M6 3v12m0 0a3 3 0 1 0 0 6m0-6a3 3 0 1 1 0-6m0 0 12 4m0 0a3 3 0 1 0 0 6m0-6a3 3 0 1 1 0-6" />,
  db: (
    <>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </>
  ),
  eye: (
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  edit: (
    <>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </>
  ),
  play: <polygon points="5 3 19 12 5 21 5 3" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  filter: <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />,
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </>
  ),
  pause: (
    <>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </>
  ),
  csv: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <text x="8" y="16" fontSize="7" fontFamily="var(--mono)" fill="currentColor" stroke="none" fontWeight="600">CSV</text>
    </>
  ),
  parquet: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <text x="5" y="16" fontSize="7" fontFamily="var(--mono)" fill="currentColor" stroke="none" fontWeight="600">PARQ</text>
    </>
  ),
  jsonl: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <text x="6" y="16" fontSize="7" fontFamily="var(--mono)" fill="currentColor" stroke="none" fontWeight="600">JSON</text>
    </>
  ),
};

export interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 16, className, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
      className={cn('shrink-0', className)}
      {...rest}
    >
      {glyphs[name]}
    </svg>
  );
}
