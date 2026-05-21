export type SortDir = "asc" | "desc";
export type WorkflowSortField = "name" | "workflowCode";

export interface SidebarWorkflowSettings {
  topN: number;
  sortField: WorkflowSortField;
  sortDir: SortDir;
}

export interface PageWorkflowSettings {
  pageSize: number;
  sortField: WorkflowSortField;
  sortDir: SortDir;
}

export const DEFAULT_SIDEBAR_SETTINGS: SidebarWorkflowSettings = {
  topN: 5,
  sortField: "workflowCode",
  sortDir: "asc",
};

export const DEFAULT_PAGE_SETTINGS: PageWorkflowSettings = {
  pageSize: 12,
  sortField: "workflowCode",
  sortDir: "asc",
};

const SIDEBAR_KEY = "ostone:sidebar:workflow-settings";
const PAGE_KEY = "ostone:page:workflow-settings";

export const PAGE_SIZE_OPTIONS = [6, 12, 24] as const;
export const TOP_N_OPTIONS = [3, 5, 10, 20] as const;
export const SORT_FIELD_OPTIONS: ReadonlyArray<{ value: WorkflowSortField; label: string }> = [
  { value: "workflowCode", label: "Code" },
  { value: "name", label: "Name" },
];
export const SORT_DIR_OPTIONS: ReadonlyArray<{ value: SortDir; label: string }> = [
  { value: "asc", label: "Asc" },
  { value: "desc", label: "Desc" },
];

function safeParse<T>(raw: string | null, fallback: T, validate: (v: unknown) => v is T): T {
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return validate(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function isSidebarSettings(v: unknown): v is SidebarWorkflowSettings {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj.topN === "number" &&
    (TOP_N_OPTIONS as ReadonlyArray<number>).includes(obj.topN) &&
    (obj.sortField === "name" || obj.sortField === "workflowCode") &&
    (obj.sortDir === "asc" || obj.sortDir === "desc")
  );
}

function isPageSettings(v: unknown): v is PageWorkflowSettings {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj.pageSize === "number" &&
    (PAGE_SIZE_OPTIONS as ReadonlyArray<number>).includes(obj.pageSize) &&
    (obj.sortField === "name" || obj.sortField === "workflowCode") &&
    (obj.sortDir === "asc" || obj.sortDir === "desc")
  );
}

export function readSidebarWorkflowSettings(): SidebarWorkflowSettings {
  if (typeof window === "undefined") return DEFAULT_SIDEBAR_SETTINGS;
  return safeParse(
    window.localStorage.getItem(SIDEBAR_KEY),
    DEFAULT_SIDEBAR_SETTINGS,
    isSidebarSettings,
  );
}

export function writeSidebarWorkflowSettings(value: SidebarWorkflowSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SIDEBAR_KEY, JSON.stringify(value));
  } catch {
    /* quota or disabled — ignore */
  }
}

export function readPageWorkflowSettings(): PageWorkflowSettings {
  if (typeof window === "undefined") return DEFAULT_PAGE_SETTINGS;
  return safeParse(window.localStorage.getItem(PAGE_KEY), DEFAULT_PAGE_SETTINGS, isPageSettings);
}

export function writePageWorkflowSettings(value: PageWorkflowSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PAGE_KEY, JSON.stringify(value));
  } catch {
    /* quota or disabled — ignore */
  }
}

export interface SortableWorkflow {
  name?: string;
  workflowCode?: string | null;
}

export function compareWorkflows<T extends SortableWorkflow>(
  a: T,
  b: T,
  field: WorkflowSortField,
  dir: SortDir,
): number {
  const av = (a[field] ?? "").toString().toLowerCase();
  const bv = (b[field] ?? "").toString().toLowerCase();
  const cmp = av.localeCompare(bv);
  return dir === "asc" ? cmp : -cmp;
}
