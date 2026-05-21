export type IconName =
  | "arrow"
  | "expand"
  | "plus"
  | "search"
  | "upload"
  | "file"
  | "folder"
  | "grid"
  | "flow"
  | "close"
  | "check"
  | "chevron"
  | "dot3"
  | "user"
  | "bot"
  | "msg"
  | "spark"
  | "branch"
  | "db"
  | "eye"
  | "edit"
  | "play"
  | "clock"
  | "filter"
  | "download"
  | "book"
  | "shield"
  | "info"
  | "settings";

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

const ICONS: Record<IconName, React.ReactNode> = {
  arrow: (
    <>
      <line x1="4" y1="8" x2="12" y2="8" />
      <polyline points="9 5 12 8 9 11" />
    </>
  ),
  expand: (
    <>
      <polyline points="9 3 13 3 13 7" />
      <polyline points="3 9 3 13 7 13" />
      <line x1="13" y1="3" x2="8" y2="8" />
      <line x1="3" y1="13" x2="8" y2="8" />
    </>
  ),
  plus: (
    <>
      <line x1="8" y1="4" x2="8" y2="12" />
      <line x1="4" y1="8" x2="12" y2="8" />
    </>
  ),
  search: (
    <>
      <circle cx="7" cy="7" r="4" />
      <line x1="10.5" y1="10.5" x2="13" y2="13" />
    </>
  ),
  upload: (
    <>
      <polyline points="8 4 8 12" />
      <polyline points="5 7 8 4 11 7" />
      <line x1="4" y1="13" x2="12" y2="13" />
    </>
  ),
  file: (
    <>
      <path d="M9 3H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6l-3-3z" />
      <polyline points="9 3 9 6 12 6" />
    </>
  ),
  folder: (
    <>
      <path d="M14 6H8L6 4H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1z" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="4" height="4" />
      <rect x="9" y="3" width="4" height="4" />
      <rect x="3" y="9" width="4" height="4" />
      <rect x="9" y="9" width="4" height="4" />
    </>
  ),
  flow: (
    <>
      <rect x="3" y="3" width="4" height="4" rx="1" />
      <rect x="9" y="9" width="4" height="4" rx="1" />
      <polyline points="7 5 9 5 9 9" />
    </>
  ),
  close: (
    <>
      <line x1="5" y1="5" x2="11" y2="11" />
      <line x1="11" y1="5" x2="5" y2="11" />
    </>
  ),
  check: (
    <>
      <polyline points="4 8 7 11 12 5" />
    </>
  ),
  chevron: (
    <>
      <polyline points="6 4 10 8 6 12" />
    </>
  ),
  dot3: (
    <>
      <circle cx="5" cy="8" r="0.8" />
      <circle cx="8" cy="8" r="0.8" />
      <circle cx="11" cy="8" r="0.8" />
    </>
  ),
  user: (
    <>
      <circle cx="8" cy="6" r="3" />
      <path d="M3 14a5 5 0 0 1 10 0" />
    </>
  ),
  bot: (
    <>
      <rect x="4" y="6" width="8" height="6" rx="1" />
      <circle cx="6" cy="9" r="0.8" />
      <circle cx="10" cy="9" r="0.8" />
      <line x1="8" y1="4" x2="8" y2="6" />
      <line x1="7" y1="4" x2="9" y2="4" />
    </>
  ),
  msg: (
    <>
      <path d="M3 4h12v9H8l-3 3v-3H3z" />
    </>
  ),
  spark: (
    <>
      <polyline points="9 2 5 9 9 9 7 14 11 7 7 7 9 2" />
    </>
  ),
  branch: (
    <>
      <circle cx="5" cy="5" r="2" />
      <circle cx="11" cy="5" r="2" />
      <circle cx="8" cy="12" r="2" />
      <line x1="5" y1="7" x2="8" y2="10" />
      <line x1="11" y1="7" x2="8" y2="10" />
    </>
  ),
  db: (
    <>
      <ellipse cx="8" cy="5" rx="5" ry="2" />
      <path d="M3 5v6a5 2 0 0 0 10 0V5" />
      <path d="M3 8a5 2 0 0 0 10 0" />
    </>
  ),
  eye: (
    <>
      <path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" />
      <circle cx="8" cy="8" r="2" />
    </>
  ),
  edit: (
    <>
      <path d="M11 3l2 2-7 7H4v-2l7-7z" />
      <line x1="10" y1="5" x2="11" y2="4" />
    </>
  ),
  play: (
    <>
      <polygon points="5 4 13 8 5 12 5 4" />
    </>
  ),
  clock: (
    <>
      <circle cx="8" cy="8" r="6" />
      <polyline points="8 4 8 8 11 10" />
    </>
  ),
  filter: (
    <>
      <polygon points="3 4 13 4 9 9 9 13 7 13 7 9 3 4" />
    </>
  ),
  download: (
    <>
      <polyline points="8 4 8 12" />
      <polyline points="5 9 8 12 11 9" />
      <line x1="4" y1="13" x2="12" y2="13" />
    </>
  ),
  book: (
    <>
      <path d="M4 4h10v10H4z" />
      <line x1="8" y1="4" x2="8" y2="14" />
    </>
  ),
  shield: (
    <>
      <path d="M8 2l5 2v5a6 6 0 0 1-5 5 6 6 0 0 1-5-5V4z" />
    </>
  ),
  info: (
    <>
      <circle cx="8" cy="8" r="6" />
      <line x1="8" y1="8" x2="8" y2="11" />
      <line x1="8" y1="5" x2="8" y2="5.01" />
    </>
  ),
  settings: (
    <>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8L3.4 3.4" />
    </>
  ),
};

export function Icon({ name, size = 16, className }: IconProps) {
  if (!name || !ICONS[name]) {
    return null;
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {ICONS[name]}
    </svg>
  );
}
