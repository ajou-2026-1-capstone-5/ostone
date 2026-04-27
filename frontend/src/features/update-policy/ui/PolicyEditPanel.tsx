import { XIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/spinner";

import { POLICY_ERROR_MESSAGES } from "../api/messages";
import { useGetPolicy } from "../api/useGetPolicy";
import { PolicyEditForm } from "./PolicyEditForm";
import styles from "./policy-edit-panel.module.css";

interface PolicyEditPanelProps {
  workspaceId: number;
  packId: number;
  versionId: number;
  policyId: number;
  onClose: () => void;
}

export function PolicyEditPanel({
  workspaceId,
  packId,
  versionId,
  policyId,
  onClose,
}: PolicyEditPanelProps) {
  const { data: policy, isLoading, isError, refetch } = useGetPolicy({
    workspaceId,
    packId,
    versionId,
    policyId,
    enabled: true,
  });

  return (
    <section className={styles.panel} aria-label="정책 수정">
      <header className={styles.header}>
        <div className={styles.headerText}>
          <span className={styles.eyebrow}>EDIT POLICY</span>
          <h2 className={styles.title}>
            {policy ? `${policy.policyCode} · ${policy.name}` : "정책 수정"}
          </h2>
          <p className={styles.description}>정책 필드와 상태를 수정합니다.</p>
        </div>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="수정 닫기">
          <XIcon aria-hidden="true" />
          <span>닫기</span>
        </button>
      </header>

      {isLoading && (
        <div className={styles.statePanel}>
          <Spinner className={styles.spinner} />
        </div>
      )}

      {isError && (
        <div className={styles.statePanel}>
          <span>{POLICY_ERROR_MESSAGES.LOAD_FAILED}</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            다시 시도
          </Button>
        </div>
      )}

      {policy && !isLoading && !isError && (
        <div className={styles.body}>
          <PolicyEditForm
            policy={policy}
            workspaceId={workspaceId}
            packId={packId}
            versionId={versionId}
            onClose={onClose}
          />
        </div>
      )}
    </section>
  );
}
