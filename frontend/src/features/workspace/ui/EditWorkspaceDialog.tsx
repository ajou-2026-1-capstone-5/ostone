import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

import {
  mapWorkspaceActionError,
  validateUpdateWorkspaceForm,
  workspaceApi,
  type WorkspaceFieldErrors,
  type WorkspaceResponse,
} from "@/entities/workspace";
import { ApiRequestError } from "@/shared/api";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

import styles from "./workspace-dialog.module.css";

interface EditWorkspaceDialogProps {
  workspace: WorkspaceResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void> | void;
}

export function EditWorkspaceDialog({
  workspace,
  open,
  onOpenChange,
  onSuccess,
}: EditWorkspaceDialogProps) {
  const [name, setName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<WorkspaceFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (workspace && open) {
      setName(workspace.name);
      setFieldErrors({});
      setIsSubmitting(false);
    }
  }, [workspace, open]);

  if (!workspace) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const errors = validateUpdateWorkspaceForm(name, "");
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      await workspaceApi.update(workspace.id, {
        name: name.trim(),
      });
      await onSuccess();
      toast.success("워크스페이스를 수정했습니다.");
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        if (error.code === "WORKSPACE_INVALID_NAME") {
          setFieldErrors({ name: error.message });
          return;
        }
      }

      toast.error(mapWorkspaceActionError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>워크스페이스 수정</DialogTitle>
          <DialogDescription>
            워크스페이스 이름과 설명을 조정해서 운영 범위를 더 명확하게 정리합니다.
          </DialogDescription>
        </DialogHeader>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <Label htmlFor="workspace-edit-name">이름</Label>
            <Input
              id="workspace-edit-name"
              className={styles.dialogInput}
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={fieldErrors.name ? "true" : "false"}
            />
            {fieldErrors.name && <p className={styles.fieldError}>{fieldErrors.name}</p>}
          </div>
          <DialogFooter className={styles.buttonRow}>
            <Button
              type="button"
              variant="outline"
              className={styles.cancelButton}
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              취소
            </Button>
            <Button type="submit" className={styles.submitButton} disabled={isSubmitting}>
              {isSubmitting ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
