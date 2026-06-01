import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/spinner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";

import type { IntentApprovalAction } from "../model/types";
import styles from "./approve-intent-dialog.module.css";

interface ApproveIntentDialogProps {
  intentName: string;
  action: IntentApprovalAction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading: boolean;
}

export function ApproveIntentDialog({
  intentName,
  action,
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}: ApproveIntentDialogProps) {
  const isPublish = action === "publish";
  const actionLabel = isPublish ? "승인" : "반려";
  const confirmLabel = actionLabel;
  const confirmVariant = isPublish ? "default" : "destructive";

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!isLoading) onOpenChange(next);
      }}
    >
      <AlertDialogContent size="sm" className={styles.dialogContent}>
        <AlertDialogTitle className={styles.title}>상담 유형 {actionLabel}</AlertDialogTitle>
        <AlertDialogDescription className={styles.description}>
          <strong>{intentName}</strong> 상담 유형을 {actionLabel} 처리합니다.
        </AlertDialogDescription>
        <AlertDialogFooter className={styles.buttonRow}>
          <Button
            variant="outline"
            className={styles.cancelButton}
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            취소
          </Button>
          <Button
            variant={confirmVariant}
            className={styles.confirmButton}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Spinner />
                처리 중...
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
