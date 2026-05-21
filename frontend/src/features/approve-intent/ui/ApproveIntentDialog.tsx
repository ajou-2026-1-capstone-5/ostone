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
  const confirmLabel = action === "publish" ? "승인" : "반려";
  const confirmVariant = action === "publish" ? "default" : "destructive";

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!isLoading) onOpenChange(next);
      }}
    >
      <AlertDialogContent size="sm" className={styles.dialogContent}>
        <AlertDialogTitle className={styles.title}>intent {action}하기</AlertDialogTitle>
        <AlertDialogDescription className={styles.description}>
          <strong>{intentName}</strong> intent를 {action} 처리합니다.
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
