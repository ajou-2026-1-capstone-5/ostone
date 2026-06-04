import { useState } from "react";
import type { FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircleIcon } from "lucide-react";
import { toast } from "sonner";

import {
  generateWorkspaceKey,
  mapWorkspaceActionError,
  validateCreateWorkspaceForm,
  type WorkspaceFieldErrors,
  type WorkspaceResponse,
} from "@/entities/workspace";
import {
  getListWorkspacesQueryKey,
  useCreateWorkspace,
} from "@/shared/api/generated/endpoints/workspace-controller/workspace-controller";
import { ApiRequestError, selectApiData } from "@/shared/api";
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
  onSuccess: (workspace: WorkspaceResponse) => Promise<void> | void;
}

type WorkspaceListCache =
  | WorkspaceResponse[]
  | { data?: WorkspaceResponse[]; headers?: Headers; status?: number };

function upsertWorkspace(workspaces: WorkspaceResponse[], created: WorkspaceResponse) {
  const existingIndex = workspaces.findIndex((workspace) => workspace.id === created.id);
  if (existingIndex === -1) {
    return [...workspaces, created];
  }

  return workspaces.map((workspace, index) =>
    index === existingIndex ? { ...workspace, ...created } : workspace,
  );
}

function updateWorkspaceListCache(
  current: WorkspaceListCache | undefined,
  created: WorkspaceResponse,
): WorkspaceListCache {
  if (Array.isArray(current)) {
    return upsertWorkspace(current, created);
  }

  const nextWorkspaces = upsertWorkspace(current?.data ?? [], created);
  if (current) {
    return { ...current, data: nextWorkspaces };
  }

  return {
    data: nextWorkspaces,
    headers: new Headers(),
    status: 200,
  };
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
  const queryClient = useQueryClient();
  const createWorkspace = useCreateWorkspace();

  const resetForm = () => {
    setName("");
    setFieldErrors({});
    setIsSubmitting(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  const closeDialog = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const errors = validateCreateWorkspaceForm(name, "");
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    const trimmedName = name.trim();
    const workspaceKey = generateWorkspaceKey(trimmedName);

    createWorkspace.mutate(
      { data: { workspaceKey, name: trimmedName } },
      {
        onSuccess: async (result) => {
          const created = selectApiData<WorkspaceResponse>(result);
          if (created?.id == null) {
            toast.error("워크스페이스 생성 응답을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.");
            setIsSubmitting(false);
            return;
          }

          toast.success("워크스페이스를 생성했습니다.");
          const listWorkspacesQueryKey = getListWorkspacesQueryKey();
          queryClient.setQueryData<WorkspaceListCache>(listWorkspacesQueryKey, (current) =>
            updateWorkspaceListCache(current, created),
          );
          void queryClient.invalidateQueries({ queryKey: listWorkspacesQueryKey });
          closeDialog();
          try {
            await onSuccess(created);
          } catch {
            toast.error("워크스페이스 목록을 새로고침하지 못했습니다. 잠시 후 다시 시도해주세요.");
            setIsSubmitting(false);
          }
        },
        onError: (error) => {
          if (error instanceof ApiRequestError) {
            if (error.code === "WORKSPACE_INVALID_NAME") {
              setFieldErrors({ name: error.message });
              setIsSubmitting(false);
              return;
            }
            if (error.code === "WORKSPACE_KEY_CONFLICT") {
              setFieldErrors({ name: "다른 워크스페이스 이름으로 다시 시도해주세요." });
              setIsSubmitting(false);
              return;
            }
          }
          toast.error(mapWorkspaceActionError(error));
          setIsSubmitting(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>워크스페이스 생성</DialogTitle>
          <DialogDescription>
            워크스페이스를 생성하여 상담 공간을 구축합니다.
          </DialogDescription>
        </DialogHeader>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <Label htmlFor="workspace-name">제목</Label>
            <Input
              id="workspace-name"
              className={styles.dialogInput}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="예: 아주대학교 운영팀"
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
          <DialogFooter className={styles.buttonRow}>
            <Button
              type="button"
              variant="outline"
              className={styles.cancelButton}
              onClick={closeDialog}
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
