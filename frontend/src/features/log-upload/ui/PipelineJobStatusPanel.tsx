import { Button } from "../../../shared/ui/button/Button";
import type { LatestPipelineJob } from "../api/pipelineJobStatusApi";

import styles from "./log-upload-form.module.css";

interface PipelineStatusMeta {
  title: string;
  detail: string;
  primaryActionLabel: string;
}

type PipelineJobStatusPanelProps = Readonly<{
  queryState: { isLoading: boolean; isError: boolean; isFetching: boolean };
  job: LatestPipelineJob | null;
  reviewPath: string | null;
  onRefresh: () => void;
  onReset: () => void;
  onNavigate: (path: string) => void;
}>;

export function PipelineJobStatusPanel({
  queryState,
  job,
  reviewPath,
  onRefresh,
  onReset,
  onNavigate,
}: PipelineJobStatusPanelProps) {
  const statusMeta = pipelineStatusMeta(job?.status);

  if (queryState.isLoading) {
    return (
      <div className={styles.generationPanel}>
        <span className={styles.statusLabel}>파이프라인 상태 확인 중</span>
        <p>업로드 완료 후 자동 생성된 Airflow job을 찾고 있습니다.</p>
      </div>
    );
  }

  if (queryState.isError) {
    return (
      <div className={styles.generationPanel}>
        <span className={styles.statusLabel}>파이프라인 상태 조회 실패</span>
        <p>자동 생성된 Airflow job 상태를 불러오지 못했습니다.</p>
        <div className={styles.successActions}>
          <Button variant="secondary" onClick={onReset}>
            다른 파일 업로드
          </Button>
          <Button onClick={onRefresh} disabled={queryState.isFetching}>
            상태 새로고침
          </Button>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className={styles.generationPanel}>
        <span className={styles.statusLabel}>파이프라인 준비 중</span>
        <p>업로드 완료 후 자동 생성될 Airflow job을 기다리고 있습니다.</p>
        <div className={styles.successActions}>
          <Button onClick={onRefresh} disabled={queryState.isFetching}>
            상태 새로고침
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.generationPanel}>
      <span className={styles.statusLabel}>자동 생성 파이프라인</span>
      <p>
        {statusMeta.title} · job {job.pipelineJobId}
        {job.airflowRunId ? ` · ${job.airflowRunId}` : ""}
      </p>
      <div className={styles.pipelineMeta}>
        <span>DAG {job.airflowDagId ?? "-"}</span>
        <span>
          {job.runningDurationSeconds == null
            ? statusMeta.detail
            : `실행 ${formatDuration(job.runningDurationSeconds)}`}
        </span>
      </div>
      {job.lastErrorMessage && <p>{job.lastErrorMessage}</p>}
      <div className={styles.successActions}>
        <Button variant="secondary" onClick={onReset}>
          다른 파일 업로드
        </Button>
        {reviewPath && (
          <Button onClick={() => onNavigate(reviewPath)}>
            {statusMeta.primaryActionLabel}
          </Button>
        )}
        <Button
          variant={reviewPath ? "secondary" : "primary"}
          onClick={onRefresh}
          disabled={queryState.isFetching}
        >
          상태 새로고침
        </Button>
      </div>
    </div>
  );
}

const DEFAULT_PIPELINE_STATUS_META: PipelineStatusMeta = {
  title: "파이프라인이 실행 중입니다.",
  detail: "Airflow가 상담 로그를 분석하고 있습니다.",
  primaryActionLabel: "상태 화면으로 이동",
};

const PIPELINE_STATUS_META: Record<string, PipelineStatusMeta> = {
  WAITING_DOMAIN_CONFIRMATION: {
    title: "도메인 확정 입력을 기다리고 있습니다.",
    detail: "검토 화면에서 후보 도메인을 선택할 수 있습니다.",
    primaryActionLabel: "검토 화면으로 이동",
  },
  WAITING_HUMAN_FEEDBACK: {
    title: "클러스터 피드백 입력을 기다리고 있습니다.",
    detail: "검토 화면에서 애매한 경계를 확정할 수 있습니다.",
    primaryActionLabel: "검토 화면으로 이동",
  },
  SUCCEEDED: {
    title: "파이프라인이 완료되었습니다.",
    detail: "생성된 도메인팩 초안을 확인할 수 있습니다.",
    primaryActionLabel: "상태 화면으로 이동",
  },
  FAILED: {
    title: "파이프라인이 실패했습니다.",
    detail: "실패 원인을 확인한 뒤 다시 시도할 수 있습니다.",
    primaryActionLabel: "상태 화면으로 이동",
  },
  CANCELLED: {
    title: "파이프라인이 취소되었습니다.",
    detail: "필요하면 다시 업로드하거나 생성 요청을 다시 보낼 수 있습니다.",
    primaryActionLabel: "상태 화면으로 이동",
  },
  QUEUED: {
    title: "파이프라인이 대기열에 등록되었습니다.",
    detail: "Airflow 실행 시작을 기다리고 있습니다.",
    primaryActionLabel: "상태 화면으로 이동",
  },
};

function pipelineStatusMeta(status?: string): PipelineStatusMeta {
  return status
    ? (PIPELINE_STATUS_META[status] ?? DEFAULT_PIPELINE_STATUS_META)
    : DEFAULT_PIPELINE_STATUS_META;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}초`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds === 0
      ? `${minutes}분`
      : `${minutes}분 ${remainingSeconds}초`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0
    ? `${hours}시간`
    : `${hours}시간 ${remainingMinutes}분`;
}
