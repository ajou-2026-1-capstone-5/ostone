import React, { useRef, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

import { FileUploader } from "../../../shared/ui/file-upload/FileUploader";
import { Button } from "../../../shared/ui/button/Button";
import {
  CTA_GO_DOMAIN_PACK,
  CTA_GO_REVIEW,
  CTA_UPLOAD_AGAIN,
} from "../../../shared/lib/ctaLabels";
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

import styles from "./log-upload-form.module.css";
import { PipelineJobStatusPanel } from "./PipelineJobStatusPanel";

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
  const isUploadBlocked =
    isConsumedWithoutSubscription && !isEntitlementLoading;
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
  const handleIngestionRefresh = () => {
    ingestionJobQuery.refetch();
  };

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
            onRefresh={handleIngestionRefresh}
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
                  <Button onClick={() => navigate(pipelineReviewPath)}>
                    {CTA_GO_REVIEW}
                  </Button>
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
