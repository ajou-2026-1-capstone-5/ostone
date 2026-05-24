import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { PencilIcon, SaveIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import type { IntentDetail } from "@/entities/intent";
import { intentRevisionDraftApi, type UpdateDraftIntentBody } from "../api/intentRevisionDraftApi";
import styles from "./intent-revision-draft.module.css";

interface IntentRevisionEditFormProps {
  wsId: number;
  packId: number;
  versionId: number;
  detail: IntentDetail;
  canEdit: boolean;
  isEditing?: boolean;
  isSaving: boolean;
  showIdleAction?: boolean;
  onSave: (values: UpdateDraftIntentBody) => Promise<boolean>;
  onDirtyChange: (dirty: boolean, intentId: number | null) => void;
  onEditingChange?: (isEditing: boolean) => void;
}

interface FormValues {
  name: string;
  description: string;
}

interface Baseline extends FormValues {
  updatedAt: string;
}

function normalizeDetail(detail: IntentDetail): Baseline {
  return {
    name: detail.name ?? "",
    description: detail.description ?? "",
    updatedAt: detail.updatedAt ?? "",
  };
}

function hasBaselineChanged(baseline: Baseline, latest: IntentDetail): boolean {
  const latestBaseline = normalizeDetail(latest);
  return (
    baseline.name !== latestBaseline.name ||
    baseline.description !== latestBaseline.description ||
    baseline.updatedAt !== latestBaseline.updatedAt
  );
}

export function IntentRevisionEditForm({
  wsId,
  packId,
  versionId,
  detail,
  canEdit,
  isEditing: controlledIsEditing,
  isSaving,
  showIdleAction = true,
  onSave,
  onDirtyChange,
  onEditingChange,
}: IntentRevisionEditFormProps) {
  const [internalIsEditing, setInternalEditing] = useState(false);
  const [baseline, setBaseline] = useState<Baseline>(() => normalizeDetail(detail));
  const [values, setValues] = useState<FormValues>(() => normalizeDetail(detail));
  const [latestConflict, setLatestConflict] = useState<IntentDetail | null>(null);
  const [saveCompleted, setSaveCompleted] = useState<{
    intentId: number | null;
    visible: boolean;
  }>({ intentId: null, visible: false });
  const skipNextDirtyReportRef = useRef(false);
  const nameId = useId();
  const descriptionId = useId();
  const nameErrorId = `${nameId}-error`;
  const descriptionErrorId = `${descriptionId}-error`;
  const isEditingControlled = controlledIsEditing !== undefined;
  const isEditing = controlledIsEditing ?? internalIsEditing;
  const setEditing = useCallback(
    (next: boolean) => {
      if (!isEditingControlled) {
        setInternalEditing(next);
      }
      onEditingChange?.(next);
    },
    [isEditingControlled, onEditingChange],
  );

  useEffect(() => {
    const next = normalizeDetail(detail);
    skipNextDirtyReportRef.current = true;
    // The form mirrors a freshly loaded server baseline whenever the selected
    // intent/detail refresh changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBaseline(next);
    setValues(next);
    setEditing(false);
    onDirtyChange(false, null);
  }, [detail, onDirtyChange, setEditing]);

  const errors = useMemo(() => {
    const next: Partial<Record<keyof FormValues, string>> = {};
    if (values.name.trim().length === 0) {
      next.name = "이름을 입력해 주세요.";
    } else if (values.name.trim().length > 60) {
      next.name = "이름은 60자 이하로 입력해 주세요.";
    }

    if (values.description.length > 1000) {
      next.description = "설명은 1000자 이하로 입력해 주세요.";
    }

    return next;
  }, [values.description, values.name]);

  const isDirty = baseline.name !== values.name || baseline.description !== values.description;
  const hasError = Boolean(errors.name || errors.description);
  const shouldShowSaveCompleted =
    saveCompleted.visible && saveCompleted.intentId === (detail.id ?? null);

  useEffect(() => {
    if (skipNextDirtyReportRef.current) {
      skipNextDirtyReportRef.current = false;
      return;
    }
    onDirtyChange(isEditing && isDirty, isEditing && detail.id != null ? detail.id : null);
  }, [detail.id, isDirty, isEditing, onDirtyChange]);

  if (!canEdit || detail.id == null) return null;

  const handleCancel = () => {
    setValues({ name: baseline.name, description: baseline.description });
    setEditing(false);
  };

  const handleSave = async () => {
    let latest: IntentDetail;
    try {
      latest = await intentRevisionDraftApi.getIntent(wsId, packId, versionId, detail.id!);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `최신 Intent 정보를 확인하지 못했습니다. ${error.message}`
          : "최신 Intent 정보를 확인하지 못했습니다.",
      );
      return;
    }

    if (hasBaselineChanged(baseline, latest)) {
      setLatestConflict(latest);
      return;
    }

    let saved = false;
    try {
      saved = await onSave({
        name: values.name.trim(),
        description: values.description,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `Intent 수정 내용 저장에 실패했습니다. ${error.message}`
          : "Intent 수정 내용 저장에 실패했습니다.",
      );
      return;
    }

    if (saved) {
      setEditing(false);
      setSaveCompleted({ intentId: detail.id ?? null, visible: true });
    }
  };

  const loadLatest = () => {
    if (!latestConflict) return;
    const next = normalizeDetail(latestConflict);
    setBaseline(next);
    setValues(next);
    setLatestConflict(null);
  };

  if (!isEditing) {
    if (!showIdleAction && !shouldShowSaveCompleted) return null;

    return (
      <div className={styles.formShell}>
        <div className={styles.formIdleRow}>
          {showIdleAction && (
            <IntentRevisionEditAction
              onEdit={() => {
                setSaveCompleted({ intentId: detail.id ?? null, visible: false });
                setEditing(true);
              }}
            />
          )}
          {shouldShowSaveCompleted && (
            <span className={styles.saveStatus} role="status">
              수정 적용 완료
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      className={styles.formShell}
      onSubmit={(event) => {
        event.preventDefault();
        if (!hasError && isDirty && !isSaving) void handleSave();
      }}
    >
      <div className={styles.field}>
        <label htmlFor={nameId}>이름</label>
        <input
          id={nameId}
          value={values.name}
          onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? nameErrorId : undefined}
        />
        {errors.name && (
          <span id={nameErrorId} className={styles.errorText}>
            {errors.name}
          </span>
        )}
      </div>
      <div className={styles.field}>
        <label htmlFor={descriptionId}>설명</label>
        <textarea
          id={descriptionId}
          value={values.description}
          onChange={(event) => setValues((prev) => ({ ...prev, description: event.target.value }))}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? descriptionErrorId : undefined}
          rows={5}
        />
        {errors.description && (
          <span id={descriptionErrorId} className={styles.errorText}>
            {errors.description}
          </span>
        )}
      </div>
      <div className={styles.buttonRow}>
        <Button
          type="button"
          variant="outline"
          className={styles.secondaryActionButton}
          onClick={handleCancel}
          disabled={isSaving}
        >
          <XIcon aria-hidden="true" />
          취소
        </Button>
        <Button
          type="submit"
          className={styles.primaryActionButton}
          disabled={hasError || !isDirty || isSaving}
        >
          <SaveIcon aria-hidden="true" />
          {isSaving ? "저장 중..." : "저장"}
        </Button>
      </div>

      <AlertDialog open={latestConflict !== null} onOpenChange={() => setLatestConflict(null)}>
        <AlertDialogContent size="sm" className={styles.dialogContent}>
          <AlertDialogTitle className={styles.dialogTitle}>
            다른 사용자가 먼저 수정했습니다.
          </AlertDialogTitle>
          <AlertDialogDescription className={styles.dialogDescription}>
            최신 내용을 불러온 뒤 다시 수정해 주세요.
          </AlertDialogDescription>
          <AlertDialogFooter className={styles.dialogButtons}>
            <Button
              type="button"
              variant="outline"
              className={styles.secondaryActionButton}
              onClick={() => setLatestConflict(null)}
            >
              <XIcon aria-hidden="true" />
              취소
            </Button>
            <Button type="button" className={styles.primaryActionButton} onClick={loadLatest}>
              최신 내용 불러오기
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

export function IntentRevisionEditAction({
  onEdit,
  disabled = false,
}: {
  onEdit: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      size="default"
      className={styles.editButton}
      onClick={onEdit}
      disabled={disabled}
    >
      <PencilIcon aria-hidden="true" />
      수정
    </Button>
  );
}
