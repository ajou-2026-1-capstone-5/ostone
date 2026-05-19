import { useEffect, useRef, useState } from "react";

import type { WorkspaceWorkflowEntry } from "@/entities/workflow";
import { Mono, Pill } from "@/shared/ui/ostone/atoms";

import { WorkflowGraphMini } from "./WorkflowGraphMini";
import styles from "./workflow-card.module.css";

const ROW_UNIT_PX = 10;
const ROW_GAP_PX = 8;

interface WorkflowCardProps {
  entry: WorkspaceWorkflowEntry;
  expanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
  testIdPrefix?: string;
}

export function WorkflowCard({
  entry,
  expanded,
  onToggle,
  onOpen,
  testIdPrefix = "workflow-list",
}: WorkflowCardProps) {
  const cardTestId = `${testIdPrefix}-card-${entry.workflowId}`;
  const cardRef = useRef<HTMLElement>(null);
  const [rowSpan, setRowSpan] = useState(20);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const recompute = () => {
      const h = el.getBoundingClientRect().height;
      const span = Math.max(1, Math.ceil((h + ROW_GAP_PX) / (ROW_UNIT_PX + ROW_GAP_PX)));
      setRowSpan(span);
    };
    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded]);

  return (
    <article
      ref={cardRef}
      className={styles.card}
      data-testid={cardTestId}
      data-expanded={expanded ? "true" : "false"}
      style={{ gridRow: `span ${rowSpan}` }}
    >
      <button
        type="button"
        className={styles.cardBody}
        onClick={onToggle}
        data-testid={`${cardTestId}-toggle`}
      >
        {expanded && (
          <div
            className={styles.graphSlot}
            data-testid={`${cardTestId}-graph`}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <WorkflowGraphMini
              workspaceId={null /* derived from packId via context — see WorkflowListView */}
              packId={entry.packId}
              versionId={entry.versionId}
              workflowId={entry.workflowId}
            />
          </div>
        )}

        <div className={styles.header}>
          <Pill tone="mute">{entry.packName}</Pill>
          {entry.workflowCode && <Mono className={styles.code}>{entry.workflowCode}</Mono>}
        </div>

        <div className={styles.content}>
          <h2 className={styles.title}>{entry.name}</h2>
        </div>

        {expanded && (
          <div className={styles.detail} data-testid={`${cardTestId}-detail`}>
            {entry.description && <p className={styles.description}>{entry.description}</p>}
            <Mono className={styles.meta}>
              pack #{entry.packId} · version #{entry.versionId}
            </Mono>
          </div>
        )}
      </button>

      <div className={styles.footer}>
        {expanded ? (
          <button
            type="button"
            className={styles.openBtn}
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            data-testid={`${cardTestId}-open`}
          >
            열기
          </button>
        ) : (
          <Mono className={styles.meta}>
            pack #{entry.packId} · version #{entry.versionId}
          </Mono>
        )}
      </div>
    </article>
  );
}
