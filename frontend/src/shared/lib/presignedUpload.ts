export class PresignedUploadError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = "PresignedUploadError";
    this.status = status;
  }
}

export class PresignedUploadAbortError extends Error {
  constructor() {
    super("업로드가 취소되었습니다.");
    this.name = "PresignedUploadAbortError";
  }
}

interface PutPresignedFileParams {
  readonly uploadUrl: string;
  readonly file: File;
  readonly contentType: string;
  readonly serverSideEncryptionRequired: boolean;
  readonly onProgress?: (percent: number) => void;
  readonly signal?: AbortSignal;
}

/**
 * S3 presigned PUT은 서명에 포함된 헤더만 허용하므로 Authorization 등 추가 헤더를
 * 절대 붙이지 않는다. fetch는 업로드 진행률을 노출하지 않아 XHR을 사용한다.
 */
export function putPresignedFile({
  uploadUrl,
  file,
  contentType,
  serverSideEncryptionRequired,
  onProgress,
  signal,
}: PutPresignedFileParams): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new PresignedUploadAbortError());
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", contentType);
    if (serverSideEncryptionRequired) {
      xhr.setRequestHeader("x-amz-server-side-encryption", "AES256");
    }

    const handleAbort = () => xhr.abort();
    if (signal) {
      signal.addEventListener("abort", handleAbort);
    }
    const cleanup = () => {
      if (signal) {
        signal.removeEventListener("abort", handleAbort);
      }
    };

    if (onProgress) {
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      });
    }

    xhr.addEventListener("load", () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new PresignedUploadError("파일 업로드에 실패했습니다.", xhr.status));
      }
    });

    xhr.addEventListener("error", () => {
      cleanup();
      reject(new PresignedUploadError("파일 업로드 중 네트워크 오류가 발생했습니다.", null));
    });

    xhr.addEventListener("abort", () => {
      cleanup();
      reject(new PresignedUploadAbortError());
    });

    xhr.send(file);
  });
}
