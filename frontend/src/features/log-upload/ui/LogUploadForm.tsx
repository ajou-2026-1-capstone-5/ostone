import React, { useRef, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

import { FileUploader } from "../../../shared/ui/file-upload/FileUploader";
import { Button } from "../../../shared/ui/button/Button";
import { CTA_GO_DOMAIN_PACK, CTA_GO_REVIEW, CTA_UPLOAD_AGAIN } from "../../../shared/lib/ctaLabels";
import { useTriggerDomainPackGeneration } from "../../../shared/api/generated/endpoints/domain-pack-generation-trigger-controller/domain-pack-generation-trigger-controller";
import {
  RAW_LOG_UPLOAD_ACCEPT,
  RAW_LOG_UPLOAD_ACCEPTED_TYPE_LABEL,
  RAW_LOG_UPLOAD_FILE_TYPE_LABELS,
  RAW_LOG_UPLOAD_MAX_SIZE_LABEL,
  validateRawLogUploadFile,
} from "../../../shared/lib/rawLogUploadPolicy";
import { useRawFileUpload } from "../model/useRawFileUpload";
import { useLatestDatasetPipelineJob } from "../model/useLatestDatasetPipelineJob";
import type { LatestPipelineJob } from "../api/pipelineJobStatusApi";

import styles from "./log-upload-form.module.css";

type UploadStatus = "idle" | "uploading" | "success";

type GenerationStatus =
  | { kind: "idle" }
  | { kind: "triggering" }
  | { kind: "success"; pipelineJobId: number | null; status: string | null }
  | { kind: "error"; message: string };

interface UploadedDataset {
  datasetId: number | null;
  fileName: string;
}

interface GenerationResponseLike {
  data?: {
    pipelineJobId?: number;
    status?: string;
  };
  pipelineJobId?: number;
  status?: string;
}

export type FreeOnboardingStatus = "AVAILABLE" | "IN_PROGRESS" | "CONSUMED";

interface LogUploadFormProps {
  workspaceId?: number;
  freeOnboardingStatus?: FreeOnboardingStatus;
  hasActiveSubscription?: boolean;
  isEntitlementLoading?: boolean;
}

const FREE_ONBOARDING_STATUS_META: Record<
  FreeOnboardingStatus,
  { label: string; copy: string }
> = {
  AVAILABLE: {
    label: "무료 온보딩 가능",
    copy: "첫 상담 로그 업로드와 도메인팩 초안 생성까지 무료로 진행할 수 있습니다.",
  },
  IN_PROGRESS: {
    label: "무료 온보딩 진행 중",
    copy: "현재 업로드한 데이터셋으로 도메인팩 초안 생성과 검토 진입을 계속할 수 있습니다.",
  },
  CONSUMED: {
    label: "무료 온보딩 사용 완료",
    copy: "무료 온보딩 권리가 사용 완료되었습니다. 활성 구독이 없으면 새 업로드와 생성 요청이 제한됩니다.",
  },
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const readGenerationResponse = (
  response: unknown,
): Omit<GenerationStatus & { kind: "success" }, "kind"> => {
  const r =
    typeof response === "object" && response !== null
      ? (response as GenerationResponseLike)
      : null;

  return {
    pipelineJobId: r?.data?.pipelineJobId ?? r?.pipelineJobId ?? null,
    status: r?.data?.status ?? r?.status ?? null,
  };
};

export const LogUploadForm: React.FC<LogUploadFormProps> = ({
  workspaceId,
  freeOnboardingStatus = "AVAILABLE",
  hasActiveSubscription = false,
  isEntitlementLoading = false,
}) => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [uploadedDataset, setUploadedDataset] =
    useState<UploadedDataset | null>(null);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>({
    kind: "idle",
  });
  const generationRequestInFlightRef = useRef(false);

  const rawFileUpload = useRawFileUpload();
  const ingestionJobQuery = useLatestDatasetPipelineJob(
    workspaceId,
    uploadedDataset?.datasetId,
    "INGESTION",
  );

  const generationMutation = useTriggerDomainPackGeneration({
    mutation: {
      onSuccess: (response) => {
        generationRequestInFlightRef.current = false;
        setGenerationStatus({
          kind: "success",
          ...readGenerationResponse(response),
        });
        toast.success("도메인팩 초안 생성 요청 완료");
      },
      onError: (error) => {
        generationRequestInFlightRef.current = false;
        const message = getErrorMessage(
          error,
          "도메인팩 초안 생성 요청에 실패했습니다.",
        );
        setGenerationStatus({ kind: "error", message });
        toast.error(message, {
          action: {
            label: "재시도",
            onClick: () => handleStartGeneration(),
          },
        });
      },
    },
  });

  const freeOnboardingMeta = FREE_ONBOARDING_STATUS_META[freeOnboardingStatus];
  const isConsumedWithoutSubscription =
    freeOnboardingStatus === "CONSUMED" && !hasActiveSubscription;
  const isUploadBlocked = isConsumedWithoutSubscription && !isEntitlementLoading;
  const isUploaderDisabled =
    isUploadBlocked || (isEntitlementLoading && isConsumedWithoutSubscription);
  const blockedMessage =
    "무료 온보딩이 사용 완료되었습니다. 구독을 활성화한 뒤 업로드할 수 있습니다.";

  const handleFileSelect = (selectedFile: File) => {
    if (isUploadBlocked) {
      toast.error(blockedMessage);
      return;
    }
    const errorMessage = validateRawLogUploadFile(selectedFile);
    if (errorMessage) {
      toast.error(errorMessage);
      return;
    }
    setFile(selectedFile);
    setStatus("idle");
    setUploadedDataset(null);
    setGenerationStatus({ kind: "idle" });
    generationRequestInFlightRef.current = false;
    rawFileUpload.reset();
    generationMutation.reset();
  };

  const handleUpload = (fileToUpload: File) => {
    if (!workspaceId) return;
    if (isUploadBlocked) {
      toast.error(blockedMessage);
      return;
    }
    setStatus("uploading");
    void rawFileUpload.start({
      workspaceId,
      file: fileToUpload,
      onSuccess: (result) => {
        setUploadedDataset({
          datasetId: result.datasetId ?? null,
          fileName: fileToUpload.name,
        });
        setGenerationStatus({ kind: "idle" });
        generationRequestInFlightRef.current = false;
        setStatus("success");
        toast.success("업로드 완료");
      },
      onError: (message) => {
        setStatus("idle");
        setUploadedDataset(null);
        setGenerationStatus({ kind: "idle" });
        generationRequestInFlightRef.current = false;
        toast.error(message, {
          action: {
            label: "재시도",
            onClick: () => handleUpload(fileToUpload),
          },
        });
      },
    });
  };

  const handleCancelUpload = () => {
    rawFileUpload.cancel();
    setStatus("idle");
  };

  function handleStartGeneration() {
    if (!workspaceId || !uploadedDataset?.datasetId) {
      toast.error("생성 요청에 필요한 데이터셋 정보를 확인할 수 없습니다.");
      return;
    }
    if (generationRequestInFlightRef.current || generationMutation.isPending) {
      return;
    }

    generationRequestInFlightRef.current = true;
    setGenerationStatus({ kind: "triggering" });
    generationMutation.mutate({
      workspaceId,
      datasetId: uploadedDataset.datasetId,
    });
  }

  const handleReset = () => {
    rawFileUpload.reset();
    generationMutation.reset();
    setFile(null);
    setUploadedDataset(null);
    setStatus("idle");
    setGenerationStatus({ kind: "idle" });
    generationRequestInFlightRef.current = false;
  };

  const domainPacksPath = workspaceId
    ? `/workspaces/${workspaceId}/domain-packs`
    : "/workspaces";
  const pipelineReviewPath =
    workspaceId != null &&
    generationStatus.kind === "success" &&
    generationStatus.pipelineJobId != null
      ? `/workspaces/${workspaceId}/pipeline-jobs/${generationStatus.pipelineJobId}/review`
      : null;
  const ingestionJob = ingestionJobQuery.data?.pipelineJob ?? null;
  const ingestionReviewPath =
    workspaceId != null && ingestionJob != null
      ? `/workspaces/${workspaceId}/pipeline-jobs/${ingestionJob.pipelineJobId}/review`
      : null;
  const canStartGeneration = Boolean(uploadedDataset?.datasetId);
  const isGenerationPending =
    generationStatus.kind === "triggering" || generationMutation.isPending;
  const shouldShowManualGenerationFallback =
    generationStatus.kind === "idle" &&
    !ingestionJob &&
    !ingestionJobQuery.isLoading &&
    !ingestionJobQuery.isError;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>상담 로그 업로드</h2>
        <p>상담로그를 업로드 하면 챗봇이 작동할 수 있는 데이터가 생성됩니다.</p>
      </div>

      <div
        className={styles.onboardingStatus}
        data-status={freeOnboardingStatus.toLowerCase()}
      >
        <span className={styles.statusLabel}>
          {isEntitlementLoading ? "권한 확인 중" : freeOnboardingMeta.label}
        </span>
        <p>
          {hasActiveSubscription
            ? "활성 구독이 적용되어 새 업로드와 도메인팩 생성 요청을 계속 사용할 수 있습니다."
            : freeOnboardingMeta.copy}
        </p>
      </div>

      <div className={styles.uploadArea}>
        <FileUploader
          onFileSelect={handleFileSelect}
          acceptedTypes={RAW_LOG_UPLOAD_ACCEPT}
          acceptedTypeLabel={RAW_LOG_UPLOAD_ACCEPTED_TYPE_LABEL}
          maxSizeLabel={RAW_LOG_UPLOAD_MAX_SIZE_LABEL}
          fileTypeLabels={RAW_LOG_UPLOAD_FILE_TYPE_LABELS}
          status={status}
          progress={rawFileUpload.progress}
          isUploading={rawFileUpload.isUploading}
          onCancel={handleCancelUpload}
          disabled={isUploaderDisabled}
        />
      </div>

      {status === "idle" && file && (
        <div className={styles.filePreview}>
          <div className={styles.fileInfo}>
            <span className={styles.fileName}>{file.name}</span>
            <span className={styles.fileSize}>
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </span>
          </div>
          <Button onClick={() => handleUpload(file)} disabled={isUploadBlocked}>
            처리 시작
          </Button>
        </div>
      )}

      {status === "success" && (
        <div className={styles.afterUpload}>
          <div className={styles.uploadSummary}>
            <span className={styles.statusLabel}>업로드 완료</span>
            <strong>{uploadedDataset?.fileName ?? file?.name}</strong>
            <span>
              {uploadedDataset?.datasetId
                ? `dataset ${uploadedDataset.datasetId}`
                : "데이터셋 ID 확인 필요"}
            </span>
          </div>

          <PipelineJobStatusPanel
            queryState={{
              isLoading: ingestionJobQuery.isLoading,
              isError: ingestionJobQuery.isError,
              isFetching: ingestionJobQuery.isFetching,
            }}
            job={ingestionJob}
            reviewPath={ingestionReviewPath}
            onRefresh={() => void ingestionJobQuery.refetch()}
            onReset={handleReset}
            onNavigate={navigate}
          />

          {shouldShowManualGenerationFallback && (
            <div className={styles.generationPanel}>
              <p>
                자동 파이프라인이 생성되지 않았거나 별도 재실행이 필요한 경우,
                업로드한 데이터셋으로 도메인팩 초안 생성을 직접 요청할 수
                있습니다.
              </p>
              <div className={styles.successActions}>
                <Button variant="secondary" onClick={handleReset}>
                  {CTA_UPLOAD_AGAIN}
                </Button>
                <Button
                  onClick={handleStartGeneration}
                  disabled={!canStartGeneration || isGenerationPending}
                >
                  도메인팩 초안 생성 시작
                </Button>
              </div>
            </div>
          )}

          {isGenerationPending && (
            <div className={styles.generationPanel}>
              <span className={styles.statusLabel}>생성 요청 중</span>
              <p>
                파이프라인 생성 요청을 보내고 있습니다. 잠시만 기다려 주세요.
              </p>
              <Button
                variant="secondary"
                onClick={handleReset}
                disabled={generationMutation.isPending}
              >
                {CTA_UPLOAD_AGAIN}
              </Button>
            </div>
          )}

          {generationStatus.kind === "error" && (
            <div className={styles.generationPanel}>
              <span className={styles.statusLabel}>생성 요청 실패</span>
              <p>{generationStatus.message}</p>
              <div className={styles.successActions}>
                <Button variant="secondary" onClick={handleReset}>
                  {CTA_UPLOAD_AGAIN}
                </Button>
                <Button
                  onClick={handleStartGeneration}
                  disabled={!canStartGeneration || isGenerationPending}
                >
                  다시 생성 요청
                </Button>
              </div>
            </div>
          )}

          {generationStatus.kind === "success" && (
            <div className={styles.generationPanel}>
              <span className={styles.statusLabel}>생성 요청 완료</span>
              <p>
                도메인팩 초안 생성 파이프라인이 등록되었습니다.
                {generationStatus.pipelineJobId
                  ? ` job ${generationStatus.pipelineJobId}`
                  : ""}
                {generationStatus.status ? ` · ${generationStatus.status}` : ""}
              </p>
              <div className={styles.successActions}>
                {pipelineReviewPath && (
                  <Button onClick={() => navigate(pipelineReviewPath)}>{CTA_GO_REVIEW}</Button>
                )}
                <Button
                  variant={pipelineReviewPath ? "secondary" : "primary"}
                  onClick={() => navigate(domainPacksPath)}
                >
                  {CTA_GO_DOMAIN_PACK}
                </Button>
                <Button variant="ghost" onClick={handleReset}>
                  {CTA_UPLOAD_AGAIN}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function PipelineJobStatusPanel({
  queryState,
  job,
  reviewPath,
  onRefresh,
  onReset,
  onNavigate,
}: {
  queryState: { isLoading: boolean; isError: boolean; isFetching: boolean };
  job: LatestPipelineJob | null;
  reviewPath: string | null;
  onRefresh: () => void;
  onReset: () => void;
  onNavigate: (path: string) => void;
}) {
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
          {job.runningDurationSeconds != null
            ? `실행 ${formatDuration(job.runningDurationSeconds)}`
            : statusMeta.detail}
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

function pipelineStatusMeta(status?: string) {
  if (status === "WAITING_DOMAIN_CONFIRMATION") {
    return {
      title: "도메인 확정 입력을 기다리고 있습니다.",
      detail: "검토 화면에서 후보 도메인을 선택할 수 있습니다.",
      primaryActionLabel: "검토 화면으로 이동",
    };
  }
  if (status === "WAITING_HUMAN_FEEDBACK") {
    return {
      title: "클러스터 피드백 입력을 기다리고 있습니다.",
      detail: "검토 화면에서 애매한 경계를 확정할 수 있습니다.",
      primaryActionLabel: "검토 화면으로 이동",
    };
  }
  if (status === "SUCCEEDED") {
    return {
      title: "파이프라인이 완료되었습니다.",
      detail: "생성된 도메인팩 초안을 확인할 수 있습니다.",
      primaryActionLabel: "상태 화면으로 이동",
    };
  }
  if (status === "FAILED") {
    return {
      title: "파이프라인이 실패했습니다.",
      detail: "실패 원인을 확인한 뒤 다시 시도할 수 있습니다.",
      primaryActionLabel: "상태 화면으로 이동",
    };
  }
  if (status === "CANCELLED") {
    return {
      title: "파이프라인이 취소되었습니다.",
      detail: "필요하면 다시 업로드하거나 생성 요청을 다시 보낼 수 있습니다.",
      primaryActionLabel: "상태 화면으로 이동",
    };
  }
  if (status === "QUEUED") {
    return {
      title: "파이프라인이 대기열에 등록되었습니다.",
      detail: "Airflow 실행 시작을 기다리고 있습니다.",
      primaryActionLabel: "상태 화면으로 이동",
    };
  }
  return {
    title: "파이프라인이 실행 중입니다.",
    detail: "Airflow가 상담 로그를 분석하고 있습니다.",
    primaryActionLabel: "상태 화면으로 이동",
  };
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds === 0
      ? `${minutes}m`
      : `${minutes}m ${remainingSeconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0
    ? `${hours}h`
    : `${hours}h ${remainingMinutes}m`;
}
