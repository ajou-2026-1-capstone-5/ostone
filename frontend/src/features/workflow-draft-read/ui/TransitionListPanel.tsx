import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { ApiRequestError } from "@/shared/api";
import type { WorkflowTransitionDetail } from "@/entities/workflow";
import styles from "./TransitionListPanel.module.css";

interface TransitionListPanelProps {
  transitions: WorkflowTransitionDetail[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

export function TransitionListPanel({
  transitions,
  isLoading,
  isError,
  error,
  refetch,
}: TransitionListPanelProps) {
  const errorMessage = isError && error instanceof ApiRequestError ? error.message : undefined;

  const toastFiredRef = useRef(false);
  useEffect(() => {
    if (isError && !toastFiredRef.current) {
      toastFiredRef.current = true;
      toast.error(errorMessage ?? "transition 목록을 불러오지 못했습니다.");
    }
    if (!isError) {
      toastFiredRef.current = false;
    }
  }, [isError, errorMessage]);

  if (isLoading) {
    return (
      <div className={styles.stateWrap}>
        <div className={styles.skeleton} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.stateWrap}>
        <span>목록을 불러오지 못했습니다.</span>
        <button type="button" className={styles.retryButton} onClick={() => void refetch()}>
          다시 시도
        </button>
      </div>
    );
  }

  if (!transitions || transitions.length === 0) {
    return (
      <div className={styles.stateWrap}>
        <span>등록된 transition이 없습니다.</span>
      </div>
    );
  }

  return (
    <ul className={styles.list}>
      {transitions.map((t) => (
        <TransitionItem key={t.id} transition={t} />
      ))}
    </ul>
  );
}

function TransitionItem({ transition }: { transition: WorkflowTransitionDetail }) {
  return (
    <li className={styles.item}>
      <span className={styles.id}>{transition.id}</span>
      <span className={styles.route}>
        {transition.from} → {transition.to}
      </span>
      {transition.label != null && <span className={styles.badge}>{transition.label}</span>}
      {transition.toPolicyRef != null && (
        <span className={styles.policyCode}>{transition.toPolicyRef}</span>
      )}
    </li>
  );
}
