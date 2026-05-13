import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/spinner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import styles from "./SummaryDetailPanel.module.css";

interface DomainPackApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading: boolean;
}

export function DomainPackApprovalDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}: DomainPackApprovalDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!isLoading) onOpenChange(next);
      }}
    >
      <AlertDialogContent size="sm" className={styles.approvalDialogContent}>
        <AlertDialogTitle className={styles.approvalDialogTitle}>
          Domain Pack 버전을 승인할까요?
        </AlertDialogTitle>
        <AlertDialogDescription className={styles.approvalDialogDescription}>
          승인하면 이 버전은 운영에 사용되며, 이후 구성요소를 수정할 수 없습니다.
        </AlertDialogDescription>
        <AlertDialogFooter className={styles.approvalDialogFooter}>
          <Button
            type="button"
            variant="outline"
            className={styles.approvalDialogCancel}
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            취소
          </Button>
          <Button
            type="button"
            className={styles.approvalDialogConfirm}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Spinner />
                처리 중...
              </>
            ) : (
              "승인"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
