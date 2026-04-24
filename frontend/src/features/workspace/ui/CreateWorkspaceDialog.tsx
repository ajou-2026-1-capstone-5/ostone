import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AlertCircleIcon } from "lucide-react";
import { toast } from "sonner";

import {
  generateWorkspaceKey,
  mapWorkspaceActionError,
  validateCreateWorkspaceForm,
  workspaceApi,
  type WorkspaceFieldErrors,
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

interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void> | void;
}

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateWorkspaceDialogProps) {
  const [name, setName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<WorkspaceFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameErrorId = fieldErrors.name ? "workspace-name-error" : undefined;

  useEffect(() => {
    if (!open) {
      setName("");
      setFieldErrors({});
      setIsSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const errors = validateCreateWorkspaceForm(name, "");
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const trimmedName = name.trim();
      const workspaceKey = generateWorkspaceKey(trimmedName);

      await workspaceApi.create({
        workspaceKey,
        name: trimmedName,
      });
      try {
        await onSuccess();
      } catch (error) {
        toast.error(mapWorkspaceActionError(error));
      } finally {
        toast.success("워크스페이스를 생성했습니다.");
        onOpenChange(false);
      }
    } catch (error) {
      if (error instanceof ApiRequestError) {
        if (error.code === "WORKSPACE_INVALID_NAME") {
          setFieldErrors({ name: error.message });
          return;
        }

        if (error.code === "WORKSPACE_KEY_CONFLICT") {
          setFieldErrors({ name: "다른 워크스페이스 이름으로 다시 시도해주세요." });
          return;
        }
      }

      toast.error(mapWorkspaceActionError(error));
      return;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>워크스페이스 생성</DialogTitle>
          <DialogDescription>
            팀이 함께 사용할 워크스페이스를 만들고 워크플로우 생성 작업을 시작합니다.
          </DialogDescription>
        </DialogHeader>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <Label htmlFor="workspace-name">이름</Label>
            <Input
              id="workspace-name"
              className={styles.dialogInput}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="CS Team Alpha"
              aria-invalid={fieldErrors.name ? "true" : "false"}
              aria-describedby={nameErrorId}
            />
            {fieldErrors.name && (
              <p id={nameErrorId} className={styles.fieldError} role="alert">
                <AlertCircleIcon className={styles.fieldErrorIcon} />
                <span>오류: {fieldErrors.name}</span>
              </p>
            )}
          </div>
          <p className={styles.helperText}>
            워크스페이스 키는 이름을 바탕으로 자동 생성됩니다.
          </p>
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
              {isSubmitting ? "생성 중..." : "생성"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
