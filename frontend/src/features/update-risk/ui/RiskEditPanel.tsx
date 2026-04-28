import { XIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/spinner";

import { RISK_ERROR_MESSAGES } from "../api/messages";
import { useGetRisk } from "../api/useGetRisk";
import { RiskEditForm } from "./RiskEditForm";
import styles from "./risk-edit-panel.module.css";

interface RiskEditPanelProps {
  workspaceId: number;
  packId: number;
  versionId: number;
  riskId: number;
  onClose: () => void;
}

export function RiskEditPanel({
  workspaceId,
  packId,
  versionId,
  riskId,
  onClose,
}: Readonly<RiskEditPanelProps>) {
  const {
    data: risk,
    isLoading,
    isError,
    refetch,
  } = useGetRisk({
    workspaceId,
    packId,
    versionId,
    riskId,
    enabled: true,
  });
  const hasRisk = risk !== undefined;
  const showInitialLoading = isLoading && !hasRisk;
  const showLoadError = isError && !hasRisk;
  const showEmptyState = !isLoading && !isError && !hasRisk;

  return (
    <section className={styles.panel} aria-label="위험요소 수정">
      <header className={styles.header}>
        <div className={styles.headerText}>
          <span className={styles.eyebrow}>EDIT RISK</span>
          <h2 className={styles.title}>
            {risk ? `${risk.riskCode} · ${risk.name}` : "위험요소 수정"}
          </h2>
          <p className={styles.description}>위험요소 필드와 상태를 수정합니다.</p>
        </div>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="수정 닫기"
        >
          <XIcon aria-hidden="true" />
          <span>닫기</span>
        </button>
      </header>

      {showInitialLoading && (
        <div className={styles.statePanel}>
          <Spinner className={styles.spinner} />
        </div>
      )}

      {showLoadError && (
        <div className={styles.statePanel}>
          <span>{RISK_ERROR_MESSAGES.LOAD_FAILED}</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            다시 시도
          </Button>
        </div>
      )}

      {hasRisk && (
        <div className={styles.body}>
          <RiskEditForm
            risk={risk}
            workspaceId={workspaceId}
            packId={packId}
            versionId={versionId}
            onClose={onClose}
          />
        </div>
      )}

      {showEmptyState && (
        <div className={styles.statePanel}>
          <span>위험요소 정보를 찾을 수 없습니다.</span>
        </div>
      )}
    </section>
  );
}
