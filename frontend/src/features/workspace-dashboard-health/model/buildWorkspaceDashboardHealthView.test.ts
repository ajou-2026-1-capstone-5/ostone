import { describe, expect, it } from "vitest";

import { buildWorkspaceDashboardHealthView } from "./buildWorkspaceDashboardHealthView";

describe("buildWorkspaceDashboardHealthView", () => {
  it("정상 운영 상태를 고객용 문구로 요약한다", () => {
    const view = buildWorkspaceDashboardHealthView(1, {
      activeKnowledgePack: {
        packId: 11,
        packName: "CS Pack",
        versionId: 12,
        versionNo: 4,
        publishedAt: "2026-06-03T10:00:00Z",
        createdAt: "2026-06-03T09:00:00Z",
        sourcePipelineJobId: 77,
      },
      lastLogUpload: {
        datasetId: 8,
        datasetKey: "june-log",
        datasetName: "6월 상담 로그",
        datasetStatus: "READY",
        uploadedAt: "2026-06-03T09:00:00Z",
      },
      lastKnowledgePackGeneration: {
        pipelineJobId: 77,
        datasetId: 8,
        domainPackId: 11,
        status: "SUCCEEDED",
        requestedAt: "2026-06-03T09:10:00Z",
        startedAt: "2026-06-03T09:11:00Z",
        finishedAt: "2026-06-03T09:30:00Z",
      },
      pendingReviewCount: 0,
    });

    expect(view.statusTitle).toBe("운영 지식팩이 정상적으로 유지되고 있습니다.");
    expect(view.alerts).toHaveLength(0);
    expect(view.ctas).toHaveLength(0);
    expect(view.metrics.find((metric) => metric.label === "운영 지식팩")?.value).toBe("v4");
  });

  it("검토 대기 중이면 pipeline review CTA만 제공한다", () => {
    const view = buildWorkspaceDashboardHealthView(1, {
      activeKnowledgePack: {
        packId: 11,
        packName: "CS Pack",
        versionId: 12,
        versionNo: 4,
        publishedAt: "2026-06-01T10:00:00Z",
        createdAt: "2026-06-01T09:00:00Z",
      },
      lastLogUpload: {
        datasetId: 8,
        datasetKey: "june-log",
        datasetName: "6월 상담 로그",
        datasetStatus: "READY",
        uploadedAt: "2026-06-03T09:00:00Z",
      },
      lastKnowledgePackGeneration: {
        pipelineJobId: 77,
        datasetId: 8,
        domainPackId: 11,
        status: "FAILED",
        requestedAt: "2026-06-03T09:10:00Z",
        startedAt: "2026-06-03T09:11:00Z",
        finishedAt: "2026-06-03T09:30:00Z",
      },
      pendingReviewCount: 2,
    });

    expect(view.alerts.map((alert) => alert.title)).toContain(
      "검토 대기 항목 2개가 남아 있습니다.",
    );
    expect(view.ctas).toEqual([
      {
        kind: "review",
        label: "검토 화면으로 이동",
        to: "/workspaces/1/pipeline-jobs/77/review",
      },
    ]);
  });

  it("새 업로드가 있으면 해당 데이터셋으로 지식팩 생성 시작 CTA를 만든다", () => {
    const view = buildWorkspaceDashboardHealthView(1, {
      activeKnowledgePack: {
        packId: 11,
        packName: "CS Pack",
        versionId: 12,
        versionNo: 4,
        publishedAt: "2026-06-01T10:00:00Z",
        createdAt: "2026-06-01T09:00:00Z",
      },
      lastLogUpload: {
        datasetId: 8,
        datasetKey: "june-log",
        datasetName: "6월 상담 로그",
        datasetStatus: "READY",
        uploadedAt: "2026-06-03T09:00:00Z",
      },
      lastKnowledgePackGeneration: {
        pipelineJobId: 77,
        datasetId: 7,
        domainPackId: 11,
        status: "SUCCEEDED",
        requestedAt: "2026-06-01T09:10:00Z",
        startedAt: "2026-06-01T09:11:00Z",
        finishedAt: "2026-06-01T09:30:00Z",
      },
      pendingReviewCount: 0,
    });

    expect(view.alerts.map((alert) => alert.title)).toContain(
      "새 상담 로그가 운영 지식팩에 아직 반영되지 않았습니다.",
    );
    expect(view.ctas).toEqual([
      {
        kind: "generate",
        label: "지식팩 생성 시작",
        to: "/workspaces/1/upload?datasetId=8",
      },
    ]);
  });

  it("생성 실패 상태이면 실패한 생성 데이터셋으로 재시도 CTA를 만든다", () => {
    const view = buildWorkspaceDashboardHealthView(1, {
      activeKnowledgePack: {
        packId: 11,
        packName: "CS Pack",
        versionId: 12,
        versionNo: 4,
        publishedAt: "2026-06-01T10:00:00Z",
        createdAt: "2026-06-01T09:00:00Z",
      },
      lastLogUpload: {
        datasetId: 8,
        datasetKey: "june-log",
        datasetName: "6월 상담 로그",
        datasetStatus: "READY",
        uploadedAt: "2026-06-03T09:00:00Z",
      },
      lastKnowledgePackGeneration: {
        pipelineJobId: 77,
        datasetId: 8,
        domainPackId: 11,
        status: "FAILED",
        requestedAt: "2026-06-03T09:10:00Z",
        startedAt: "2026-06-03T09:11:00Z",
        finishedAt: "2026-06-03T09:30:00Z",
      },
      pendingReviewCount: 0,
    });

    expect(view.alerts.map((alert) => alert.title)).toContain(
      "최근 지식팩 생성이 실패했습니다.",
    );
    expect(view.ctas).toEqual([
      {
        kind: "generate",
        label: "지식팩 생성 재시도",
        to: "/workspaces/1/upload?datasetId=8",
      },
    ]);
  });

  it("업로드는 있지만 생성 기록이 없으면 업로드 데이터셋으로 생성 시작 CTA를 만든다", () => {
    const view = buildWorkspaceDashboardHealthView(2, {
      activeKnowledgePack: null,
      lastLogUpload: {
        datasetId: 15,
        datasetKey: "first-log",
        datasetName: "첫 상담 로그",
        datasetStatus: "READY",
        uploadedAt: "2026-06-03T09:00:00Z",
      },
      lastKnowledgePackGeneration: null,
      pendingReviewCount: 0,
    });

    expect(view.ctas).toEqual([
      {
        kind: "generate",
        label: "지식팩 생성 시작",
        to: "/workspaces/2/upload?datasetId=15",
      },
    ]);
  });

  it("업로드와 운영 지식팩이 없으면 초기 행동을 제안한다", () => {
    const view = buildWorkspaceDashboardHealthView(3, {
      activeKnowledgePack: null,
      lastLogUpload: null,
      lastKnowledgePackGeneration: null,
      pendingReviewCount: 0,
    });

    expect(view.alerts.map((alert) => alert.title)).toEqual([
      "운영 지식팩이 아직 반영되지 않았습니다.",
      "상담 로그 업로드 기록이 없습니다.",
    ]);
    expect(view.ctas).toEqual([
      { kind: "upload", label: "상담 로그 업로드", to: "/workspaces/3/upload" },
    ]);
  });
});
