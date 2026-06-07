import React, { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";

import { FileUploader } from "../../../shared/ui/file-upload/FileUploader";
import { Button } from "../../../shared/ui/button/Button";
import {
  CTA_GO_DOMAIN_PACK,
  CTA_GO_REVIEW,
  CTA_UPLOAD_AGAIN,
} from "../../../shared/lib/ctaLabels";
import { buildWorkspaceBillingPath } from "../../../shared/lib/billingRoutes";
import { useTriggerDomainPackGeneration } from "../../../shared/api/generated/endpoints/domain-pack-generation-trigger-controller/domain-pack-generation-trigger-controller";
import {
  RAW_LOG_UPLOAD_ACCEPT,
  RAW_LOG_UPLOAD_ACCEPTED_TYPE_LABEL,
  RAW_LOG_UPLOAD_FILE_TYPE_LABELS,
  RAW_LOG_UPLOAD_MAX_SIZE_LABEL,
  validateRawLogUploadFile,
} from "../../../shared/lib/rawLogUploadPolicy";
import { parseRouteId } from "../../../shared/lib/parseRouteId";
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

export interface PaidUploadCooldown {
  readonly isBlocked: boolean;
  readonly nextAvailableAt?: string | null;
}

interface LogUploadFormProps {
  workspaceId?: number;
  freeOnboardingStatus?: FreeOnboardingStatus;
  hasActiveSubscription?: boolean;
  isEntitlementLoading?: boolean;
  paidUploadCooldown?: PaidUploadCooldown;
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

const formatCooldownMessage = (nextAvailableAt?: string | null) => {
  if (!nextAvailableAt) {
    return "도메인팩 생성·검토 시간당 한도가 회복되면 새 상담 로그 업로드를 다시 시작할 수 있습니다. 최근 도메인팩 생성·검토 후 최대 1시간 뒤 다시 시도해 주세요.";
  }

  const date = new Date(nextAvailableAt);
  if (Number.isNaN(date.getTime())) {
    return "도메인팩 생성·검토 시간당 한도가 회복되면 새 상담 로그 업로드를 다시 시작할 수 있습니다. 최근 도메인팩 생성·검토 후 최대 1시간 뒤 다시 시도해 주세요.";
  }

  return `도메인팩 생성·검토 시간당 한도가 회복되면 새 상담 로그 업로드를 다시 시작할 수 있습니다. 재개 가능 시점: ${date.toLocaleString("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;
};

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
  paidUploadCooldown,
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const generationDatasetId = parseRouteId(searchParams.get("datasetId") ?? undefined);
  const fileRequiredMessageId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [uploadedDataset, setUploadedDataset] =
    useState<UploadedDataset | null>(null);
  const [ignoredGenerationDatasetId, setIgnoredGenerationDatasetId] = useState<
    number | null
  >(null);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>({
    kind: "idle",
  });
  const generationRequestInFlightRef = useRef(false);

  const queryGenerationDataset =
    generationDatasetId !== null && generationDatasetId !== ignoredGenerationDatasetId
      ? {
          datasetId: generationDatasetId,
          fileName: `dataset ${generationDatasetId}`,
        }
      : null;
  const activeUploadedDataset = uploadedDataset ?? queryGenerationDataset;
  const displayStatus: UploadStatus =
    status === "idle" && queryGenerationDataset ? "success" : status;

  const rawFileUpload = useRawFileUpload();
  const ingestionJobQuery = useLatestDatasetPipelineJob(
    workspaceId,
    activeUploadedDataset?.datasetId,
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
  const isPaidCooldownBlocked = Boolean(
    hasActiveSubscription && paidUploadCooldown?.isBlocked,
  );
  const paidCooldownMessage = formatCooldownMessage(
    paidUploadCooldown?.nextAvailableAt,
  );
  const isConsumedWithoutSubscription =
    freeOnboardingStatus === "CONSUMED" && !hasActiveSubscription;
  const isUploadBlocked =
    (isConsumedWithoutSubscription || isPaidCooldownBlocked) &&
    !isEntitlementLoading;
  const isUploaderDisabled = isEntitlementLoading || isUploadBlocked;
  const blockedMessage =
    isPaidCooldownBlocked
      ? paidCooldownMessage
      : "무료 온보딩이 사용 완료되었습니다. 구독을 활성화한 뒤 업로드할 수 있습니다.";
  const billingPath =
    workspaceId != null ? buildWorkspaceBillingPath(workspaceId) : "/workspaces";

  const handleFileSelect = (selectedFile: File) => {
    if (isUploaderDisabled) {
      toast.error(
        isEntitlementLoading ? "업로드 가능 여부를 확인 중입니다." : blockedMessage,
      );
      return;
    }
    const errorMessage = validateRawLogUploadFile(selectedFile);
    if (errorMessage) {
      toast.error(errorMessage);
      return;
    }
    setFile(selectedFile);
    setIgnoredGenerationDatasetId(generationDatasetId);
    setStatus("idle");
    setUploadedDataset(null);
    setGenerationStatus({ kind: "idle" });
    generationRequestInFlightRef.current = false;
    rawFileUpload.reset();
    generationMutation.reset();
  };

  const handleUpload = (fileToUpload: File) => {
    if (!workspaceId) return;
    if (isUploaderDisabled) {
      toast.error(
        isEntitlementLoading ? "업로드 가능 여부를 확인 중입니다." : blockedMessage,
      );
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
    if (isUploaderDisabled) {
      toast.error(
        isEntitlementLoading ? "업로드 가능 여부를 확인 중입니다." : blockedMessage,
      );
      return;
    }
    if (!workspaceId || !activeUploadedDataset?.datasetId) {
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
      datasetId: activeUploadedDataset.datasetId,
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
    setIgnoredGenerationDatasetId(generationDatasetId);
    if (generationDatasetId !== null && workspaceId != null) {
      navigate(`/workspaces/${workspaceId}/upload`, { replace: true });
    }
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
  const canStartGeneration = Boolean(activeUploadedDataset?.datasetId) && !isUploaderDisabled;
  const isGenerationPending =
    generationStatus.kind === "triggering" || generationMutation.isPending;
  const isDashboardGenerationTarget =
    queryGenerationDataset !== null && uploadedDataset === null;
  const shouldShowManualGenerationFallback =
    generationStatus.kind === "idle" &&
    (isDashboardGenerationTarget ||
      (!ingestionJob && !ingestionJobQuery.isLoading && !ingestionJobQuery.isError));
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
        data-status={
          isPaidCooldownBlocked ? "cooldown" : freeOnboardingStatus.toLowerCase()
        }
      >
        <span className={styles.statusLabel}>
          {isEntitlementLoading
            ? "권한 확인 중"
            : isPaidCooldownBlocked
              ? "도메인팩 작업 쿨다운 중"
              : freeOnboardingMeta.label}
        </span>
        <p>
          {isPaidCooldownBlocked
            ? paidCooldownMessage
            : hasActiveSubscription
            ? "활성 구독이 적용되어 새 업로드와 도메인팩 생성 요청을 계속 사용할 수 있습니다."
            : freeOnboardingMeta.copy}
        </p>
        {isUploadBlocked && isConsumedWithoutSubscription && (
          <div className={styles.blockedActions}>
            <Button variant="secondary" onClick={() => navigate(billingPath)}>
              구독/결제 화면으로 이동
            </Button>
          </div>
        )}
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

      {displayStatus === "idle" && (
        <div
          className={`${styles.filePreview} ${file ? "" : styles.emptyFilePreview}`}
        >
          {file ? (
            <div className={styles.fileInfo}>
              <span className={styles.fileName}>{file.name}</span>
              <span className={styles.fileSize}>
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
          ) : (
            <div className={styles.fileInfo}>
              <span className={styles.fileName}>
                파일을 먼저 선택해 주세요.
              </span>
              <span className={styles.fileSize} id={fileRequiredMessageId}>
                처리 시작 전에 ZIP 상담 로그 파일이 필요합니다.
              </span>
            </div>
          )}
          <Button
            onClick={() => {
              if (file) handleUpload(file);
            }}
            disabled={!file || isUploaderDisabled}
            aria-describedby={file ? undefined : fileRequiredMessageId}
          >
            처리 시작
          </Button>
        </div>
      )}

      {displayStatus === "success" && (
        <div className={styles.afterUpload}>
          <div className={styles.uploadSummary}>
            <span className={styles.statusLabel}>
              {isDashboardGenerationTarget ? "생성 대상 상담 로그" : "업로드 완료"}
            </span>
            <strong>{activeUploadedDataset?.fileName ?? file?.name}</strong>
            <span>
              {activeUploadedDataset?.datasetId
                ? `dataset ${activeUploadedDataset.datasetId}`
                : "데이터셋 ID 확인 필요"}
            </span>
          </div>

          {!isDashboardGenerationTarget && (
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
          )}

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
