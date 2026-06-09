import { describe, expect, it } from "vitest";
import type {
  SimulationImprovementCandidate,
  SimulationPatchOperationView,
} from "@/features/simulation";
import {
  buildOperationDiff,
  buildStructuralPatchReview,
  evaluateApprovalGuardrail,
  isWorkflowStructureOperation,
  operationTypeLabel,
} from "./structuralPatchReview";

// ---- 목 팩토리 ----

function makeOp(overrides: Partial<SimulationPatchOperationView> = {}): SimulationPatchOperationView {
  return {
    operationType: "MARK_SLOT_REQUIRED",
    kind: "ELEMENT",
    targetCategory: null,
    targetCode: null,
    targetId: null,
    value: null,
    nodeId: null,
    nodeType: null,
    slotCode: null,
    prompt: null,
    from: null,
    to: null,
    condition: null,
    reason: null,
    targetComplete: true,
    ...overrides,
  };
}

function makeCandidate(
  overrides: Partial<SimulationImprovementCandidate> = {},
): SimulationImprovementCandidate {
  return {
    id: 1000,
    workspaceId: 1,
    domainPackVersionId: 101,
    feedbackId: 900,
    sessionId: 10,
    chatMessageId: null,
    candidateType: "SLOT_QUESTION",
    targetElementType: "SLOT",
    targetElementId: null,
    targetElementKey: null,
    beforeSummary: "before",
    afterSummary: "after",
    evidenceSummary: "evidence",
    reviewSessionId: null,
    reviewTaskId: null,
    appliedDomainPackVersionId: null,
    draftPatchJson: "{}",
    decisionReason: null,
    decidedBy: null,
    decidedAt: null,
    status: "DRAFT",
    createdBy: 7,
    createdAt: "2026-06-04T10:45:00Z",
    updatedAt: "2026-06-04T10:45:00Z",
    patchSchemaVersion: null,
    patchSummary: null,
    patchValidationStatus: "NONE",
    patchValidationErrors: [],
    operations: [],
    ...overrides,
  };
}

// ---- operationTypeLabel ----

describe("operationTypeLabel", () => {
  it("알려진 operationType에 대해 한국어 라벨을 반환한다", () => {
    expect(operationTypeLabel("MARK_SLOT_REQUIRED")).toBe("슬롯 필수화");
    expect(operationTypeLabel("ADD_WORKFLOW_NODE")).toBe("워크플로우 노드 추가");
    expect(operationTypeLabel("UPDATE_TRANSITION")).toBe("전이 수정");
  });

  it("알 수 없는 operationType은 원문을 그대로 반환한다", () => {
    expect(operationTypeLabel("FOO_BAR")).toBe("FOO_BAR");
    expect(operationTypeLabel("")).toBe("");
  });
});

// ---- isWorkflowStructureOperation ----

describe("isWorkflowStructureOperation", () => {
  it("WORKFLOW_NODE kind는 워크플로우 구조 변경으로 판단한다", () => {
    expect(isWorkflowStructureOperation(makeOp({ kind: "WORKFLOW_NODE" }))).toBe(true);
  });

  it("WORKFLOW_TRANSITION kind는 워크플로우 구조 변경으로 판단한다", () => {
    expect(isWorkflowStructureOperation(makeOp({ kind: "WORKFLOW_TRANSITION" }))).toBe(true);
  });

  it("ELEMENT kind는 워크플로우 구조 변경이 아니다", () => {
    expect(isWorkflowStructureOperation(makeOp({ kind: "ELEMENT" }))).toBe(false);
  });
});

// ---- buildOperationDiff ----

