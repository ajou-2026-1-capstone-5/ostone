import { useState } from "react";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { mapWorkspaceActionError, type WorkspaceResponse } from "@/entities/workspace";
import { useArchiveWorkspace } from "@/shared/api/generated/endpoints/workspace-controller/workspace-controller";
import { Button } from "@/shared/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";

import styles from "./archive-confirm-dialog.module.css";

interface ArchiveConfirmDialogProps {
  workspace: WorkspaceResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void> | void;
}

export function ArchiveConfirmDialog({
  workspace,
  open,
  onOpenChange,
  onSuccess,
}: ArchiveConfirmDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const archiveWorkspace = useArchiveWorkspace();

  if (!workspace) {
    return null;
  }

  const handleArchive = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    archiveWorkspace.mutate(
      { id: workspace.id! },
      {
        onSuccess: () => {
          toast.success("워크스페이스를 삭제했습니다.");
          onOpenChange(false);
          void Promise.resolve(onSuccess())
            .catch(() => {
              toast.warning("목록 갱신에 실패했습니다. 화면을 새로고침해 주세요.");
            });
        },
        onError: (error) => {
          toast.error(mapWorkspaceActionError(error));
        },
        onSettled: () => {
          setIsSubmitting(false);
        },
      },
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={styles.dialogContent}>
        <div className={styles.heroSection}>
          <div className={styles.media}>
            <Trash2Icon className="size-7" />
          </div>
          <div className={styles.heroCopy}>
            <AlertDialogTitle className={styles.title}>워크스페이스를 삭제할까요?</AlertDialogTitle>
          </div>
        </div>
        <div className={styles.warningPanel}>
          <p className={styles.warningPanelText}>
            <strong>{workspace.name ?? ""}</strong>은(는) 목록에서 즉시 숨겨지고, 이후 운영 화면에서 다시
            접근하기 어려울 수 있습니다.
          </p>
        </div>
        <AlertDialogFooter className={styles.buttonRow}>
          <Button
            variant="outline"
            className={styles.cancelButton}
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            취소
          </Button>
          <Button className={styles.deleteButton} onClick={handleArchive} disabled={isSubmitting}>
            {isSubmitting ? "삭제 중..." : "삭제"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
