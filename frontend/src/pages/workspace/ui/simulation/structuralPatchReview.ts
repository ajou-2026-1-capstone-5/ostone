import type {
  SimulationImprovementCandidate,
  SimulationPatchOperationView,
  SimulationPatchValidationStatus,
} from "@/features/simulation";

const OPERATION_TYPE_LABELS: Readonly<Record<string, string>> = {
  MARK_SLOT_REQUIRED: "슬롯 필수화",
  ADD_WORKFLOW_NODE: "워크플로우 노드 추가",
  UPDATE_WORKFLOW_NODE: "워크플로우 노드 수정",
  ADD_TRANSITION: "전이 추가",
  UPDATE_TRANSITION: "전이 수정",
  REMOVE_TRANSITION: "전이 삭제",
  UPDATE_POLICY_CONDITION: "정책 조건 변경",
  UPDATE_RESPONSE_COPY: "응답 문구 변경",
  UPDATE_INTENT_DESCRIPTION: "인텐트 설명 변경",
  ADD_INTENT_EXAMPLE: "인텐트 예시 추가",
  UPDATE_SLOT_DESCRIPTION: "슬롯 설명 변경",
  UPDATE_SLOT_VALIDATION: "슬롯 검증 변경",
  UPDATE_RISK_TRIGGER: "리스크 트리거 변경",
};

export function operationTypeLabel(operationType: string): string {
  return OPERATION_TYPE_LABELS[operationType] ?? operationType;
}

export function isWorkflowStructureOperation(op: SimulationPatchOperationView): boolean {
  return op.kind === "WORKFLOW_NODE" || op.kind === "WORKFLOW_TRANSITION";
}

export interface PatchDiffField {
  readonly label: string;
  readonly before: string;
  readonly after: string;
}

export interface PatchOperationDiff {
  readonly operationType: string;
  readonly operationLabel: string;
  readonly kind: SimulationPatchOperationView["kind"];
  readonly targetLabel: string;
  readonly fields: readonly PatchDiffField[];
  readonly reason: string | null;
  readonly targetComplete: boolean;
}

function buildTargetLabel(op: SimulationPatchOperationView): string {
  const reference = op.targetCode ?? (op.targetId !== null ? `#${op.targetId}` : null) ?? op.nodeId;
  if (op.targetCategory && reference) return `${op.targetCategory} · ${reference}`;
  if (op.targetCategory) return op.targetCategory;
  if (reference) return reference;
  return "(대상 미상)";
}

function fallbackAfterValue(op: SimulationPatchOperationView): string {
  return op.value ?? op.prompt ?? op.condition ?? "(상세 없음)";
}

function buildNodeFields(op: SimulationPatchOperationView, before: string): PatchDiffField[] {
  const fields: PatchDiffField[] = [];
  if (op.nodeId) fields.push({ label: "노드 ID", before, after: op.nodeId });
  if (op.nodeType) fields.push({ label: "노드 타입", before, after: op.nodeType });
  if (op.slotCode) fields.push({ label: "슬롯", before, after: op.slotCode });
  if (op.prompt) fields.push({ label: "프롬프트", before, after: op.prompt });
  if (fields.length === 0) {
    fields.push({ label: "노드", before, after: fallbackAfterValue(op) });
  }
  return fields;
}

function buildTransitionFields(
  op: SimulationPatchOperationView,
  before: string,
): PatchDiffField[] {
  const transition = `${op.from ?? "(시작 미상)"} → ${op.to ?? "(종료 미상)"}`;
  const fields: PatchDiffField[] = [{ label: "전이", before, after: transition }];
  if (op.condition) {
    fields.push({ label: "조건", before: "기존 조건", after: op.condition });
  }
  return fields;
}

