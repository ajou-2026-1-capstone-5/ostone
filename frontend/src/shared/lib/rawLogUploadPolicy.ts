export const RAW_LOG_UPLOAD_MAX_SIZE_BYTES = 4 * 1024 * 1024 * 1024;
export const RAW_LOG_UPLOAD_MAX_SIZE_LABEL = "4GB";
export const RAW_LOG_UPLOAD_ACCEPT = ".zip,application/zip,application/x-zip-compressed";
export const RAW_LOG_UPLOAD_ACCEPTED_TYPE_LABEL = "ZIP";
export const RAW_LOG_UPLOAD_FILE_TYPE_LABELS = ["ZIP"];

export function validateRawLogUploadFile(file: File): string | null {
  const name = file.name.toLowerCase();

  if (!name.endsWith(".zip")) {
    return "ZIP 파일만 업로드할 수 있습니다.";
  }

  if (file.size > RAW_LOG_UPLOAD_MAX_SIZE_BYTES) {
    return `파일 크기는 ${RAW_LOG_UPLOAD_MAX_SIZE_LABEL} 이하여야 합니다.`;
  }

  return null;
}
