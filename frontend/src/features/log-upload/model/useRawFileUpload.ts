import { useCallback, useRef, useState } from "react";

import {
  PresignedUploadAbortError,
  putPresignedFile,
} from "@/shared/lib/presignedUpload";

import {
  completeRawFileUpload,
  initRawFileUpload,
  type CompleteRawFileUploadResponse,
} from "../api/rawFileUpload";

// 백엔드 init은 contentType을 ZIP MIME 화이트리스트로 검증한다. 브라우저가 보고하는 file.type은
// application/octet-stream 등 비-ZIP 값일 수 있으므로, 허용된 ZIP MIME만 그대로 사용하고 그 외에는 보정한다.
const ZIP_CONTENT_TYPE = "application/zip";
const ALLOWED_ZIP_CONTENT_TYPES = new Set([
  "application/zip",
  "application/x-zip-compressed",
]);

const resolveZipContentType = (fileType: string): string =>
  ALLOWED_ZIP_CONTENT_TYPES.has(fileType) ? fileType : ZIP_CONTENT_TYPE;

type UploadPhase = "init" | "transfer" | "complete";

const PHASE_ERROR_FALLBACK: Record<UploadPhase, string> = {
  init: "업로드 준비에 실패했습니다.",
  transfer: "파일 업로드에 실패했습니다.",
  complete: "업로드 완료 처리에 실패했습니다.",
};

interface RawFileUploadState {
  readonly isUploading: boolean;
  readonly progress: number;
}

interface StartUploadParams {
  readonly workspaceId: number;
  readonly file: File;
  readonly onSuccess: (result: CompleteRawFileUploadResponse) => void;
  readonly onError: (message: string) => void;
}

const getPhaseErrorMessage = (error: unknown, phase: UploadPhase): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return PHASE_ERROR_FALLBACK[phase];
};

export function useRawFileUpload() {
  const [state, setState] = useState<RawFileUploadState>({ isUploading: false, progress: 0 });
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const start = useCallback(
    async ({ workspaceId, file, onSuccess, onError }: StartUploadParams) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ isUploading: true, progress: 0 });

      let phase: UploadPhase = "init";
      try {
        const contentType = resolveZipContentType(file.type);
        const initResult = await initRawFileUpload(workspaceId, {
          datasetKey: crypto.randomUUID(),
          name: file.name,
          sourceType: "RAW",
          filename: file.name,
          contentType,
          sizeBytes: file.size,
        });

        phase = "transfer";
        await putPresignedFile({
          uploadUrl: initResult.uploadUrl,
          file,
          contentType: initResult.contentType,
          serverSideEncryptionRequired: initResult.serverSideEncryptionRequired,
          signal: controller.signal,
          onProgress: (progress) => setState({ isUploading: true, progress }),
        });

        phase = "complete";
        const completeResult = await completeRawFileUpload(workspaceId, initResult.datasetId);

        setState({ isUploading: false, progress: 100 });
        onSuccess(completeResult);
      } catch (error) {
        setState({ isUploading: false, progress: 0 });
        if (error instanceof PresignedUploadAbortError) {
          return;
        }
        onError(getPhaseErrorMessage(error, phase));
      } finally {
        abortRef.current = null;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState({ isUploading: false, progress: 0 });
  }, []);

  return {
    isUploading: state.isUploading,
    progress: state.progress,
    start,
    cancel,
    reset,
  };
}
