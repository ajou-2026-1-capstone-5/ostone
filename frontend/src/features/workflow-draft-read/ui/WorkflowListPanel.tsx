import { useEffect, useMemo } from 'react';
import { Inbox, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkflowList } from '../model/useWorkflowList';
import { parseTerminalStates } from '../model/parseTerminalStates';
import type { WorkflowSummary } from '../../../entities/workflow/model/types';
import styles from './workflow-list-panel.module.css';

interface WorkflowListPanelProps {
  wsId: number;
  packId: number;
  versionId: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
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
  const terminalCount = useMemo(() => {
    const parsed = parseTerminalStates(item.terminalStatesJson);
    return Array.isArray(parsed) ? parsed.length : 0;
  }, [item.terminalStatesJson]);

  return (
    <button
      type="button"
      className={`${styles.listItem} ${isSelected ? styles.listItemActive : ''}`}
      onClick={onSelect}
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
    </button>
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
  }, [listState]);

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
            <p className={styles.errorText}>워크플로우를 불러오는 중 오류가 발생했습니다. 다시 시도해 주세요.</p>
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