import { describe, expect, it } from "vitest";
import { buildIntentTree } from "./buildIntentTree";
import type { IntentSummary } from "../../../entities/intent";

const stub = (overrides: Partial<IntentSummary>): IntentSummary => ({
  id: 1,
  intentCode: "INTENT",
  name: "Intent",
  description: null,
  taxonomyLevel: 1,
  parentIntentId: null,
  status: "ACTIVE",
  sourceClusterRef: "{}",
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

describe("buildIntentTree", () => {
  it("parentIntentId 기준으로 부모-자식 트리를 구성한다", () => {
    const tree = buildIntentTree([
      stub({ id: 10, intentCode: "ROOT", name: "Root" }),
      stub({
        id: 20,
        intentCode: "CHILD",
        name: "Child",
        parentIntentId: 10,
        taxonomyLevel: 2,
      }),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe(10);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe(20);
  });

  it("부모가 없으면 루트로 유지한다", () => {
    const tree = buildIntentTree([
      stub({ id: 10, intentCode: "ROOT", name: "Root" }),
      stub({
        id: 20,
        intentCode: "ORPHAN",
        name: "Orphan",
        parentIntentId: 999,
        taxonomyLevel: 2,
      }),
    ]);

    expect(tree.map((node) => node.id)).toEqual([10, 20]);
  });

  it("입력 순서가 뒤섞여 있어도 트리를 연결한다", () => {
    const tree = buildIntentTree([
      stub({
        id: 20,
        intentCode: "CHILD",
        name: "Child",
        parentIntentId: 10,
        taxonomyLevel: 2,
      }),
      stub({ id: 10, intentCode: "ROOT", name: "Root" }),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe(10);
    expect(tree[0].children[0].id).toBe(20);
  });

  it("다단계 순환이 있으면 순환 링크를 끊고 루트로 유지한다", () => {
    const tree = buildIntentTree([
      stub({ id: 10, intentCode: "A", name: "A", parentIntentId: 20 }),
      stub({ id: 20, intentCode: "B", name: "B", parentIntentId: 10 }),
    ]);

    expect(tree.map((node) => node.id)).toEqual([10, 20]);
    expect(tree.every((node) => node.children.length === 0)).toBe(true);
  });

  it("중복 id는 첫 항목만 유지한다", () => {
    const tree = buildIntentTree([
      stub({ id: 10, intentCode: "FIRST", name: "First" }),
      stub({ id: 10, intentCode: "SECOND", name: "Second" }),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].intentCode).toBe("FIRST");
  });
});
