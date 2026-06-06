import { describe, expect, it } from "vitest";
import type { DomainPackVersionDetail, DomainPackVersionSummary } from "@/entities/domain-pack";
import { buildVersionSafetyState } from "./buildVersionSafetyState";

function detail(overrides: Partial<DomainPackVersionDetail> = {}): DomainPackVersionDetail {
  return {
    versionId: 5,
    versionNo: 5,
    lifecycleStatus: "DRAFT",
    intentCount: 12,
    slotCount: 8,
    policyCount: 5,
    riskCount: 3,
    workflowCount: 6,
    description: "교환 절차 보강",
    createdAt: "2026-06-05T18:40:00Z",
    ...overrides,
  } as DomainPackVersionDetail;
}

function summary(overrides: Partial<DomainPackVersionSummary>): DomainPackVersionSummary {
  return {
    versionId: 0,
    versionNo: 0,
    lifecycleStatus: "PUBLISHED",
    ...overrides,
  } as DomainPackVersionSummary;
}

const versions: DomainPackVersionSummary[] = [
  summary({ versionId: 4, versionNo: 4, lifecycleStatus: "PUBLISHED" }),
  summary({ versionId: 5, versionNo: 5, lifecycleStatus: "DRAFT" }),
];

describe("buildVersionSafetyState", () => {
  it("marks the current published version as operating and not deployable", () => {
    const state = buildVersionSafetyState({
      version: detail({ versionId: 4, versionNo: 4, lifecycleStatus: "PUBLISHED" }),
      versions,
      currentVersionId: 4,
      currentVersionNo: 4,
    });
    expect(state.isCurrent).toBe(true);
    expect(state.tone).toBe("operating");
    expect(state.lifecycleLabel).toBe("운영 가능");
    expect(state.countsLabel).toBe("운영 구성요소");
    expect(state.transitionLabel).toBe("현재 v4 · 운영 중");
    expect(state.reason).toContain("다시 배포할 수 없습니다");
  });

  it("describes a latest draft as review with a transition to the target", () => {
    const state = buildVersionSafetyState({
      version: detail({ versionId: 5, versionNo: 5, lifecycleStatus: "DRAFT" }),
      versions,
      currentVersionId: 4,
      currentVersionNo: 4,
    });
    expect(state.isDraft).toBe(true);
    expect(state.tone).toBe("review");
    expect(state.transitionLabel).toBe("현재 v4 → 대상 v5");
    expect(state.reason).toContain("적용하면");
  });

  it("blocks a non-latest draft", () => {
    const threeVersions = [
      ...versions,
      summary({ versionId: 6, versionNo: 6, lifecycleStatus: "DRAFT" }),
    ];
    const state = buildVersionSafetyState({
      version: detail({ versionId: 5, versionNo: 5, lifecycleStatus: "DRAFT" }),
      versions: threeVersions,
      currentVersionId: 4,
      currentVersionNo: 4,
    });
    expect(state.tone).toBe("blocked");
    expect(state.reason).toContain("최신 검토본만");
  });

  it("treats a non-current published version as a deployable previous version", () => {
    const state = buildVersionSafetyState({
      version: detail({ versionId: 3, versionNo: 3, lifecycleStatus: "PUBLISHED" }),
      versions,
      currentVersionId: 4,
      currentVersionNo: 4,
    });
    expect(state.tone).toBe("previous");
    expect(state.reason).toContain("다시 배포하면");
    expect(state.transitionLabel).toBe("현재 v4 → 대상 v3");
  });

  it("prioritizes in-progress deploy/apply reasons", () => {
    const deploying = buildVersionSafetyState({
      version: detail({ versionId: 3, versionNo: 3, lifecycleStatus: "PUBLISHED" }),
      versions,
      currentVersionId: 4,
      deployingVersionId: 3,
    });
    expect(deploying.tone).toBe("review");
    expect(deploying.reason).toContain("배포를 진행");

    const applying = buildVersionSafetyState({
      version: detail({ versionId: 5, versionNo: 5, lifecycleStatus: "DRAFT" }),
      versions,
      currentVersionId: 4,
      applyingVersionId: 5,
    });
    expect(applying.reason).toContain("적용하고 있습니다");
  });

  it("passes component counts through and defaults missing counts to zero", () => {
    const state = buildVersionSafetyState({
      version: detail({
        intentCount: 2,
        slotCount: undefined as never,
        policyCount: null as never,
        riskCount: 1,
        workflowCount: 4,
      }),
      versions,
      currentVersionId: 4,
    });
    expect(state.counts).toEqual({ intent: 2, slot: 0, policy: 0, risk: 1, workflow: 4 });
  });

  it("normalizes a blank change description to null", () => {
    const state = buildVersionSafetyState({
      version: detail({ description: "   " }),
      versions,
      currentVersionId: 4,
    });
    expect(state.changeDescription).toBeNull();
  });
});