describe("buildOperationDiff", () => {
  it("MARK_SLOT_REQUIRED는 필수 여부 before/after 필드를 반환한다", () => {
    const diff = buildOperationDiff(makeOp({ operationType: "MARK_SLOT_REQUIRED" }));
    expect(diff.operationLabel).toBe("슬롯 필수화");
    expect(diff.fields).toHaveLength(1);
    expect(diff.fields[0].label).toBe("필수 여부");
    expect(diff.fields[0].before).toContain("선택");
    expect(diff.fields[0].after).toContain("필수");
  });

  it("ADD_WORKFLOW_NODE는 nodeId/nodeType/prompt 필드를 after에 반영하고 before는 '노드 없음'이다", () => {
    const diff = buildOperationDiff(
      makeOp({
        operationType: "ADD_WORKFLOW_NODE",
        kind: "WORKFLOW_NODE",
        nodeId: "node-ask-phone",
        nodeType: "ASK_SLOT",
        prompt: "전화번호를 알려주세요.",
      }),
    );
    expect(diff.operationLabel).toBe("워크플로우 노드 추가");
    const nodeIdField = diff.fields.find((f) => f.label === "노드 ID");
    expect(nodeIdField).toBeDefined();
    expect(nodeIdField?.before).toBe("노드 없음");
    expect(nodeIdField?.after).toBe("node-ask-phone");
    const nodeTypeField = diff.fields.find((f) => f.label === "노드 타입");
    expect(nodeTypeField?.after).toBe("ASK_SLOT");
    const promptField = diff.fields.find((f) => f.label === "프롬프트");
    expect(promptField?.after).toBe("전화번호를 알려주세요.");
  });

  it("UPDATE_TRANSITION은 from→to 전이 필드와 condition 필드를 포함한다", () => {
    const diff = buildOperationDiff(
      makeOp({
        operationType: "UPDATE_TRANSITION",
        kind: "WORKFLOW_TRANSITION",
        from: "state_a",
        to: "state_b",
        condition: "slot.amount > 0",
      }),
    );
    expect(diff.operationLabel).toBe("전이 수정");
    const transitionField = diff.fields.find((f) => f.label === "전이");
    expect(transitionField?.after).toBe("state_a → state_b");
    const conditionField = diff.fields.find((f) => f.label === "조건");
    expect(conditionField?.after).toBe("slot.amount > 0");
  });

  it("UPDATE_POLICY_CONDITION은 value를 after로 반영한다", () => {
    const diff = buildOperationDiff(
      makeOp({
        operationType: "UPDATE_POLICY_CONDITION",
        value: "amount >= 100",
      }),
    );
    expect(diff.operationLabel).toBe("정책 조건 변경");
    const field = diff.fields.find((f) => f.label === "정책 조건");
    expect(field?.after).toBe("amount >= 100");
  });

  it("UPDATE_RESPONSE_COPY는 value를 after로 반영한다", () => {
    const diff = buildOperationDiff(
      makeOp({
        operationType: "UPDATE_RESPONSE_COPY",
        value: "주문을 확인했습니다.",
      }),
    );
    expect(diff.operationLabel).toBe("응답 문구 변경");
    const field = diff.fields.find((f) => f.label === "응답 문구");
    expect(field?.after).toBe("주문을 확인했습니다.");
  });

  it("UPDATE_WORKFLOW_NODE는 nodeId/nodeType 필드 before가 '기존 노드'다", () => {
    const diff = buildOperationDiff(
      makeOp({
        operationType: "UPDATE_WORKFLOW_NODE",
        kind: "WORKFLOW_NODE",
        nodeId: "node-collect-phone",
        nodeType: "ASK_SLOT",
      }),
    );
    expect(diff.operationLabel).toBe("워크플로우 노드 수정");
    const nodeIdField = diff.fields.find((f) => f.label === "노드 ID");
    expect(nodeIdField?.before).toBe("기존 노드");
    expect(nodeIdField?.after).toBe("node-collect-phone");
  });

  it("ADD_TRANSITION은 from→to 전이 필드 before가 '전이 없음'이다", () => {
    const diff = buildOperationDiff(
      makeOp({
        operationType: "ADD_TRANSITION",
        kind: "WORKFLOW_TRANSITION",
        from: "start",
        to: "collect_name",
      }),
    );
    expect(diff.operationLabel).toBe("전이 추가");
    const transitionField = diff.fields.find((f) => f.label === "전이");
    expect(transitionField?.before).toBe("전이 없음");
    expect(transitionField?.after).toBe("start → collect_name");
  });

  it("REMOVE_TRANSITION은 from→to 전이 필드 before가 '기존 전이'다", () => {
    const diff = buildOperationDiff(
      makeOp({
        operationType: "REMOVE_TRANSITION",
        kind: "WORKFLOW_TRANSITION",
        from: "state_x",
        to: "state_y",
      }),
    );
    expect(diff.operationLabel).toBe("전이 삭제");
    const transitionField = diff.fields.find((f) => f.label === "전이");
    expect(transitionField?.before).toBe("기존 전이");
    expect(transitionField?.after).toBe("state_x → state_y");
  });

  it("UPDATE_INTENT_DESCRIPTION은 value를 after로 반영한다", () => {
    const diff = buildOperationDiff(
      makeOp({ operationType: "UPDATE_INTENT_DESCRIPTION", value: "환불 요청 의도 설명" }),
    );
    expect(diff.operationLabel).toBe("인텐트 설명 변경");
    const field = diff.fields.find((f) => f.label === "인텐트 설명");
    expect(field?.after).toBe("환불 요청 의도 설명");
  });

  it("ADD_INTENT_EXAMPLE은 value를 after로 반영한다", () => {
    const diff = buildOperationDiff(
      makeOp({ operationType: "ADD_INTENT_EXAMPLE", value: "환불해 주세요" }),
    );
    expect(diff.operationLabel).toBe("인텐트 예시 추가");
    const field = diff.fields.find((f) => f.label === "인텐트 예시");
    expect(field?.after).toBe("환불해 주세요");
  });

  it("UPDATE_SLOT_DESCRIPTION은 value를 after로 반영한다", () => {
    const diff = buildOperationDiff(
      makeOp({ operationType: "UPDATE_SLOT_DESCRIPTION", value: "주문번호 슬롯 설명" }),
    );
    expect(diff.operationLabel).toBe("슬롯 설명 변경");
    const field = diff.fields.find((f) => f.label === "슬롯 설명");
    expect(field?.after).toBe("주문번호 슬롯 설명");
  });

  it("UPDATE_SLOT_VALIDATION은 value를 after로 반영한다", () => {
    const diff = buildOperationDiff(
      makeOp({ operationType: "UPDATE_SLOT_VALIDATION", value: "^[0-9]{8}$" }),
    );
    expect(diff.operationLabel).toBe("슬롯 검증 변경");
    const field = diff.fields.find((f) => f.label === "슬롯 검증");
    expect(field?.after).toBe("^[0-9]{8}$");
  });

  it("UPDATE_RISK_TRIGGER는 value를 after로 반영한다", () => {
    const diff = buildOperationDiff(
      makeOp({ operationType: "UPDATE_RISK_TRIGGER", value: "금액 10만원 초과" }),
    );
    expect(diff.operationLabel).toBe("리스크 트리거 변경");
    const field = diff.fields.find((f) => f.label === "리스크 트리거");
    expect(field?.after).toBe("금액 10만원 초과");
  });

  it("알 수 없는 operationType은 폴백 필드를 반환하고 라벨은 원문이다", () => {
    const diff = buildOperationDiff(
      makeOp({ operationType: "FOO_BAR", value: "someValue" }),
    );
    expect(diff.operationLabel).toBe("FOO_BAR");
    expect(diff.fields.length).toBeGreaterThan(0);
    const fallbackField = diff.fields[0];
    expect(fallbackField.after).toBe("someValue");
  });

  it("targetComplete와 reason을 그대로 전달한다", () => {
    const diff = buildOperationDiff(
      makeOp({ targetComplete: false, reason: "근거 설명" }),
    );
    expect(diff.targetComplete).toBe(false);
    expect(diff.reason).toBe("근거 설명");
  });
});

