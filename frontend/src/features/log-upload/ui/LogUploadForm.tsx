import React, { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

import { FileUploader } from "../../../shared/ui/file-upload/FileUploader";
import { Button } from "../../../shared/ui/button/Button";
import { useUploadRawFile } from "../../../shared/api/generated/endpoints/dataset-controller/dataset-controller";

import styles from "./log-upload-form.module.css";

type UploadStatus = "idle" | "uploading" | "success";

interface LogUploadFormProps {
  workspaceId?: number;
}

export const LogUploadForm: React.FC<LogUploadFormProps> = ({ workspaceId }) => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");

  const uploadMutation = useUploadRawFile({
    mutation: {
      onSuccess: () => {
        setStatus("success");
        toast.success("업로드 완료");
      },
      onError: (error) => {
        setStatus("idle");
        toast.error(error instanceof Error ? error.message : "업로드에 실패했습니다.", {
          action: {
            label: "재시도",
            onClick: () => {
              if (file) handleUpload(file);
            },
          },
        });
      },
    },
  });

  const handleFileSelect = (selectedFile: File) => {
    const name = selectedFile.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".json")) {
      toast.error("CSV 또는 JSON 파일만 업로드할 수 있습니다.");
      return;
    }
    setFile(selectedFile);
    setStatus("idle");
  };

  const handleUpload = (fileToUpload: File) => {
    if (!workspaceId) return;
    setStatus("uploading");
    uploadMutation.mutate({
      workspaceId,
      params: {
        datasetKey: crypto.randomUUID(),
        name: fileToUpload.name,
        sourceType: "RAW",
      },
      data: { file: fileToUpload },
    });
  };

  const handleReset = () => {
    uploadMutation.reset();
    setFile(null);
    setStatus("idle");
  };

  const domainPacksPath = workspaceId ? `/workspaces/${workspaceId}/domain-packs` : "/workspaces";

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Upload Consult Logs</h2>
        <p>Drop your customer service log file to automatically generate a workflow.</p>
      </div>

      <div className={styles.uploadArea}>
        <FileUploader
          onFileSelect={handleFileSelect}
          acceptedTypes=".csv,.json"
          status={status}
          progress={0}
          isUploading={uploadMutation.isPending}
        />
      </div>

      {status === "idle" && file && (
        <div className={styles.filePreview}>
          <div className={styles.fileInfo}>
            <span className={styles.fileName}>{file.name}</span>
            <span className={styles.fileSize}>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
          </div>
          <Button onClick={() => handleUpload(file)}>Start Processing</Button>
        </div>
      )}

      {status === "success" && (
        <div className={styles.successActions}>
          <Button variant="secondary" onClick={handleReset}>
            Upload Another File
          </Button>
          <Button onClick={() => navigate(domainPacksPath)}>도메인팩 보기</Button>
        </div>
      )}
    </div>
  );
};
