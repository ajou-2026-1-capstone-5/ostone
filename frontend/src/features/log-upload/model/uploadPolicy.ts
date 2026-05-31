export const RAW_LOG_UPLOAD_MAX_SIZE_BYTES = 50 * 1024 * 1024;
export const RAW_LOG_UPLOAD_ACCEPT = ".json,application/json";
export const RAW_LOG_UPLOAD_FILE_TYPE_LABELS = ["JSON"];

export function validateRawLogUploadFile(file: File): string | null {
  const name = file.name.toLowerCase();

  if (!name.endsWith(".json")) {
    return "JSON 파일만 업로드할 수 있습니다.";
  }

  if (file.size > RAW_LOG_UPLOAD_MAX_SIZE_BYTES) {
    return "파일 크기는 50MB 이하여야 합니다.";
  }

  return null;
}
