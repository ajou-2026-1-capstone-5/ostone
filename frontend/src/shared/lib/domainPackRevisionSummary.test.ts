import { describe, expect, it } from "vitest";
import { buildDomainPackRevisionSummary } from "./domainPackRevisionSummary";

const baseGraph = JSON.stringify({
  direction: "LR",
  nodes: [
    { id: "start", type: "START", label: "접수" },
    { id: "answer", type: "ANSWER", label: "안내" },
  ],
  edges: [{ id: "e1", from: "start", to: "answer", label: "다음" }],
});

describe("buildDomainPackRevisionSummary", () => {
  it("workflow 이름과 설명 변경을 구성 변경으로 계산한다", () => {
    const summary = buildDomainPackRevisionSummary({
      baseIntents: [],
      draftIntents: [],
      baseWorkflows: [
        {
          id: 1,
          workflowCode: "refund-flow",
          name: "환불 흐름",
          description: "기존 설명",
          graphJson: baseGraph,
        },
      ],
      draftWorkflows: [
        {
          id: 2,
          workflowCode: "refund-flow",
          name: "환불 검토 흐름",
          description: "새 설명",
          graphJson: baseGraph,
        },
      ],
    });

    expect(summary.changedWorkflows).toHaveLength(1);
    expect(summary.changedWorkflows[0]).toMatchObject({
      workflowId: 2,
      workflowCode: "refund-flow",
      fields: ["name", "description"],
      before: { name: "환불 흐름", description: "기존 설명", nodeCount: 2, edgeCount: 1 },
      after: { name: "환불 검토 흐름", description: "새 설명", nodeCount: 2, edgeCount: 1 },
    });
    expect(summary.changedWorkflowFieldCounts).toMatchObject({
      name: 1,
      description: 1,
      graphText: 0,
      graphStructure: 0,
    });
    expect(summary.totalChangedComponents).toBe(1);
  });

  it("workflow 그래프 텍스트와 구조 변경을 분리해서 계산한다", () => {
    const textOnlyGraph = JSON.stringify({
      direction: "LR",
      nodes: [
        { id: "start", type: "START", label: "상담 접수" },
        { id: "answer", type: "ANSWER", label: "안내" },
      ],
      edges: [{ id: "e1", from: "start", to: "answer", label: "진행" }],
    });
    const structuralGraph = JSON.stringify({
      direction: "LR",
      nodes: [
        { id: "start", type: "START", label: "접수" },
        { id: "answer", type: "ANSWER", label: "안내" },
        { id: "handoff", type: "HANDOFF", label: "이관" },
      ],
      edges: [
        { id: "e1", from: "start", to: "answer", label: "다음" },
        { id: "e2", from: "answer", to: "handoff", label: "이관" },
      ],
    });

    const textSummary = buildDomainPackRevisionSummary({
      baseIntents: [],
      draftIntents: [],
      baseWorkflows: [{ id: 1, workflowCode: "refund-flow", graphJson: baseGraph }],
      draftWorkflows: [{ id: 2, workflowCode: "refund-flow", graphJson: textOnlyGraph }],
    });
    const structureSummary = buildDomainPackRevisionSummary({
      baseIntents: [],
      draftIntents: [],
      baseWorkflows: [{ id: 1, workflowCode: "refund-flow", graphJson: baseGraph }],
      draftWorkflows: [{ id: 2, workflowCode: "refund-flow", graphJson: structuralGraph }],
    });

    expect(textSummary.changedWorkflows[0]?.fields).toEqual(["graphText"]);
    expect(structureSummary.changedWorkflows[0]?.fields).toEqual([
      "graphText",
      "graphStructure",
    ]);
    expect(structureSummary.changedWorkflows[0]?.after).toMatchObject({
      nodeCount: 3,
      edgeCount: 2,
    });
  });

  it("그래프 JSON key 순서만 다른 workflow는 변경으로 계산하지 않는다", () => {
    const summary = buildDomainPackRevisionSummary({
      baseIntents: [],
      draftIntents: [],
      baseWorkflows: [
        {
          id: 1,
          workflowCode: "refund-flow",
          graphJson: JSON.stringify({
            nodes: [{ id: "start", type: "START", label: "접수" }],
            edges: [],
          }),
        },
      ],
      draftWorkflows: [
        {
          id: 2,
          workflowCode: "refund-flow",
          graphJson: JSON.stringify({
            edges: [],
            nodes: [{ label: "접수", type: "START", id: "start" }],
          }),
        },
      ],
    });

    expect(summary.changedWorkflows).toHaveLength(0);
    expect(summary.totalChangedComponents).toBe(0);
  });

  it("파싱할 수 없는 workflow graph도 원문 차이를 변경으로 계산한다", () => {
    const summary = buildDomainPackRevisionSummary({
      baseIntents: [],
      draftIntents: [],
      baseWorkflows: [{ id: 1, workflowCode: "refund-flow", graphJson: "old graph" }],
      draftWorkflows: [{ id: 2, workflowCode: "refund-flow", graphJson: "new graph" }],
    });

    expect(summary.changedWorkflows[0]).toMatchObject({
      workflowId: 2,
      workflowCode: "refund-flow",
      fields: ["graphText", "graphStructure"],
      before: { nodeCount: null, edgeCount: null },
      after: { nodeCount: null, edgeCount: null },
    });
  });
});
