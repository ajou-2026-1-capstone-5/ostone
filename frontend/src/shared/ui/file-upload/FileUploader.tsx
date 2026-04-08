import React, { useState, useRef } from 'react';
import { CloudUploadIcon, FileTypeIcon, CircleCheckIcon } from 'lucide-react';
import styles from './file-uploader.module.css';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  acceptedTypes?: string;
  isUploading?: boolean;
  progress?: number;
  status?: 'idle' | 'uploading' | 'analyzing' | 'success';
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFileSelect,
  acceptedTypes = ".csv,.json",
  isUploading = false,
  progress = 0,
  status = 'idle'
}) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
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

  if (status === 'success') {
    return (
      <div className={`${styles.uploaderBox} ${styles.successBox}`}>
        <CircleCheckIcon size={48} className={styles.successIcon} />
        <h3 className={styles.title}>Upload Complete</h3>
        <p className={styles.mutedText}>Log data has been successfully processed.</p>
      </div>
    );
  }

  if (isUploading || status === 'uploading' || status === 'analyzing') {
    return (
      <div className={styles.uploaderBox}>
        <div className={styles.loaderArea}>
          <div className={styles.spinner} />
          <h3 className={`${styles.statusText} ${styles.title}`}>
            {status === 'analyzing' ? 'Analyzing CSV Log...' : 'Uploading File...'}
          </h3>
          <div className={styles.progressBarContainer}>
            <div
              className={styles.progressBar}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className={styles.progressText}>{Math.round(progress)}%</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.uploaderBox} ${isDragActive ? styles.dragActive : ''}`}
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
        <CloudUploadIcon size={40} className={styles.uploadIcon} />
      </div>
      <h3 className={styles.title}>Click or drag file to this area to upload</h3>
      <p className={styles.mutedText}>Support for a single {acceptedTypes} file upload.</p>

      <div className={styles.fileTypesHint}>
        <span className={styles.badge}><FileTypeIcon size={14} /> CSV</span>
        <span className={styles.badge}><FileTypeIcon size={14} /> JSON</span>
      </div>
    </div>
  );
};