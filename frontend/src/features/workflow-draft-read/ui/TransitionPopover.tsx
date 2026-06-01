import { useEffect, useRef } from "react";
import type { WorkflowTransitionDetail } from "@/entities/workflow";
import type { PolicySummary } from "@/entities/policy";
import styles from "./TransitionPopover.module.css";

interface TransitionPopoverProps {
  transition: WorkflowTransitionDetail;
  policy: PolicySummary | null;
  onClose: () => void;
}

export function TransitionPopover({ transition, policy, onClose }: TransitionPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const handleMouseDown = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  return (
    <div ref={ref} className={styles.popover} role="dialog" aria-label="전환 조건 상세">
      <div className={styles.header}>
        <span className={styles.id}>{transition.id}</span>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="닫기">
          ✕
        </button>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>이동 경로</span>
        <span className={styles.value}>
          {transition.from} → {transition.to}
        </span>
      </div>

      {transition.label != null && (
        <div className={styles.field}>
          <span className={styles.label}>조건 이름</span>
          <span className={styles.badge}>{transition.label}</span>
        </div>
      )}

      {policy != null && (
        <div className={styles.policySection}>
          <span className={styles.label}>응대 기준</span>
          <span className={styles.policyName}>{policy.name}</span>
          {policy.description && <span className={styles.policyDesc}>{policy.description}</span>}
        </div>
      )}
    </div>
  );
}
