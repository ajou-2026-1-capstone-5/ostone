import { describe, expect, it } from "vitest";
import * as labels from "./ctaLabels";

describe("ctaLabels", () => {
  it("provides one canonical label per next-action destination", () => {
    expect(labels.CTA_GO_REVIEW).toBe("검토 화면으로 이동");
    expect(labels.CTA_GO_DOMAIN_PACK).toBe("도메인팩 관리로 이동");
    expect(labels.CTA_UPLOAD_LOGS).toBe("상담 로그 업로드");
    expect(labels.CTA_UPLOAD_AGAIN).toBe("다른 파일 업로드");
    expect(labels.CTA_RETRY_FROM_UPLOAD).toBe("업로드 다시 시작");
  });

  it("drops the legacy domain-pack vocabulary that mismatched the destination", () => {
    const values = Object.values(labels);
    expect(values).not.toContain("도메인팩 보기");
    expect(values).not.toContain("도메인팩 목록 보기");
  });
});
