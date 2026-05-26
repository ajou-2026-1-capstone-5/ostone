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
  const changedCount = summary?.changedIntents.length ?? 0;
  const hasSummaryError = summaryError != null;
  const rawErrorMessage =
    summaryError instanceof Error ? summaryError.message : summaryError;
  const errorMessage = rawErrorMessage ?? "변경 요약을 불러오지 못했습니다.";

  return (
    <div className={styles.actions}>
      <div className={styles.summaryText}>
        {isSummaryLoading
          ? "변경 요약을 불러오는 중입니다."
          : hasSummaryError
            ? errorMessage
            : changedCount > 0
              ? `변경된 intent ${changedCount}개`
              : "변경된 intent가 없습니다."}
      </div>
      <div className={styles.summaryText}>
        수정 내용의 적용 및 삭제는 Domain Pack 화면에서 진행할 수 있습니다.
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
