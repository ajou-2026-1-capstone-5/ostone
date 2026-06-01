import { useMemo, useRef, useState } from "react";
import { Settings as SettingsIcon, X as XIcon } from "lucide-react";

import { WorkflowGraphMini, type WorkspaceWorkflowEntry } from "@/entities/workflow";
import {
  PAGE_SIZE_OPTIONS,
  SORT_DIR_OPTIONS,
  SORT_FIELD_OPTIONS,
  compareWorkflows,
  readPageWorkflowSettings,
  writePageWorkflowSettings,
  type PageWorkflowSettings,
} from "@/shared/lib/workflowSettings";
import { EmptyState } from "@/shared/ui/ostone/atoms/EmptyState";
import {
  WorkflowSettingsPanel,
  type WorkflowSettingEntry,
} from "@/shared/ui/ostone/chrome/WorkflowSettingsPanel";
import { WorkflowRow } from "@/shared/ui/ostone/molecules/WorkflowRow";

import { WorkflowSearchBar } from "./WorkflowSearchBar";
import styles from "./workflow-list-view.module.css";

const SORT_FIELD_KO_LABELS: Record<(typeof SORT_FIELD_OPTIONS)[number]["value"], string> = {
  workflowCode: "워크플로우 코드",
  name: "이름",
};

const SORT_DIR_KO_LABELS: Record<(typeof SORT_DIR_OPTIONS)[number]["value"], string> = {
  asc: "오름차순",
  desc: "내림차순",
};

interface WorkflowListViewProps {
  entries: WorkspaceWorkflowEntry[];
  onOpen: (entry: WorkspaceWorkflowEntry) => void;
  testIdPrefix?: string;
}

export function WorkflowListView({
  entries,
  onOpen,
  testIdPrefix = "workflow-list",
}: WorkflowListViewProps) {
  const [settings, setSettings] = useState<PageWorkflowSettings>(() => readPageWorkflowSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [filterWorkflowId, setFilterWorkflowId] = useState<number | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  const updateSettings = (patch: Partial<PageWorkflowSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      writePageWorkflowSettings(next);
      return next;
    });
    setPage(1);
  };

  const filteredAndSorted = useMemo(() => {
    const filtered =
      filterWorkflowId !== null
        ? entries.filter((e) => e.workflowId === filterWorkflowId)
        : entries;
    return [...filtered].sort((a, b) =>
      compareWorkflows(a, b, settings.sortField, settings.sortDir),
    );
  }, [entries, settings.sortField, settings.sortDir, filterWorkflowId]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / settings.pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * settings.pageSize;
  const pageEntries = filteredAndSorted.slice(pageStart, pageStart + settings.pageSize);

  const settingsEntries: WorkflowSettingEntry[] = [
    {
      key: "pageSize",
      label: "페이지 크기",
      value: settings.pageSize,
      options: PAGE_SIZE_OPTIONS.map((n) => ({ value: n, label: String(n) })),
      onChange: (next) => updateSettings({ pageSize: Number(next) }),
    },
    {
      key: "sortField",
      label: "정렬 기준",
      value: settings.sortField,
      options: SORT_FIELD_OPTIONS.map((o) => ({
        value: o.value,
        label: SORT_FIELD_KO_LABELS[o.value],
      })),
      onChange: (next) => updateSettings({ sortField: next === "name" ? "name" : "workflowCode" }),
    },
    {
      key: "sortDir",
      label: "정렬 방식",
      value: settings.sortDir,
      options: SORT_DIR_OPTIONS.map((o) => ({
        value: o.value,
        label: SORT_DIR_KO_LABELS[o.value],
      })),
      onChange: (next) => updateSettings({ sortDir: next === "desc" ? "desc" : "asc" }),
    },
  ];

  const filteredEntryName =
    filterWorkflowId !== null
      ? (entries.find((e) => e.workflowId === filterWorkflowId)?.name ?? null)
      : null;

  const [prevEntries, setPrevEntries] = useState(entries);
  if (entries !== prevEntries) {
    setPrevEntries(entries);
    if (filterWorkflowId !== null && !entries.some((e) => e.workflowId === filterWorkflowId)) {
      setFilterWorkflowId(null);
      setPage(1);
    }
  }

  return (
    <div className={styles.root} data-testid={testIdPrefix}>
      <div className={styles.header}>
        <div className={styles.searchSlot}>
          <WorkflowSearchBar
            entries={entries}
            onFilter={(workflowId) => {
              setFilterWorkflowId(workflowId);
              setPage(1);
            }}
            testIdPrefix={`${testIdPrefix}-search`}
          />
        </div>
        <div className={styles.settingsAnchor}>
          <button
            ref={settingsButtonRef}
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-label="페이지 표시 설정"
            aria-expanded={settingsOpen}
            data-testid={`${testIdPrefix}-settings-toggle`}
            className={styles.settingsBtn}
            data-active={settingsOpen ? "true" : "false"}
          >
            <SettingsIcon size={14} />
          </button>
          {settingsOpen && (
            <WorkflowSettingsPanel
              entries={settingsEntries}
              testId={`${testIdPrefix}-settings`}
              style={{ top: "calc(100% + 6px)", right: 0 }}
              onClickOutside={() => setSettingsOpen(false)}
              anchorRef={settingsButtonRef}
            />
          )}
        </div>
      </div>

      {filterWorkflowId !== null && filteredEntryName && (
        <button
          type="button"
          data-testid={`${testIdPrefix}-filter-chip`}
          onClick={() => setFilterWorkflowId(null)}
          className={styles.filterChip}
        >
          <span>{filteredEntryName}</span>
          <XIcon size={10} />
        </button>
      )}

      {pageEntries.length === 0 && (
        <EmptyState message={filterWorkflowId !== null ? "필터 결과 없음" : "워크플로우 없음"} />
      )}

      <div className={styles.list} data-testid={`${testIdPrefix}-list`}>
        {pageEntries.map((entry) => (
          <WorkflowRow
            key={`${entry.packId}-${entry.workflowId}`}
            entry={entry}
            onOpen={() => onOpen(entry)}
            testIdPrefix={`${testIdPrefix}-card`}
            graphSlot={
              <WorkflowGraphMini
                workspaceId={null}
                packId={entry.packId}
                versionId={entry.versionId}
                workflowId={entry.workflowId}
              />
            }
          />
        ))}
      </div>

      {totalPages > 1 && (
        <nav
          className={styles.pagination}
          data-testid={`${testIdPrefix}-pagination`}
          aria-label="페이지 이동"
        >
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            data-testid={`${testIdPrefix}-pagination-prev`}
            className={styles.pageBtn}
          >
            이전
          </button>
          <span className={styles.pageInfo} data-testid={`${testIdPrefix}-pagination-info`}>
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            data-testid={`${testIdPrefix}-pagination-next`}
            className={styles.pageBtn}
          >
            다음
          </button>
        </nav>
      )}
    </div>
  );
}
