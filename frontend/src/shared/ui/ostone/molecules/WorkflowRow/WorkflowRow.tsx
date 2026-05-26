import {
  useState,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import { Mono, Pill } from "@/shared/ui/ostone/atoms";

import styles from "./workflow-row.module.css";

export interface WorkflowRowEntry {
  packId: number;
  packName: string;
  versionId: number;
  workflowId: number;
  workflowCode: string | null;
  name: string;
  description: string | null;
}

interface WorkflowRowProps {
  entry: WorkflowRowEntry;
  onOpen?: () => void;
  testIdPrefix?: string;
  graphSlot?: ReactNode;
}

export function WorkflowRow({
  entry,
  onOpen,
  testIdPrefix = "workflow-row",
  graphSlot,
}: WorkflowRowProps) {
  const rowTestId = `${testIdPrefix}-${entry.workflowId}`;
  const [previewOpen, setPreviewOpen] = useState(false);

  const closePreviewOnBlur = (event: FocusEvent<HTMLElement>) => {
    const nextTarget = event.relatedTarget;
    if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
      setPreviewOpen(false);
    }
  };

  const closePreviewOnMouseLeave = (event: MouseEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(document.activeElement)) {
      setPreviewOpen(false);
    }
  };

  const handleClick = () => {
    if (onOpen) onOpen();
  };

  return (
    <article
      className={styles.row}
      data-testid={rowTestId}
      data-preview-open={previewOpen ? "true" : "false"}
      onMouseEnter={() => setPreviewOpen(true)}
      onMouseLeave={closePreviewOnMouseLeave}
      onFocusCapture={() => setPreviewOpen(true)}
      onBlurCapture={closePreviewOnBlur}
    >
      <button
        type="button"
        className={styles.body}
        onClick={handleClick}
        data-testid={`${rowTestId}-open`}
        disabled={!onOpen}
      >
        <div className={styles.headerLine}>
          <div className={styles.headerLeft}>
            <Pill tone="mute">{entry.packName}</Pill>
            <span className={styles.title}>{entry.name}</span>
          </div>
          <Mono className={styles.meta}>
            pack #{entry.packId} · v{entry.versionId}
          </Mono>
        </div>

        <div
          className={styles.expandedWrapper}
          data-testid={`${rowTestId}-expand`}
          aria-hidden={!previewOpen}
        >
          <div className={styles.expandedInner}>
            {previewOpen && (
              <div
                className={styles.expanded}
                data-testid={`${rowTestId}-detail`}
              >
                {entry.description && (
                  <p className={styles.description}>{entry.description}</p>
                )}
                {graphSlot && (
                  <div
                    className={styles.graphSlot}
                    data-testid={`${rowTestId}-graph`}
                  >
                    {graphSlot}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </button>
    </article>
  );
}
