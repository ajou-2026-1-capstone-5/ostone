import { useMemo, useState } from "react";

import type { WorkspaceWorkflowEntry } from "@/entities/workflow";
import {
  PAGE_SIZE_OPTIONS,
  SORT_DIR_OPTIONS,
  SORT_FIELD_OPTIONS,
  compareWorkflows,
  readPageWorkflowSettings,
  writePageWorkflowSettings,
  type PageWorkflowSettings,
} from "@/shared/lib/workflowSettings";
import { Icon } from "@/shared/ui/ostone/atoms/Icon";
import {
  WorkflowSettingsPanel,
  type WorkflowSettingEntry,
} from "@/shared/ui/ostone/chrome/WorkflowSettingsPanel";

import { WorkflowCard } from "./WorkflowCard";
import { WorkflowSearchBar } from "./WorkflowSearchBar";
import styles from "./workflow-list-view.module.css";

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
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [page, setPage] = useState(1);
  const [filterWorkflowId, setFilterWorkflowId] = useState<number | null>(null);

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

  const handleToggleCard = (workflowId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(workflowId)) next.delete(workflowId);
      else next.add(workflowId);
      return next;
    });
  };

  const settingsEntries: WorkflowSettingEntry[] = [
    {
      key: "pageSize",
      label: "Per page",
      value: settings.pageSize,
      options: PAGE_SIZE_OPTIONS.map((n) => ({ value: n, label: String(n) })),
      onChange: (next) => updateSettings({ pageSize: Number(next) }),
    },
    {
      key: "sortField",
      label: "Sort by",
      value: settings.sortField,
      options: SORT_FIELD_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
      onChange: (next) =>
        updateSettings({ sortField: next === "name" ? "name" : "workflowCode" }),
    },
    {
      key: "sortDir",
      label: "Order",
      value: settings.sortDir,
      options: SORT_DIR_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
      onChange: (next) => updateSettings({ sortDir: next === "desc" ? "desc" : "asc" }),
    },
  ];

  const filteredEntryName =
    filterWorkflowId !== null
      ? entries.find((e) => e.workflowId === filterWorkflowId)?.name ?? null
      : null;

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
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          aria-label="페이지 표시 설정"
          aria-expanded={settingsOpen}
          data-testid={`${testIdPrefix}-settings-toggle`}
          className={styles.settingsBtn}
          data-active={settingsOpen ? "true" : "false"}
        >
          <Icon name="settings" size={14} />
        </button>
      </div>

      {settingsOpen && (
        <WorkflowSettingsPanel
          entries={settingsEntries}
          testId={`${testIdPrefix}-settings`}
        />
      )}

      {filterWorkflowId !== null && filteredEntryName && (
        <button
          type="button"
          data-testid={`${testIdPrefix}-filter-chip`}
          onClick={() => setFilterWorkflowId(null)}
          className={styles.filterChip}
        >
          <span>{filteredEntryName}</span>
          <Icon name="close" size={10} />
        </button>
      )}

      <div className={styles.masonry} data-testid={`${testIdPrefix}-masonry`}>
        {pageEntries.map((entry) => (
          <WorkflowCard
            key={`${entry.packId}-${entry.workflowId}`}
            entry={entry}
            expanded={expanded.has(entry.workflowId)}
            onToggle={() => handleToggleCard(entry.workflowId)}
            onOpen={() => onOpen(entry)}
            testIdPrefix={testIdPrefix}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div
          className={styles.pagination}
          data-testid={`${testIdPrefix}-pagination`}
          role="navigation"
          aria-label="pagination"
        >
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            data-testid={`${testIdPrefix}-pagination-prev`}
            className={styles.pageBtn}
          >
            Prev
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
            Next
          </button>
        </div>
      )}
    </div>
  );
}

