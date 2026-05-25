import { describe, expect, it } from "vitest";

import { MOCK_FIXTURE_META, tryMockResponse } from "./workflowFixtures";

describe("workflowFixtures.tryMockResponse", () => {
  it("GET 외 method는 null", () => {
    expect(tryMockResponse("/workspaces/1/domain-packs/1/versions/1/workflows", "POST")).toBeNull();
  });

  it("listIntents 응답", () => {
    const res = tryMockResponse<unknown[]>(
      "/workspaces/1/domain-packs/1/versions/1/intents",
      "GET",
    );
    expect(Array.isArray(res)).toBe(true);
    expect(res!.length).toBeGreaterThan(0);
  });

  it("getIntent 매칭", () => {
    const first = MOCK_FIXTURE_META.intents[0];
    const res = tryMockResponse<{ id: number }>(
      `/workspaces/1/domain-packs/1/versions/1/intents/${first.id}`,
      "GET",
    );
    expect(res?.id).toBe(first.id);
  });

  it("listWorkflows without filter → 전체", () => {
    const res = tryMockResponse<unknown[]>(
      "/workspaces/1/domain-packs/1/versions/1/workflows",
      "GET",
    );
    expect(res!.length).toBe(MOCK_FIXTURE_META.workflows.length);
  });

  it("listWorkflows with intentDefinitionId 필터", () => {
    const refundIntent = MOCK_FIXTURE_META.intents.find((i) => i.intentCode === "refund.request")!;
    const res = tryMockResponse<Array<{ intentDefinitionId: number }>>(
      `/workspaces/1/domain-packs/1/versions/1/workflows?intentDefinitionId=${refundIntent.id}`,
      "GET",
    );
    expect(res!.length).toBeGreaterThan(0);
    expect(res!.every((w) => w.intentDefinitionId === refundIntent.id)).toBe(true);
  });

  it("getWorkflow 매칭", () => {
    const first = MOCK_FIXTURE_META.workflows[0];
    const res = tryMockResponse<{ id: number }>(
      `/workspaces/1/domain-packs/1/versions/1/workflows/${first.id}`,
      "GET",
    );
    expect(res?.id).toBe(first.id);
  });

  it("미존재 경로는 null", () => {
    expect(tryMockResponse("/something/else", "GET")).toBeNull();
  });

  it("미존재 intent id는 null", () => {
    expect(
      tryMockResponse("/workspaces/1/domain-packs/1/versions/1/intents/999999", "GET"),
    ).toBeNull();
  });

  it("listWorkspaces 응답", () => {
    const res = tryMockResponse<unknown[]>("/workspaces", "GET");
    expect(Array.isArray(res)).toBe(true);
    expect(res!.length).toBeGreaterThan(0);
  });

  it("listDomainPacks 응답", () => {
    const res = tryMockResponse<unknown[]>("/workspaces/1/domain-packs", "GET");
    expect(Array.isArray(res)).toBe(true);
    expect(res!.length).toBe(1);
  });

  it("getDomainPack 응답", () => {
    const res = tryMockResponse<{ name: string; versions: unknown[] }>(
      "/workspaces/1/domain-packs/1",
      "GET",
    );
    expect(res?.name).toBe("Demo Pack");
    expect(res?.versions?.length).toBe(1);
  });

  it("getVersion 응답", () => {
    const res = tryMockResponse<{ versionId: number; lifecycleStatus: string }>(
      "/workspaces/1/domain-packs/1/versions/1",
      "GET",
    );
    expect(res?.versionId).toBe(1);
    expect(res?.lifecycleStatus).toBe("DRAFT");
  });

  it("미존재 workflow id는 null", () => {
    expect(
      tryMockResponse("/workspaces/1/domain-packs/1/versions/1/workflows/999999", "GET"),
    ).toBeNull();
  });
});