// ---- buildStructuralPatchReview ----

describe("buildStructuralPatchReview", () => {
  describe('patchValidationStatus="VALID"', () => {
    it("operations 2개를 diffs로 변환하고 kind=structural을 반환한다", () => {
      const ops = [
        makeOp({ operationType: "MARK_SLOT_REQUIRED", kind: "ELEMENT" }),
        makeOp({ operationType: "UPDATE_RESPONSE_COPY", kind: "ELEMENT", value: "안녕하세요" }),
      ];
      const result = buildStructuralPatchReview(
        makeCandidate({
          patchValidationStatus: "VALID",
          patchSummary: "슬롯 필수화 + 응답 수정",
          operations: ops,
        }),
      );
      expect(result.kind).toBe("structural");
      expect(result.diffs).toHaveLength(2);
      expect(result.summary).toBe("슬롯 필수화 + 응답 수정");
      expect(result.errors).toHaveLength(0);
    });

    it("WORKFLOW_NODE op 포함 시 hasWorkflowStructureChange=true다", () => {
      const ops = [
        makeOp({ operationType: "ADD_WORKFLOW_NODE", kind: "WORKFLOW_NODE" }),
        makeOp({ operationType: "MARK_SLOT_REQUIRED", kind: "ELEMENT" }),
      ];
      const result = buildStructuralPatchReview(
        makeCandidate({ patchValidationStatus: "VALID", operations: ops }),
      );
      expect(result.hasWorkflowStructureChange).toBe(true);
    });

    it("ELEMENT kind만 있을 때 hasWorkflowStructureChange=false다", () => {
      const ops = [
        makeOp({ operationType: "MARK_SLOT_REQUIRED", kind: "ELEMENT" }),
        makeOp({ operationType: "UPDATE_RESPONSE_COPY", kind: "ELEMENT" }),
      ];
      const result = buildStructuralPatchReview(
        makeCandidate({ patchValidationStatus: "VALID", operations: ops }),
      );
      expect(result.hasWorkflowStructureChange).toBe(false);
    });
  });

  it('patchValidationStatus="LEGACY"는 kind=legacy, diffs 빈 배열을 반환한다', () => {
    const result = buildStructuralPatchReview(
      makeCandidate({
        patchValidationStatus: "LEGACY",
        operations: [makeOp()],
      }),
    );
    expect(result.kind).toBe("legacy");
    expect(result.diffs).toHaveLength(0);
  });

  it('patchValidationStatus="INVALID"는 kind=invalid, errors를 반환한다', () => {
    const result = buildStructuralPatchReview(
      makeCandidate({
        patchValidationStatus: "INVALID",
        patchValidationErrors: ["필드 A 누락", "필드 B 타입 오류"],
        operations: [],
      }),
    );
    expect(result.kind).toBe("invalid");
    expect(result.errors).toEqual(["필드 A 누락", "필드 B 타입 오류"]);
  });

  it('patchValidationStatus="NONE"은 kind=missing을 반환한다', () => {
    const result = buildStructuralPatchReview(
      makeCandidate({ patchValidationStatus: "NONE" }),
    );
    expect(result.kind).toBe("missing");
  });
});

