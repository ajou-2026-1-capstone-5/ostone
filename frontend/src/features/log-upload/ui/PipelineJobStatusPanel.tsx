import { Button } from "../../../shared/ui/button/Button";
import {
  CTA_GO_DOMAIN_PACK,
  CTA_GO_REVIEW,
  CTA_UPLOAD_AGAIN,
} from "../../../shared/lib/ctaLabels";
import type { LatestPipelineJob } from "../api/pipelineJobStatusApi";
import {
  derivePipelineJobViewState,
  type PipelineJobViewState,
} from "../model/useLatestDatasetPipelineJob";

import styles from "./log-upload-form.module.css";

export const CTA_START_GENERATION = "도메인팩 초안 생성 시작";

const CTA_REFRESH_PIPELINE_STATUS = "상태 새로고침";
const CTA_GO_PIPELINE_STATUS = "상태 화면으로 이동";
const CTA_RETRY_GENERATION = "도메인팩 초안 생성 다시 요청";

interface PanelAction {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}

type PipelineJobStatusPanelProps = Readonly<{
  queryState: { isLoading: boolean; isError: boolean; isFetching: boolean };
  job: LatestPipelineJob | null;
  reviewPath: string | null;
  domainPacksPath: string;
  canStartGeneration: boolean;
  isGenerationPending: boolean;
  onStartGeneration: () => void;
  onRefresh: () => void;
  onReset: () => void;
  onNavigate: (path: string) => void;
}>;

export function PipelineJobStatusPanel(props: PipelineJobStatusPanelProps) {
  const { queryState, job } = props;
  const viewState = derivePipelineJobViewState(queryState, job);
  const content = panelContent(viewState, job);
  const actions = panelActions(viewState, props);

  return (
    <div className={styles.generationPanel}>
      <span className={styles.statusLabel}>{content.label}</span>
      <p>{content.body}</p>
      {job && viewState !== "uploaded" && (
        <div className={styles.pipelineMeta}>
          <span>
            job {job.pipelineJobId}
            {job.airflowRunId ? ` · ${job.airflowRunId}` : ""}
          </span>
          <span>DAG {job.airflowDagId ?? "-"}</span>
          {job.runningDurationSeconds != null && (
            <span>실행 {formatDuration(job.runningDurationSeconds)}</span>
          )}
        </div>
      )}
      {viewState === "failed" && job?.lastErrorMessage && (
        <p>{job.lastErrorMessage}</p>
      )}
      {actions.length > 0 && (
        <div className={styles.successActions}>
          {actions.map((action, index) => (
            <Button
              key={action.label}
              variant={index === 0 ? "primary" : "secondary"}
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

interface PanelContent {
  readonly label: string;
  readonly body: string;
}

function panelContent(
  viewState: PipelineJobViewState,
  job: LatestPipelineJob | null,
): PanelContent {
  switch (viewState) {
    case "uploaded":
      return {
        label: "파이프라인 상태 확인 중",
        body: "업로드 완료 후 자동 생성된 Airflow job을 찾고 있습니다.",
      };
    case "status_unavailable":
      return {
        label: "파이프라인 상태 조회 실패",
        body: "자동 생성된 Airflow job 상태를 불러오지 못했습니다. 상태 새로고침으로 다시 시도해 주세요.",
      };
    case "pipeline_pending":
      return job
        ? {
            label: "자동 파이프라인 대기 중",
            body: "파이프라인이 대기열에 등록되어 Airflow 실행 시작을 기다리고 있습니다.",
          }
        : {
            label: "자동 파이프라인 대기 중",
            body: "업로드 완료 후 자동 생성될 Airflow job을 기다리고 있습니다. 자동 파이프라인이 시작되지 않으면 같은 데이터셋으로 도메인팩 초안 생성을 직접 요청할 수 있습니다.",
          };
    case "running":
      return {
        label: "자동 파이프라인 실행 중",
        body: "Airflow가 상담 로그를 분석하고 있습니다. 완료되면 검토 또는 도메인팩 확인으로 안내합니다.",
      };
    case "review_required":
      return {
        label: "검토 대기 중",
        body:
          job?.status === "WAITING_HUMAN_FEEDBACK"
            ? "클러스터 피드백 입력을 기다리고 있습니다. 검토 화면에서 애매한 경계를 확정해 주세요."
            : "도메인 확정 입력을 기다리고 있습니다. 검토 화면에서 후보 도메인을 선택해 주세요.",
      };
    case "succeeded":
      return {
        label: "파이프라인 완료",
        body: "자동 파이프라인이 완료되었습니다. 생성된 도메인팩 초안을 도메인팩 관리에서 확인해 주세요.",
      };
    case "failed":
      return {
        label: "파이프라인 실패",
        body: "자동 파이프라인이 실패했습니다. 같은 데이터셋으로 도메인팩 초안 생성을 다시 요청하거나 다른 파일을 업로드할 수 있습니다.",
      };
    case "cancelled":
      return {
        label: "파이프라인 취소됨",
        body: "자동 파이프라인이 취소되었습니다. 같은 데이터셋으로 도메인팩 초안 생성을 다시 요청하거나 다른 파일을 업로드할 수 있습니다.",
      };
  }
}

function panelActions(
  viewState: PipelineJobViewState,
  props: PipelineJobStatusPanelProps,
): PanelAction[] {
  const {
    queryState,
    job,
    reviewPath,
    domainPacksPath,
    canStartGeneration,
    isGenerationPending,
    onStartGeneration,
    onRefresh,
    onReset,
    onNavigate,
  } = props;

  const refresh: PanelAction = {
    label: CTA_REFRESH_PIPELINE_STATUS,
    onClick: onRefresh,
    disabled: queryState.isFetching,
  };
  const uploadAgain: PanelAction = {
    label: CTA_UPLOAD_AGAIN,
    onClick: onReset,
  };
  const goStatus: PanelAction | null = reviewPath
    ? { label: CTA_GO_PIPELINE_STATUS, onClick: () => onNavigate(reviewPath) }
    : null;
  const goReview: PanelAction | null = reviewPath
    ? { label: CTA_GO_REVIEW, onClick: () => onNavigate(reviewPath) }
    : null;
  const goDomainPacks: PanelAction = {
    label: CTA_GO_DOMAIN_PACK,
    onClick: () => onNavigate(domainPacksPath),
  };
  const startGeneration: PanelAction = {
    label: CTA_START_GENERATION,
    onClick: onStartGeneration,
    disabled: !canStartGeneration || isGenerationPending,
  };
  const retryGeneration: PanelAction = {
    label: CTA_RETRY_GENERATION,
    onClick: onStartGeneration,
    disabled: !canStartGeneration || isGenerationPending,
  };

  switch (viewState) {
    case "uploaded":
      return [];
    case "status_unavailable":
      return [refresh, uploadAgain];
    case "pipeline_pending":
      return job
        ? compact([goStatus, refresh, uploadAgain])
        : [refresh, startGeneration, uploadAgain];
    case "running":
      return compact([goStatus, refresh, uploadAgain]);
    case "review_required":
      return compact([goReview, refresh, uploadAgain]);
    case "succeeded":
      return compact([goDomainPacks, goStatus, uploadAgain]);
    case "failed":
    case "cancelled":
      return compact([retryGeneration, goStatus, uploadAgain]);
  }
}

function compact(actions: Array<PanelAction | null>): PanelAction[] {
  return actions.filter((action): action is PanelAction => action !== null);
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
