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
  it("exposes the JSON 50MB upload policy labels", () => {
    expect(RAW_LOG_UPLOAD_ACCEPT).toBe(".json,application/json");
    expect(RAW_LOG_UPLOAD_ACCEPTED_TYPE_LABEL).toBe("JSON");
    expect(RAW_LOG_UPLOAD_FILE_TYPE_LABELS).toEqual(["JSON"]);
    expect(RAW_LOG_UPLOAD_MAX_SIZE_LABEL).toBe("50MB");
    expect(RAW_LOG_UPLOAD_MAX_SIZE_BYTES).toBe(50 * 1024 * 1024);
  });

  it("accepts JSON files within the size limit", () => {
    const file = new File(["{}"], "logs.json", { type: "application/json" });

    expect(validateRawLogUploadFile(file)).toBeNull();
  });

  it("rejects non-JSON files", () => {
    const file = new File(["source_id"], "logs.csv", { type: "text/csv" });

    expect(validateRawLogUploadFile(file)).toBe("JSON 파일만 업로드할 수 있습니다.");
  });

  it("rejects JSON files larger than the size limit", () => {
    const file = new File(["{}"], "logs.json", { type: "application/json" });
    Object.defineProperty(file, "size", { value: RAW_LOG_UPLOAD_MAX_SIZE_BYTES + 1 });

    expect(validateRawLogUploadFile(file)).toBe(
      `파일 크기는 ${RAW_LOG_UPLOAD_MAX_SIZE_LABEL} 이하여야 합니다.`,
    );
  });
});
