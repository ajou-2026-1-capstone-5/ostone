import { useEffect } from "react";
import { Navigate, useOutletContext, useParams } from "react-router-dom";
import { usePipelineReviewCheckpoint } from "@/features/pipeline-review/api/pipelineReviewApi";
import { PipelineReviewCheckpointCard } from "@/features/pipeline-review/ui/PipelineReviewCheckpointCard";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import type { ShellContext } from "@/shared/ui/ostone/chrome";
import styles from "./pipeline-review-page.module.css";

export function PipelineReviewPage() {
  const { workspaceId, pipelineJobId } = useParams();
  const { setCrumbs } = useOutletContext<ShellContext>();
  const parsedWorkspaceId = parseRouteId(workspaceId);
  const parsedPipelineJobId = parseRouteId(pipelineJobId);
  const checkpointQuery = usePipelineReviewCheckpoint(
    parsedWorkspaceId ?? undefined,
    parsedPipelineJobId ?? undefined,
    { autoRefresh: true },
  );

  useEffect(() => {
    setCrumbs(["Pipeline review"]);
    return () => setCrumbs([]);
  }, [setCrumbs]);

  if (parsedWorkspaceId === null || parsedPipelineJobId === null) {
    return <Navigate to="/workspaces" replace />;
  }

  return (
    <div className={styles.pageWrapper}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>ML checkpoint</p>
          <h1 className={styles.title}>초안 생성 전에 파이프라인 입력을 확정합니다.</h1>
        </div>
        <span className={styles.jobBadge}>JOB-{parsedPipelineJobId}</span>
      </header>

      <section className={styles.contextPanel} aria-label="파이프라인 리뷰 맥락">
        <div className={styles.contextItem}>
          <span className={styles.contextLabel}>현재 단계</span>
          <strong>{statusLabel(checkpointQuery.data?.pipelineStatus, checkpointQuery.data?.reviewKind)}</strong>
        </div>
        <div className={styles.contextItem}>
          <span className={styles.contextLabel}>반영 방식</span>
          <strong>{checkpointQuery.data?.reviewKind ? "결정 후 replay" : "활성 체크포인트 없음"}</strong>
        </div>
        <div className={styles.contextItem}>
          <span className={styles.contextLabel}>초안 승인</span>
          <strong>Domain Pack 승인 화면에서 진행</strong>
        </div>
      </section>

      <PipelineReviewCheckpointCard workspaceId={parsedWorkspaceId} pipelineJobId={parsedPipelineJobId} />
    </div>
  );
}

function statusLabel(pipelineStatus?: string, reviewKind?: string | null): string {
  if (reviewKind === "DOMAIN_CONFIRMATION") {
    return "도메인 확정 대기";
  }
  if (reviewKind === "HUMAN_FEEDBACK") {
    return "사람 피드백 대기";
  }
  if (pipelineStatus === "SUCCEEDED") {
    return "파이프라인 완료";
  }
  if (pipelineStatus === "FAILED") {
    return "파이프라인 실패";
  }
  if (pipelineStatus) {
    return pipelineStatus;
  }
  return "확인 중";
}
