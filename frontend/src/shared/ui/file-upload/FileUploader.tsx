import React, { useState, useRef } from "react";
import { UploadCloud, FileType, CheckCircle2 } from "lucide-react";
import styles from "./file-uploader.module.css";

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  acceptedTypes?: string;
  isUploading?: boolean;
  progress?: number;
  status?: "idle" | "uploading" | "analyzing" | "success";
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFileSelect,
  acceptedTypes = ".csv,.json",
  isUploading = false,
  progress = 0,
  status = "idle",
}) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  if (status === "success") {
    return (
      <div className={`${styles.uploaderBox} ${styles.successBox}`}>
        <CheckCircle2 size={48} className={styles.successIcon} />
        <h3 className={styles.title}>업로드 완료</h3>
        <p className={styles.mutedText}>상담 로그 처리가 완료되었습니다.</p>
      </div>
    );
  }

  if (isUploading || status === "uploading" || status === "analyzing") {
    return (
      <div className={styles.uploaderBox}>
        <div className={styles.loaderArea}>
          <div className={styles.spinner} />
          <h3 className={`${styles.statusText} ${styles.title}`}>
            {status === "analyzing" ? "상담 로그 분석 중..." : "파일 업로드 중..."}
          </h3>
          <div className={styles.progressBarContainer}>
            <div className={styles.progressBar} style={{ width: `${progress}%` }} />
          </div>
          <span className={styles.progressText}>{Math.round(progress)}%</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.uploaderBox} ${isDragActive ? styles.dragActive : ""}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        className={styles.hiddenInput}
        accept={acceptedTypes}
        onChange={handleChange}
      />
      <div className={styles.iconWrapper}>
        <UploadCloud size={40} className={styles.uploadIcon} />
      </div>
      <h3 className={styles.title}>파일을 클릭하거나 끌어다 놓으세요</h3>
      <p className={styles.mutedText}>{acceptedTypes} 파일 1개를 업로드할 수 있습니다.</p>

      <div className={styles.fileTypesHint}>
        <span className={styles.badge}>
          <FileType size={14} /> CSV
        </span>
        <span className={styles.badge}>
          <FileType size={14} /> JSON
        </span>
      </div>
    </div>
  );
};