function buildOperationFields(op: SimulationPatchOperationView): PatchDiffField[] {
  switch (op.operationType) {
    case "MARK_SLOT_REQUIRED":
      return [{ label: "필수 여부", before: "선택 슬롯(필수 아님)", after: "필수 슬롯" }];
    case "ADD_WORKFLOW_NODE":
      return buildNodeFields(op, "노드 없음");
    case "UPDATE_WORKFLOW_NODE":
      return buildNodeFields(op, "기존 노드");
    case "ADD_TRANSITION":
      return buildTransitionFields(op, "전이 없음");
    case "UPDATE_TRANSITION":
      return buildTransitionFields(op, "기존 전이");
    case "REMOVE_TRANSITION":
      return buildTransitionFields(op, "기존 전이");
    case "UPDATE_POLICY_CONDITION":
      return [{ label: "정책 조건", before: "기존 조건", after: fallbackAfterValue(op) }];
    case "UPDATE_RESPONSE_COPY":
      return [{ label: "응답 문구", before: "기존 문구", after: fallbackAfterValue(op) }];
    case "UPDATE_INTENT_DESCRIPTION":
      return [{ label: "인텐트 설명", before: "현재 값", after: fallbackAfterValue(op) }];
    case "ADD_INTENT_EXAMPLE":
      return [{ label: "인텐트 예시", before: "현재 값", after: fallbackAfterValue(op) }];
    case "UPDATE_SLOT_DESCRIPTION":
      return [{ label: "슬롯 설명", before: "현재 값", after: fallbackAfterValue(op) }];
    case "UPDATE_SLOT_VALIDATION":
      return [{ label: "슬롯 검증", before: "현재 값", after: fallbackAfterValue(op) }];
    case "UPDATE_RISK_TRIGGER":
      return [{ label: "리스크 트리거", before: "현재 값", after: fallbackAfterValue(op) }];
    default:
      return [{ label: "변경", before: "현재 값", after: fallbackAfterValue(op) }];
  }
}

export function buildOperationDiff(op: SimulationPatchOperationView): PatchOperationDiff {
  return {
    operationType: op.operationType,
    operationLabel: operationTypeLabel(op.operationType),
    kind: op.kind,
    targetLabel: buildTargetLabel(op),
    fields: buildOperationFields(op),
    reason: op.reason,
    targetComplete: op.targetComplete,
  };
}

export type StructuralReviewKind = "structural" | "legacy" | "invalid" | "missing";

export interface StructuralPatchReviewModel {
  readonly kind: StructuralReviewKind;
  readonly status: SimulationPatchValidationStatus;
  readonly summary: string | null;
  readonly hasWorkflowStructureChange: boolean;
  readonly diffs: readonly PatchOperationDiff[];
  readonly errors: readonly string[];
  readonly message: string | null;
}

export function buildStructuralPatchReview(
  candidate: SimulationImprovementCandidate,
): StructuralPatchReviewModel {
  const status = candidate.patchValidationStatus;
  switch (status) {
    case "VALID": {
      const operations = candidate.operations;
      return {
        kind: "structural",
        status,
        summary: candidate.patchSummary,
        hasWorkflowStructureChange: operations.some(isWorkflowStructureOperation),
        diffs: operations.map(buildOperationDiff),
        errors: [],
        message: null,
      };
    }
    case "LEGACY":
      return {
        kind: "legacy",
        status,
        summary: candidate.patchSummary,
        hasWorkflowStructureChange: false,
        diffs: [],
        errors: [],
        message: null,
      };
    case "INVALID":
      return {
        kind: "invalid",
        status,
        summary: candidate.patchSummary,
        hasWorkflowStructureChange: false,
        diffs: [],
        errors: candidate.patchValidationErrors,
        message: "패치 검증에 실패했습니다. 승인할 수 없습니다.",
      };
    case "NONE":
    default:
      return {
        kind: "missing",
        status,
        summary: candidate.patchSummary,
        hasWorkflowStructureChange: false,
        diffs: [],
        errors: [],
        message: "draft patch 정보가 없습니다.",
      };
  }
}

export interface ApprovalGuardrail {
  readonly canApprove: boolean;
  readonly requiresStructuralConfirmation: boolean;
  readonly disabledReasons: readonly string[];
}

export function evaluateApprovalGuardrail(
  model: StructuralPatchReviewModel,
  structuralConfirmed: boolean,
): ApprovalGuardrail {
  switch (model.kind) {
    case "invalid":
      return {
        canApprove: false,
        requiresStructuralConfirmation: false,
        disabledReasons: ["패치 검증 실패"],
      };
    case "missing":
      return {
        canApprove: false,
        requiresStructuralConfirmation: false,
        disabledReasons: ["draft patch 없음"],
      };
    case "legacy":
      return {
        canApprove: structuralConfirmed,
        requiresStructuralConfirmation: true,
        disabledReasons: structuralConfirmed ? [] : ["변경 상세 확인이 필요합니다"],
      };
    case "structural":
    default: {
      const disabledReasons: string[] = [];
      if (model.diffs.length === 0) {
        disabledReasons.push("변경 작업이 없습니다");
      }
      if (model.diffs.some((diff) => !diff.targetComplete)) {
        disabledReasons.push("대상을 확인할 수 없는 변경이 있습니다");
      }
      if (!structuralConfirmed) {
        disabledReasons.push("구조 변경 검토 확인이 필요합니다");
      }
      return {
        canApprove: disabledReasons.length === 0,
        requiresStructuralConfirmation: true,
        disabledReasons,
      };
    }
  }
}
