// @vitest-environment node

import { describe, expect, it } from "vitest";
import type { DomainPackVersionSummary } from "@/entities/domain-pack";
import { classifyExistingDraftSource, resolveSingleExistingDraft } from "./existingDraftTarget";

function version(overrides: Partial<DomainPackVersionSummary>): DomainPackVersionSummary {
  return {
    versionId: 1,
    versionNo: 1,
    lifecycleStatus: "PUBLISHED",
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("resolveSingleExistingDraft", () => {
  it("DRAFT가 정확히 하나면 이동 대상 versionId를 반환한다", () => {
    expect(
      resolveSingleExistingDraft([
        version({ versionId: 10, lifecycleStatus: "PUBLISHED" }),
        version({ versionId: 11, lifecycleStatus: "DRAFT" }),
      ]),
    ).toEqual({ status: "ready", versionId: 11 });
  });

  it("DRAFT가 없거나 복수면 invalid를 반환한다", () => {
    expect(resolveSingleExistingDraft([version({ lifecycleStatus: "PUBLISHED" })])).toEqual({
      status: "invalid",
    });
    expect(
      resolveSingleExistingDraft([
        version({ versionId: 11, lifecycleStatus: "DRAFT" }),
        version({ versionId: 12, lifecycleStatus: "DRAFT" }),
      ]),
    ).toEqual({ status: "invalid" });
  });
});

describe("classifyExistingDraftSource", () => {
  it("INTENT_REVISION draftSource를 분류한다", () => {
    expect(
      classifyExistingDraftSource(
        JSON.stringify({ draftSource: { type: "INTENT_REVISION", baseVersionId: 10 } }),
      ),
    ).toBe("INTENT_REVISION");
  });

  it("파싱 불가 또는 일반 DRAFT는 GENERAL_DRAFT로 분류한다", () => {
    expect(classifyExistingDraftSource("{bad json}")).toBe("GENERAL_DRAFT");
    expect(
      classifyExistingDraftSource(
        JSON.stringify({ draftSource: { type: "RESTORE", baseVersionId: 10 } }),
      ),
    ).toBe("GENERAL_DRAFT");
  });
});
