import { useState } from "react";
import { CheckIcon, RotateCcwIcon, XIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import type { IntentRevisionSummary } from "../model/useIntentRevisionSummary";
import styles from "./intent-revision-draft.module.css";

interface IntentRevisionDraftActionsProps {
  summary?: IntentRevisionSummary;
  isSummaryLoading: boolean;
  summaryError?: Error | string | null;
  isPending: boolean;
  onRetrySummary: () => void;
  onApply: () => void;
  onDiscard: () => void;
}

export function IntentRevisionDraftActions({
  summary,
  isSummaryLoading,
  summaryError,
  isPending,
  onRetrySummary,
  onApply,
  onDiscard,
}: IntentRevisionDraftActionsProps) {
  const [dialog, setDialog] = useState<"apply" | "discard" | null>(null);
  const changedCount = summary?.changedIntents.length ?? 0;
  const canApply =
    changedCount > 0 && !isSummaryLoading && !summaryError && !isPending;
  const rawErrorMessage =
    summaryError instanceof Error ? summaryError.message : summaryError;
  const errorMessage = rawErrorMessage || "변경 요약을 불러오지 못했습니다.";

  return (
    <div className={styles.actions}>
      <div className={styles.summaryText}>
        {isSummaryLoading
          ? "변경 요약을 불러오는 중입니다."
          : summaryError
            ? errorMessage
            : changedCount > 0
              ? `변경된 intent ${changedCount}개`
              : "변경된 intent가 없습니다."}
      </div>
      <div className={styles.actionButtons}>
        {summaryError && (
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
        <Button
          type="button"
          variant="outline"
          size="default"
          className={styles.secondaryActionButton}
          onClick={() => setDialog("discard")}
          disabled={isPending}
        >
          <XIcon aria-hidden="true" />
          취소
        </Button>
        <Button
          type="button"
          size="default"
          className={styles.primaryActionButton}
          onClick={() => setDialog("apply")}
          disabled={!canApply}
        >
          <CheckIcon aria-hidden="true" />
          적용
        </Button>
      </div>

      <AlertDialog
        open={dialog === "apply"}
        onOpenChange={() => setDialog(null)}
      >
        <AlertDialogContent size="sm" className={styles.dialogContent}>
          <AlertDialogTitle className={styles.dialogTitle}>
            Intent 수정 초안을 적용할까요?
          </AlertDialogTitle>
          <AlertDialogDescription className={styles.dialogDescription}>
            저장된 intent 수정 내용이 새 운영 버전으로 반영됩니다.
          </AlertDialogDescription>
          {summary && <ChangeSummaryPreview summary={summary} />}
          <AlertDialogFooter className={styles.dialogButtons}>
            <Button
              type="button"
              variant="outline"
              className={styles.secondaryActionButton}
              onClick={() => setDialog(null)}
            >
              <XIcon aria-hidden="true" />
              취소
            </Button>
            <Button
              type="button"
              className={styles.primaryActionButton}
              onClick={() => {
                setDialog(null);
                onApply();
              }}
              disabled={!canApply}
            >
              <CheckIcon aria-hidden="true" />
              적용
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={dialog === "discard"}
        onOpenChange={() => setDialog(null)}
      >
        <AlertDialogContent size="sm" className={styles.dialogContent}>
          <AlertDialogTitle className={styles.dialogTitle}>
            Domain Pack 수정을 취소할까요?
          </AlertDialogTitle>
          <AlertDialogDescription className={styles.dialogDescription}>
            지금까지 이 Draft에 저장한 Domain Pack 수정 내용이 초기화되고 현재
            운영 버전으로 돌아갑니다.
          </AlertDialogDescription>
          <AlertDialogFooter className={styles.dialogButtons}>
            <Button
              type="button"
              variant="outline"
              className={styles.secondaryActionButton}
              onClick={() => setDialog(null)}
            >
              <RotateCcwIcon aria-hidden="true" />
              계속 보기
            </Button>
            <Button
              type="button"
              variant="destructive"
              className={styles.dangerActionButton}
              onClick={() => {
                setDialog(null);
                onDiscard();
              }}
              disabled={isPending}
            >
              <XIcon aria-hidden="true" />
              취소
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ChangeSummaryPreview({ summary }: { summary: IntentRevisionSummary }) {
  const firstFive = summary.changedIntents.slice(0, 5);
  const rest = summary.changedIntents.length - firstFive.length;

  return (
    <div className={styles.changePreview}>
      <div className={styles.changeCounts}>
        <span>변경된 intent {summary.changedIntents.length}개</span>
        <span>이름 변경 {summary.changedFieldCounts.name}개</span>
        <span>설명 변경 {summary.changedFieldCounts.description}개</span>
      </div>
      <ul className={styles.changeList}>
        {firstFive.map((change) => (
          <li key={change.intentId}>
            <span>{change.intentCode}</span>
            <strong>{change.name || "이름 없음"}</strong>
            <em>
              {change.fields
                .map((field) => (field === "name" ? "이름" : "설명"))
                .join(", ")}
            </em>
          </li>
        ))}
        {rest > 0 && <li>외 {rest}개</li>}
      </ul>
    </div>
  );
}
