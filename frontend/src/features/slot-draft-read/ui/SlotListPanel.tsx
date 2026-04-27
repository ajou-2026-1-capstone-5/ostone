import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSlotList } from "../model/useSlotList";
import type { SlotSummary } from "@/entities/slot";
import styles from "./SlotListPanel.module.css";

interface SlotListPanelProps {
  wsId: number;
  packId: number;
  versionId: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function SlotListPanel({
  wsId,
  packId,
  versionId,
  selectedId,
  onSelect,
}: SlotListPanelProps) {
  const [retryKey, setRetryKey] = useState(0);
  const state = useSlotList(wsId, packId, versionId, retryKey);
  const errorMessage = state.status === "error" ? state.message : undefined;

  useEffect(() => {
    if (state.status === "error") {
      toast.error(errorMessage ?? "목록을 불러오지 못했습니다.");
    }
  }, [state.status, errorMessage]);

  return (
    <aside className={styles.panel} aria-label="슬롯 목록">
      <header className={styles.header}>
        <span className={styles.headerTitle}>Slots</span>
        <span className={styles.headerMeta}>
          {state.status === "ready" ? `${state.data.length} · LIST` : "— · LIST"}
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
            <button
              type="button"
              className={styles.retryButton}
              onClick={() => setRetryKey((k) => k + 1)}
            >
              다시 시도
            </button>
          </div>
        )}

        {state.status === "ready" && state.data.length === 0 && (
          <div className={styles.emptyState}>
            <span>등록된 슬롯 초안이 없습니다.</span>
          </div>
        )}

        {state.status === "ready" && state.data.length > 0 && (
          <div className={styles.listGroup}>
            {state.data.map((slot) => (
              <SlotListRow
                key={slot.id}
                slot={slot}
                isActive={slot.id === selectedId}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function SlotListRow({
  slot,
  isActive,
  onSelect,
}: {
  slot: SlotSummary;
  isActive: boolean;
  onSelect: (id: number) => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.item} ${isActive ? styles.itemActive : ""}`}
      onClick={() => onSelect(slot.id)}
      aria-pressed={isActive}
    >
      <div className={styles.itemInner}>
        <span className={styles.code}>{slot.slotCode}</span>
        <span className={styles.name}>{slot.name}</span>
        <span className={styles.meta}>
          <span className={styles.badge}>{slot.status}</span>
          <span className={styles.badge}>{slot.dataType}</span>
        </span>
      </div>
    </button>
  );
}
