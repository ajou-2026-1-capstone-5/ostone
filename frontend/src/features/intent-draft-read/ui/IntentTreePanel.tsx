import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import type { IntentListState, IntentTreeNode } from "../../../entities/intent";
import { buildIntentTree } from "../model/buildIntentTree";
import styles from "./IntentTreePanel.module.css";

interface IntentTreePanelProps {
  intentListState: IntentListState;
  selectedId: number | null;
  onSelect: (id: number) => void;
  markers?: Record<number, "수정 중" | "수정됨">;
}

export function IntentTreePanel({
  intentListState,
  selectedId,
  onSelect,
  markers = {},
}: IntentTreePanelProps) {
  const state = intentListState;
  const errorMessage = state.status === "error" ? state.message : undefined;
  const tree = useMemo(
    () => (state.status === "ready" ? buildIntentTree(state.data) : []),
    [state],
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(errorMessage ?? "목록을 불러오지 못했습니다.");
    }
  }, [state.status, errorMessage]);

  return (
    <aside className={styles.panel} aria-label="상담 유형 목록">
      <header className={styles.header}>
        <span className={styles.headerTitle}>상담 유형</span>
        <span className={styles.headerMeta}>
          {state.status === "ready" ? `${state.data.length}개` : "—개"}
        </span>
      </header>

      <div className={styles.scroll}>
        {state.status === "loading" && (
          <div className={styles.skeletonGroup}>
            <div className={styles.skeletonRow} />
            <div className={styles.skeletonRow} />
            <div className={styles.skeletonRow} />
          </div>
        )}

        {state.status === "error" && (
          <div className={styles.emptyState}>
            <span>목록을 불러오지 못했습니다.</span>
          </div>
        )}

        {state.status === "ready" && state.data.length === 0 && (
          <div className={styles.emptyState}>
            <span>해당 버전에 등록된 상담 유형 초안이 없습니다.</span>
          </div>
        )}

        {state.status === "ready" && state.data.length > 0 && (
          <div className={styles.treeGroup}>
            {tree.map((node) => (
              <IntentTreeRow
                key={node.id}
                node={node}
                depth={0}
                selectedId={selectedId}
                onSelect={onSelect}
                markers={markers}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function IntentTreeRow({
  node,
  depth,
  selectedId,
  onSelect,
  markers,
}: {
  node: IntentTreeNode;
  depth: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
  markers: Record<number, "수정 중" | "수정됨">;
}) {
  const isActive = node.id === selectedId;
  const paddingLeft = 20 + depth * 18;
  const intentId = node.id;
  const hasIntentId = intentId !== null && intentId !== undefined;
  const marker = hasIntentId ? markers[intentId] : undefined;
  const isLevelOne = node.taxonomyLevel === 1;
  const itemClassName = [
    styles.item,
    isLevelOne ? styles.itemLevelOne : "",
    isActive ? styles.itemActive : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <button
        type="button"
        className={itemClassName}
        style={{ paddingLeft }}
        onClick={() => {
          if (hasIntentId) onSelect(intentId);
        }}
        aria-current={isActive ? "true" : undefined}
      >
        <div className={styles.itemInner}>
          <span className={styles.code}>{node.intentCode}</span>
          <span className={styles.name}>{node.name}</span>
          <span className={styles.meta}>
            <span className={styles.badge}>LV · {node.taxonomyLevel}</span>
            <span className={styles.badge}>{node.status}</span>
            {marker && <span className={styles.marker}>{marker}</span>}
          </span>
        </div>
      </button>

      {node.children.map((child) => (
        <IntentTreeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
          markers={markers}
        />
      ))}
    </>
  );
}
