import React, { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

import { FileUploader } from "../../../shared/ui/file-upload/FileUploader";
import { Button } from "../../../shared/ui/button/Button";
import { useTriggerDomainPackGeneration } from "../../../shared/api/generated/endpoints/domain-pack-generation-trigger-controller/domain-pack-generation-trigger-controller";
import {
  RAW_LOG_UPLOAD_ACCEPT,
  RAW_LOG_UPLOAD_ACCEPTED_TYPE_LABEL,
  RAW_LOG_UPLOAD_FILE_TYPE_LABELS,
  RAW_LOG_UPLOAD_MAX_SIZE_LABEL,
  validateRawLogUploadFile,
} from "../../../shared/lib/rawLogUploadPolicy";
import { useRawFileUpload } from "../model/useRawFileUpload";

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

interface LogUploadFormProps {
  workspaceId?: number;
}

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const readGenerationResponse = (
  response: unknown,
): Omit<GenerationStatus & { kind: "success" }, "kind"> => {
  const r =
    typeof response === "object" && response !== null ? (response as GenerationResponseLike) : null;

  return {
    pipelineJobId: r?.data?.pipelineJobId ?? r?.pipelineJobId ?? null,
    status: r?.data?.status ?? r?.status ?? null,
  };
};

export const LogUploadForm: React.FC<LogUploadFormProps> = ({ workspaceId }) => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [uploadedDataset, setUploadedDataset] = useState<UploadedDataset | null>(null);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>({ kind: "idle" });

  const rawFileUpload = useRawFileUpload();

  const generationMutation = useTriggerDomainPackGeneration({
    mutation: {
      onSuccess: (response) => {
        setGenerationStatus({ kind: "success", ...readGenerationResponse(response) });
        toast.success("도메인팩 초안 생성 요청 완료");
      },
      onError: (error) => {
        const message = getErrorMessage(error, "도메인팩 초안 생성 요청에 실패했습니다.");
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

  const handleFileSelect = (selectedFile: File) => {
    const errorMessage = validateRawLogUploadFile(selectedFile);
    if (errorMessage) {
      toast.error(errorMessage);
      return;
    }
    setFile(selectedFile);
    setStatus("idle");
    setUploadedDataset(null);
    setGenerationStatus({ kind: "idle" });
    rawFileUpload.reset();
    generationMutation.reset();
  };

  const handleUpload = (fileToUpload: File) => {
    if (!workspaceId) return;
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
        setStatus("success");
        toast.success("업로드 완료");
      },
      onError: (message) => {
        setStatus("idle");
        setUploadedDataset(null);
        setGenerationStatus({ kind: "idle" });
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
  };

  const domainPacksPath = workspaceId ? `/workspaces/${workspaceId}/domain-packs` : "/workspaces";
  const pipelineReviewPath =
    workspaceId != null &&
    generationStatus.kind === "success" &&
    generationStatus.pipelineJobId != null
      ? `/workspaces/${workspaceId}/pipeline-jobs/${generationStatus.pipelineJobId}/review`
      : null;
  const canStartGeneration = Boolean(uploadedDataset?.datasetId);
  const isGenerationPending =
    generationStatus.kind === "triggering" || generationMutation.isPending;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>상담 로그 업로드</h2>
        <p>상담로그를 업로드 하면 챗봇이 작동할 수 있는 데이터가 생성됩니다.</p>
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
        />
      </div>

      {status === "idle" && file && (
        <div className={styles.filePreview}>
          <div className={styles.fileInfo}>
            <span className={styles.fileName}>{file.name}</span>
            <span className={styles.fileSize}>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
          </div>
          <Button onClick={() => handleUpload(file)}>처리 시작</Button>
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

          {generationStatus.kind === "idle" && (
            <div className={styles.generationPanel}>
              <p>
                업로드한 데이터셋을 기반으로 intent, slot, policy, risk, workflow 초안을 생성할 수
                있습니다.
              </p>
              <div className={styles.successActions}>
                <Button variant="secondary" onClick={handleReset}>
                  다른 파일 업로드
                </Button>
                <Button onClick={handleStartGeneration} disabled={!canStartGeneration}>
                  도메인팩 초안 생성 시작
                </Button>
              </div>
            </div>
          )}

          {isGenerationPending && (
            <div className={styles.generationPanel}>
              <span className={styles.statusLabel}>생성 요청 중</span>
              <p>파이프라인 생성 요청을 보내고 있습니다. 잠시만 기다려 주세요.</p>
              <Button
                variant="secondary"
                onClick={handleReset}
                disabled={generationMutation.isPending}
              >
                다른 파일 업로드
              </Button>
            </div>
          )}

          {generationStatus.kind === "error" && (
            <div className={styles.generationPanel}>
              <span className={styles.statusLabel}>생성 요청 실패</span>
              <p>{generationStatus.message}</p>
              <div className={styles.successActions}>
                <Button variant="secondary" onClick={handleReset}>
                  다른 파일 업로드
                </Button>
                <Button onClick={handleStartGeneration} disabled={!canStartGeneration}>
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
                {generationStatus.pipelineJobId ? ` job ${generationStatus.pipelineJobId}` : ""}
                {generationStatus.status ? ` · ${generationStatus.status}` : ""}
              </p>
              <div className={styles.successActions}>
                <Button variant="secondary" onClick={handleReset}>
                  다른 파일 업로드
                </Button>
                {pipelineReviewPath && (
                  <Button onClick={() => navigate(pipelineReviewPath)}>검토 화면으로 이동</Button>
                )}
                <Button
                  variant={pipelineReviewPath ? "secondary" : "primary"}
                  onClick={() => navigate(domainPacksPath)}
                >
                  도메인팩 보기
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
