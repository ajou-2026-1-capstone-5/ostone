import { useState } from "react";
import { ArrowRightIcon, RefreshCwIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { DomainPackApprovalReadiness } from "../model/buildDomainPackApprovalReadiness";
import { DomainPackApprovalDialog } from "./DomainPackApprovalDialog";
import styles from "./SummaryDetailPanel.module.css";

interface DomainPackApprovalCardProps {
  readiness: DomainPackApprovalReadiness;
  isActivating: boolean;
  isPublished: boolean;
  onApprove: () => Promise<void> | void;
  onRetryReadiness: () => void;
}

export function DomainPackApprovalCard({
  readiness,
  isActivating,
  isPublished,
  onApprove,
  onRetryReadiness,
}: Readonly<DomainPackApprovalCardProps>) {
  const navigate = useNavigate();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const isBlocked = !readiness.ready && !isPublished;

  const handleConfirm = async () => {
    try {
      await onApprove();
    } finally {
      setDialogOpen(false);
    }
  };

  return (
    <section className={styles.approvalCard} aria-labelledby="approval-card-title">
      <div className={styles.approvalHeader}>
        <div>
          <h2 id="approval-card-title" className={styles.approvalTitle}>
            승인 준비 상태
          </h2>
          <p className={styles.approvalDescription}>
            {resolveDescription({ readiness, isPublished })}
          </p>
        </div>
        <span className={resolveBadgeClassName({ readiness, isPublished })}>
          {resolveBadgeLabel({ readiness, isPublished })}
        </span>
      </div>

      {readiness.isLoading && (
        <div className={styles.approvalSkeleton} aria-label="승인 준비 상태 로딩 중">
          <div className={styles.skeletonBlock} aria-hidden />
          <div className={styles.skeletonBlock} aria-hidden />
        </div>
      )}

      {isBlocked && !readiness.isLoading && (
        <div className={styles.blockerArea}>
          <p className={styles.blockerIntro}>승인 전에 아래 항목을 먼저 처리해 주세요.</p>
          <ul className={styles.blockerList}>
            {readiness.blockers.map((blocker, index) => {
              const actionPath = blocker.actionPath;

              return (
                <li key={`${blocker.type}-${index}`} className={styles.blockerItem}>
                  <span>{blocker.message}</span>
                  {actionPath && (
                    <button
                      type="button"
                      className={styles.blockerAction}
                      onClick={() => navigate(actionPath)}
                    >
                      Intent 검토하기
                      <ArrowRightIcon aria-hidden />
                    </button>
                  )}
                  {!actionPath && blocker.type === "SERVER" && (
                    <button
                      type="button"
                      className={styles.blockerAction}
                      onClick={onRetryReadiness}
                    >
                      다시 시도
                      <RefreshCwIcon aria-hidden />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!isPublished && (
        <div className={styles.approvalActions}>
          <button
            type="button"
            className={styles.approvalButton}
            onClick={() => setDialogOpen(true)}
            disabled={!readiness.ready || readiness.isLoading || isActivating}
          >
            {isActivating ? "처리 중..." : "승인"}
          </button>
        </div>
      )}

      <DomainPackApprovalDialog
        open={isDialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={handleConfirm}
        isLoading={isActivating}
      />
    </section>
  );
}

function resolveDescription({
  readiness,
  isPublished,
}: {
  readiness: DomainPackApprovalReadiness;
  isPublished: boolean;
}): string {
  if (isPublished) return "이 버전은 운영에 사용 중입니다.";
  if (readiness.isLoading) return "승인 가능 여부를 확인하고 있습니다.";
  if (readiness.ready) {
    return "승인할 수 있습니다. 모든 Intent가 승인 또는 반려되었고, 선택한 버전은 최신 버전입니다.";
  }
  return "아직 승인할 수 없습니다.";
}

function resolveBadgeLabel({
  readiness,
  isPublished,
}: {
  readiness: DomainPackApprovalReadiness;
  isPublished: boolean;
}): string {
  if (isPublished) return "승인 완료";
  if (readiness.isLoading) return "확인 중";
  if (readiness.ready) return "승인 가능";
  return "차단됨";
}

function resolveBadgeClassName({
  readiness,
  isPublished,
}: {
  readiness: DomainPackApprovalReadiness;
  isPublished: boolean;
}): string {
  if (isPublished || readiness.ready) {
    return `${styles.approvalBadge} ${styles.approvalBadgeReady}`;
  }
  return styles.approvalBadge;
}
