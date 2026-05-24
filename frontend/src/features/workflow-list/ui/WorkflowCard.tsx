import { useEffect, useRef, useState, type FocusEvent } from "react";

import type { WorkspaceWorkflowEntry } from "@/entities/workflow";
import { Mono, Pill } from "@/shared/ui/ostone/atoms";

import { WorkflowGraphMini } from "./WorkflowGraphMini";
import styles from "./workflow-card.module.css";

const ROW_UNIT_PX = 10;
const ROW_GAP_PX = 8;

interface WorkflowCardProps {
  entry: WorkspaceWorkflowEntry;
  onOpen: () => void;
  testIdPrefix?: string;
}

export function WorkflowCard({
  entry,
  onOpen,
  testIdPrefix = "workflow-list",
}: WorkflowCardProps) {
  const cardTestId = `${testIdPrefix}-card-${entry.workflowId}`;
  const cardRef = useRef<HTMLElement>(null);
  const [rowSpan, setRowSpan] = useState(20);
  const [previewOpen, setPreviewOpen] = useState(false);

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
  }, [previewOpen]);

  const closePreviewOnBlur = (event: FocusEvent<HTMLElement>) => {
    const nextTarget = event.relatedTarget;
    if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
      setPreviewOpen(false);
    }
  };

  return (
    <article
      ref={cardRef}
      className={styles.card}
      data-testid={cardTestId}
      data-preview-open={previewOpen ? "true" : "false"}
      style={{ gridRow: `span ${rowSpan}` }}
      onMouseEnter={() => setPreviewOpen(true)}
      onMouseLeave={() => setPreviewOpen(false)}
      onFocusCapture={() => setPreviewOpen(true)}
      onBlurCapture={closePreviewOnBlur}
    >
      <button
        type="button"
        className={styles.cardBody}
        onClick={onOpen}
        data-testid={`${cardTestId}-open`}
      >
        {previewOpen && (
          <div className={styles.graphSlot} data-testid={`${cardTestId}-graph`}>
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

        {previewOpen && (
          <div className={styles.detail} data-testid={`${cardTestId}-detail`}>
            {entry.description && <p className={styles.description}>{entry.description}</p>}
            <Mono className={styles.meta}>
              pack #{entry.packId} · version #{entry.versionId}
            </Mono>
          </div>
        )}
      </button>

      <div className={styles.footer}>
        <Mono className={styles.meta}>
          pack #{entry.packId} · version #{entry.versionId}
        </Mono>
      </div>
    </article>
  );
}
