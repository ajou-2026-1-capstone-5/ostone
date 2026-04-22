import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import type { IntentTreeNode } from "../../../entities/intent";
import { buildIntentTree } from "../model/buildIntentTree";
import { useIntentList } from "../model/useIntentList";
import styles from "./IntentTreePanel.module.css";

interface IntentTreePanelProps {
  wsId: number;
  packId: number;
  versionId: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function IntentTreePanel({
  wsId,
  packId,
  versionId,
  selectedId,
  onSelect,
}: IntentTreePanelProps) {
  const state = useIntentList(wsId, packId, versionId);
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
    <aside className={styles.panel} aria-label="intent 목록">
      <header className={styles.header}>
        <span className={styles.headerTitle}>Intents</span>
        <span className={styles.headerMeta}>
          {state.status === "ready" ? `${state.data.length} · TREE` : "— · TREE"}
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
            <span>해당 버전에 등록된 intent 초안이 없습니다.</span>
          </div>
        )}

        {state.status === "ready" && (
          <div className={styles.treeGroup}>
            {tree.map((node) => (
              <IntentTreeRow
                key={node.id}
                node={node}
                depth={0}
                selectedId={selectedId}
                onSelect={onSelect}
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
}: {
  node: IntentTreeNode;
  depth: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const isActive = node.id === selectedId;
  const paddingLeft = 20 + depth * 18;

  return (
    <>
      <button
        type="button"
        className={`${styles.item} ${isActive ? styles.itemActive : ""}`}
        style={{ paddingLeft }}
        onClick={() => onSelect(node.id)}
        aria-current={isActive ? "true" : undefined}
      >
        <div className={styles.itemInner}>
          {depth > 0 && <span className={styles.depthGuide} aria-hidden="true" />}
          <span className={styles.code}>{node.intentCode}</span>
          <span className={styles.name}>{node.name}</span>
          <span className={styles.meta}>
            <span className={styles.badge}>LV · {node.taxonomyLevel}</span>
            <span className={styles.badge}>{node.status}</span>
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
        />
      ))}
    </>
  );
}
