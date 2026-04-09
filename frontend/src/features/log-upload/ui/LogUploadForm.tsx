import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUploader } from '../../../shared/ui/file-upload/FileUploader';
import { Button } from '../../../shared/ui/button/Button';
import styles from './log-upload-form.module.css';

type UploadStatus = 'idle' | 'uploading' | 'analyzing' | 'success';

export const LogUploadForm: React.FC = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const uploadIntervalRef = useRef<number | null>(null);
  const analyzeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (uploadIntervalRef.current) {
        clearInterval(uploadIntervalRef.current);
      }
      if (analyzeTimeoutRef.current) {
        clearTimeout(analyzeTimeoutRef.current);
      }
    };
  }, []);

  const handleFileSelect = (selectedFile: File) => {
    // Only accept csv or json roughly
    const name = selectedFile.name.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.json')) {
      alert('Please upload a .csv or .json file.');
      return;
    }
    setFile(selectedFile);
    setStatus('idle');
    setProgress(0);
  };

  const handleUpload = () => {
    if (!file) return;
    setStatus('uploading');

    // Simulate Fake Upload Progress
    let currentProgress = 0;
    uploadIntervalRef.current = window.setInterval(() => {
      currentProgress += Math.random() * 15;
      if (currentProgress >= 100) {
        if (uploadIntervalRef.current) {
          clearInterval(uploadIntervalRef.current);
          uploadIntervalRef.current = null;
        }
        setProgress(100);
        setStatus('analyzing');

        // Simulate analyzing delay
        analyzeTimeoutRef.current = window.setTimeout(() => {
          setStatus('success');
          analyzeTimeoutRef.current = null;
        }, 2000);
      } else {
        setProgress(currentProgress);
      }
    }, 400); // Progress updates every 400ms
  };

  const handleReset = () => {
    if (uploadIntervalRef.current) {
      clearInterval(uploadIntervalRef.current);
      uploadIntervalRef.current = null;
    }
    if (analyzeTimeoutRef.current) {
      clearTimeout(analyzeTimeoutRef.current);
      analyzeTimeoutRef.current = null;
    }
    setFile(null);
    setStatus('idle');
    setProgress(0);
  };

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
          progress={progress}
          isUploading={status === 'uploading' || status === 'analyzing'}
        />
      </div>

      {status === 'idle' && file && (
        <div className={styles.filePreview}>
          <div className={styles.fileInfo}>
            <span className={styles.fileName}>{file.name}</span>
            <span className={styles.fileSize}>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
          </div>
          <Button onClick={handleUpload}>Start Processing</Button>
        </div>
      )}

      {status === 'success' && (
        <div className={styles.successActions}>
          <Button variant="secondary" onClick={handleReset}>Upload Another File</Button>
          <Button onClick={() => navigate('/workflows')}>View Extracted Workflow</Button>
        </div>
      )}
    </div>
  );
};