// ---- evaluateApprovalGuardrail ----

describe("evaluateApprovalGuardrail", () => {
  function makeModel(
    kind: "structural" | "legacy" | "invalid" | "missing",
    overrides: {
      diffs?: ReturnType<typeof buildOperationDiff>[];
      errors?: string[];
    } = {},
  ) {
    const diffs = overrides.diffs ?? [
      buildOperationDiff(makeOp({ targetComplete: true })),
    ];
    return {
      kind,
      status: kind === "structural" ? ("VALID" as const) :
              kind === "legacy" ? ("LEGACY" as const) :
              kind === "invalid" ? ("INVALID" as const) :
              ("NONE" as const),
      summary: null,
      hasWorkflowStructureChange: false,
      diffs,
      errors: overrides.errors ?? [],
      message: null,
    };
  }

  it("invalid 모델은 canApprove=false이고 disabledReasons이 비어있지 않다", () => {
    const result = evaluateApprovalGuardrail(makeModel("invalid"), true);
    expect(result.canApprove).toBe(false);
    expect(result.disabledReasons.length).toBeGreaterThan(0);
  });

  it("missing 모델은 canApprove=false다", () => {
    const result = evaluateApprovalGuardrail(makeModel("missing"), true);
    expect(result.canApprove).toBe(false);
    expect(result.disabledReasons.length).toBeGreaterThan(0);
  });

  it("structural + 모든 targetComplete=true + confirmed=false → canApprove=false, 구조 변경 검토 확인 사유", () => {
    const result = evaluateApprovalGuardrail(makeModel("structural"), false);
    expect(result.canApprove).toBe(false);
    const reasons = result.disabledReasons.join(" ");
    expect(reasons).toContain("구조 변경 검토 확인");
  });

  it("structural + 모든 targetComplete=true + confirmed=true → canApprove=true", () => {
    const result = evaluateApprovalGuardrail(makeModel("structural"), true);
    expect(result.canApprove).toBe(true);
    expect(result.disabledReasons).toHaveLength(0);
  });

  it("structural + targetComplete=false인 op 포함 + confirmed=true → canApprove=false, 대상 확인 불가 사유", () => {
    const diffs = [buildOperationDiff(makeOp({ targetComplete: false }))];
    const result = evaluateApprovalGuardrail(makeModel("structural", { diffs }), true);
    expect(result.canApprove).toBe(false);
    const reasons = result.disabledReasons.join(" ");
    expect(reasons).toContain("대상을 확인할 수 없는");
  });

  it("structural + operations 빈 배열 → canApprove=false", () => {
    const result = evaluateApprovalGuardrail(makeModel("structural", { diffs: [] }), true);
    expect(result.canApprove).toBe(false);
  });

  it("legacy + confirmed=true → canApprove=true", () => {
    const result = evaluateApprovalGuardrail(makeModel("legacy"), true);
    expect(result.canApprove).toBe(true);
    expect(result.disabledReasons).toHaveLength(0);
  });

  it("legacy + confirmed=false → canApprove=false", () => {
    const result = evaluateApprovalGuardrail(makeModel("legacy"), false);
    expect(result.canApprove).toBe(false);
  });
});
