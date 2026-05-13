// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { DomainPackVersionDetail, DomainPackVersionSummary } from "@/entities/domain-pack";
import type { IntentDefinitionSummary } from "@/shared/api/generated/zod";
import { buildDomainPackApprovalReadiness } from "./buildDomainPackApprovalReadiness";

const latestDraftVersion: DomainPackVersionDetail = {
  versionId: 3,
  versionNo: 3,
  lifecycleStatus: "DRAFT",
};

const versions: DomainPackVersionSummary[] = [
  { versionId: 1, versionNo: 1, lifecycleStatus: "PUBLISHED" },
  { versionId: 3, versionNo: 3, lifecycleStatus: "DRAFT" },
];

function intent(status: string | undefined): IntentDefinitionSummary {
  return { id: 1, status };
}

describe("buildDomainPackApprovalReadiness", () => {
  it("PUBLISHED 버전이면 승인 불가 blocker를 반환한다", () => {
    const result = buildDomainPackApprovalReadiness({
      version: { ...latestDraftVersion, lifecycleStatus: "PUBLISHED" },
      versions,
      intents: [],
    });

    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual([
      {
        type: "VERSION",
        message: "DRAFT 상태의 버전만 승인할 수 있습니다.",
      },
    ]);
  });

  it("선택 버전이 pack 내 최대 versionNo가 아니면 승인 불가 blocker를 반환한다", () => {
    const result = buildDomainPackApprovalReadiness({
      version: { ...latestDraftVersion, versionNo: 1 },
      versions,
      intents: [],
    });

    expect(result.ready).toBe(false);
    expect(result.blockers[0]).toMatchObject({
      type: "VERSION",
      message: "최신 버전만 승인할 수 있습니다.",
    });
  });

  it("DRAFT Intent가 남으면 count와 actionPath가 포함된 blocker를 반환한다", () => {
    const result = buildDomainPackApprovalReadiness({
      version: latestDraftVersion,
      versions,
      intents: [intent("DRAFT"), intent("PUBLISHED"), intent("DRAFT")],
      intentActionPath: "/intents",
    });

    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual([
      {
        type: "INTENT",
        count: 2,
        message: "승인 또는 반려되지 않은 Intent가 2개 남아 있습니다.",
        actionPath: "/intents",
      },
    ]);
  });

  it("pack 내 최대 versionNo인 DRAFT이고 DRAFT Intent가 없으면 ready를 반환한다", () => {
    const result = buildDomainPackApprovalReadiness({
      version: latestDraftVersion,
      versions,
      intents: [intent("PUBLISHED"), intent("REJECTED")],
    });

    expect(result.ready).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it("version 필수 필드가 누락되면 SERVER blocker를 반환한다", () => {
    const result = buildDomainPackApprovalReadiness({
      version: { versionId: 3, lifecycleStatus: "DRAFT" },
      versions,
      intents: [],
    });

    expect(result.ready).toBe(false);
    expect(result.blockers[0]).toMatchObject({
      type: "SERVER",
      message: "승인 준비 상태를 확인하는 데 필요한 정보가 부족합니다.",
    });
  });

  it("intent status가 누락되면 SERVER blocker를 반환한다", () => {
    const result = buildDomainPackApprovalReadiness({
      version: latestDraftVersion,
      versions,
      intents: [intent(undefined)],
    });

    expect(result.ready).toBe(false);
    expect(result.blockers[0]).toMatchObject({
      type: "SERVER",
      message: "승인 준비 상태를 확인하는 데 필요한 정보가 부족합니다.",
    });
  });
});
