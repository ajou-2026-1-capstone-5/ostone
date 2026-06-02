import { RotateCcwIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import type { IntentRevisionSummary } from "../model/useIntentRevisionSummary";
import styles from "./intent-revision-draft.module.css";

interface IntentRevisionDraftActionsProps {
  summary?: IntentRevisionSummary;
  isSummaryLoading: boolean;
  summaryError?: Error | string | null;
  isPending: boolean;
  onRetrySummary: () => void;
}

export function IntentRevisionDraftActions({
  summary,
  isSummaryLoading,
  summaryError,
  isPending,
  onRetrySummary,
}: IntentRevisionDraftActionsProps) {
  const intentChangedCount = summary?.changedIntents.length ?? 0;
  const workflowChangedCount = summary?.changedWorkflows.length ?? 0;
  const changedCount = summary?.totalChangedComponents ?? intentChangedCount + workflowChangedCount;
  const hasSummaryError = summaryError != null;
  const rawErrorMessage = summaryError instanceof Error ? summaryError.message : summaryError;
  const errorMessage = rawErrorMessage ?? "변경 요약을 불러오지 못했습니다.";
  const changedLabel =
    changedCount > 0
      ? `변경된 구성 요소 ${changedCount}개 (상담 유형 ${intentChangedCount}개 · 워크플로우 ${workflowChangedCount}개)`
      : "변경된 구성 요소가 없습니다.";

  return (
    <div className={styles.actions}>
      <div className={styles.summaryText}>
        {isSummaryLoading
          ? "변경 요약을 불러오는 중입니다."
          : hasSummaryError
            ? errorMessage
            : changedLabel}
      </div>
      <div className={styles.summaryText}>
        수정 내용의 적용 및 삭제는 도메인팩 화면에서 진행할 수 있습니다.
      </div>
      <div className={styles.actionButtons}>
        {hasSummaryError && (
          <Button
            type="button"
            variant="outline"
            size="default"
            className={styles.secondaryActionButton}
            onClick={onRetrySummary}
            disabled={isPending || isSummaryLoading}
          >
            <RotateCcwIcon aria-hidden="true" />
            다시 시도
          </Button>
        )}
      </div>
    </div>
  );
}
