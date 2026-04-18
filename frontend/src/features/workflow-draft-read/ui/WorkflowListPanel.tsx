import { Inbox, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkflowList } from '../model/useWorkflowList';
import type { WorkflowSummary } from '../../../entities/workflow/model/types';
import styles from './workflow-list-panel.module.css';
import { useEffect } from 'react';

interface WorkflowListPanelProps {
  wsId: number;
  packId: number;
  versionId: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
}

function parseTerminalCount(json: string): number {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function WorkflowListItem({
  item,
  isSelected,
  onSelect,
}: {
  item: WorkflowSummary;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const terminalCount = parseTerminalCount(item.terminalStatesJson);

  return (
    <div
      className={`${styles.listItem} ${isSelected ? styles.listItemActive : ''}`}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
    >
      <div className={styles.itemCode}>{item.workflowCode}</div>
      <div className={styles.itemName}>{item.name}</div>
      <div className={styles.itemBadges}>
        {item.initialState && (
          <span className={styles.badge} title="초기 상태">
            {item.initialState}
          </span>
        )}
        {terminalCount > 0 && (
          <span className={`${styles.badge} ${styles.badgeMuted}`} title="종료 상태 수">
            +{terminalCount}
          </span>
        )}
      </div>
    </div>
  );
}

export function WorkflowListPanel({
  wsId,
  packId,
  versionId,
  selectedId,
  onSelect,
}: WorkflowListPanelProps) {
  const listState = useWorkflowList(wsId, packId, versionId);

  useEffect(() => {
    if (listState.status === 'error') {
      toast.error(listState.message);
    }
  }, [listState.status]);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Workflows</span>
        {listState.status === 'ready' && (
          <span className={styles.count}>{listState.data.length}개</span>
        )}
      </div>

      <div className={styles.listBody}>
        {listState.status === 'loading' && (
          <div className={styles.skeleton}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className={styles.skeletonItem} />
            ))}
          </div>
        )}

        {listState.status === 'error' && (
          <div className={styles.errorState}>
            <AlertCircle size={32} className={styles.errorIcon} />
            <p className={styles.errorText}>{listState.message}</p>
          </div>
        )}

        {listState.status === 'ready' && listState.data.length === 0 && (
          <div className={styles.emptyState}>
            <Inbox size={36} className={styles.emptyIcon} />
            <p className={styles.emptyText}>workflow 초안이 없습니다</p>
          </div>
        )}

        {listState.status === 'ready' &&
          listState.data.map((item) => (
            <WorkflowListItem
              key={item.id}
              item={item}
              isSelected={selectedId === item.id}
              onSelect={() => onSelect(item.id)}
            />
          ))}
      </div>
    </aside>
  );
}
