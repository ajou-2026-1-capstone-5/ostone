import { describe, expect, it } from "vitest";

import {
  RAW_LOG_UPLOAD_ACCEPT,
  RAW_LOG_UPLOAD_ACCEPTED_TYPE_LABEL,
  RAW_LOG_UPLOAD_FILE_TYPE_LABELS,
  RAW_LOG_UPLOAD_MAX_SIZE_BYTES,
  RAW_LOG_UPLOAD_MAX_SIZE_LABEL,
  validateRawLogUploadFile,
} from "./rawLogUploadPolicy";

describe("rawLogUploadPolicy", () => {
  it("exposes the ZIP 50MB upload policy labels", () => {
    expect(RAW_LOG_UPLOAD_ACCEPT).toBe(".zip,application/zip,application/x-zip-compressed");
    expect(RAW_LOG_UPLOAD_ACCEPTED_TYPE_LABEL).toBe("ZIP");
    expect(RAW_LOG_UPLOAD_FILE_TYPE_LABELS).toEqual(["ZIP"]);
    expect(RAW_LOG_UPLOAD_MAX_SIZE_LABEL).toBe("50MB");
    expect(RAW_LOG_UPLOAD_MAX_SIZE_BYTES).toBe(50 * 1024 * 1024);
  });

  it("accepts ZIP files within the size limit", () => {
    const file = new File(["PK"], "logs.zip", { type: "application/zip" });

    expect(validateRawLogUploadFile(file)).toBeNull();
  });

  it.each([
    ["logs.json", "application/json"],
    ["logs.csv", "text/csv"],
    ["logs.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ])("rejects non-ZIP file %s", (fileName, type) => {
    const file = new File(["source_id"], fileName, { type });

    expect(validateRawLogUploadFile(file)).toBe("ZIP 파일만 업로드할 수 있습니다.");
  });

  it("rejects ZIP files larger than the size limit", () => {
    const file = new File(["PK"], "logs.zip", { type: "application/zip" });
    Object.defineProperty(file, "size", { value: RAW_LOG_UPLOAD_MAX_SIZE_BYTES + 1 });

    expect(validateRawLogUploadFile(file)).toBe(
      `파일 크기는 ${RAW_LOG_UPLOAD_MAX_SIZE_LABEL} 이하여야 합니다.`,
    );
  });
});
