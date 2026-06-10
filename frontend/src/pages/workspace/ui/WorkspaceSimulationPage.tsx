import { useEffect, useMemo, useState } from "react";
import {
  Navigate,
  useLocation,
  useOutletContext,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  CheckCircleIcon,
  FlagIcon,
  LightbulbIcon,
  PlayIcon,
  PlusIcon,
  RefreshCwIcon,
  SendIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  useListAllWorkspaceWorkflows,
  type WorkspaceWorkflowEntry,
} from "@/entities/workflow";
import { safeParseGraph } from "@/entities/workflow/ui/lib/parseGraph";
import {
  simulationApi,
  type SimulationFeedback,
  type SimulationFeedbackSeverity,
  type SimulationFeedbackStatus,
  type SimulationFeedbackType,
  type SimulationGoldenCase,
  type SimulationGoldenCaseReplayStatus,
  type CreateSimulationImprovementCandidatePayload,
  type SimulationImprovementCandidate,
  type SimulationImprovementCandidateStatus,
  type SimulationImprovementCandidateTargetType,
  type SimulationSessionDetail,
} from "@/features/simulation";
import type {
  ChatMessage,
  ChatSession,
} from "@/features/consultation/api/consultationApi";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import { ApiRequestError, selectApiList } from "@/shared/api";
import { useListIntents } from "@/shared/api/generated/endpoints/intent-definition-controller/intent-definition-controller";
import { createSimulationImprovementCandidateRequestBeforeSummaryMax } from "@/shared/api/generated/zod";
import type { IntentDefinitionSummary } from "@/shared/api/generated/zod";
import type { ShellContext } from "@/shared/ui/ostone/chrome";
import { Button } from "@/shared/ui/button";
import { NativeSelect, NativeSelectOption } from "@/shared/ui/native-select";
import { LoadingSpinner } from "@/shared/ui/ostone/atoms/LoadingSpinner";
import { ErrorState } from "@/shared/ui/ostone/atoms/ErrorState";
import { EmptyState } from "@/shared/ui/ostone/atoms/EmptyState";

import { StructuralPatchReview } from "./simulation/StructuralPatchReviewPanel";
import {
  buildStructuralPatchReview,
  evaluateApprovalGuardrail,
} from "./simulation/structuralPatchReview";
import styles from "./simulation/workspace-simulation-page.module.css";

const PAGE_SIZE = 20;
const DEFAULT_FEEDBACK_TYPE: SimulationFeedbackType = "INTENT_MISMATCH";
const DEFAULT_FEEDBACK_SEVERITY: SimulationFeedbackSeverity = "MEDIUM";

const FEEDBACK_TYPES: Array<{ value: SimulationFeedbackType; label: string }> =
  [
    { value: "INTENT_MISMATCH", label: "잘못된 intent 매칭" },
    { value: "MISSING_SLOT_QUESTION", label: "누락된 slot 질문" },
    { value: "INAPPROPRIATE_RESPONSE", label: "부적절한 응답 문구" },
    { value: "POLICY_CONDITION_MISSING", label: "policy 조건 누락" },
    { value: "RISK_HANDOFF_REQUIRED", label: "risk/handoff 필요" },
    { value: "WORKFLOW_BRANCH_ERROR", label: "workflow 분기 오류" },
    { value: "OTHER", label: "기타" },
  ];

const FEEDBACK_SEVERITIES: Array<{
  value: SimulationFeedbackSeverity;
  label: string;
}> = [
  { value: "LOW", label: "낮음" },
  { value: "MEDIUM", label: "보통" },
  { value: "HIGH", label: "높음" },
  { value: "CRITICAL", label: "긴급" },
];

const FEEDBACK_STATUSES: Array<{
  value: SimulationFeedbackStatus | "";
  label: string;
}> = [
  { value: "OPEN", label: "열림" },
  { value: "CANDIDATE_CREATED", label: "후보 생성" },
  { value: "RESOLVED", label: "해결됨" },
  { value: "DISMISSED", label: "보류됨" },
  { value: "", label: "전체" },
];

const CANDIDATE_STATUSES: Array<{
  value: SimulationImprovementCandidateStatus | "";
  label: string;
}> = [
  { value: "DRAFT", label: "초안" },
  { value: "READY_FOR_REVIEW", label: "리뷰 대기" },
  { value: "APPLIED", label: "반영됨" },
  { value: "REJECTED", label: "반려됨" },
  { value: "", label: "전체" },
];

const CANDIDATE_TARGET_TYPES: Array<{
  value: SimulationImprovementCandidateTargetType;
  label: string;
}> = [
  { value: "INTENT", label: "Intent" },
  { value: "SLOT", label: "Slot" },
  { value: "POLICY", label: "Policy" },
  { value: "RISK_RULE", label: "Risk rule" },
  { value: "WORKFLOW", label: "Workflow" },
  { value: "HANDOFF", label: "Handoff" },
  { value: "RESPONSE", label: "Response" },
  { value: "UNKNOWN", label: "기타" },
];

const FEEDBACK_LIST_ERROR = "시뮬레이션 피드백 목록을 불러오지 못했습니다.";
const CANDIDATE_LIST_ERROR = "개선 후보 목록을 불러오지 못했습니다.";
const GOLDEN_CASE_LIST_ERROR = "검증 케이스 목록을 불러오지 못했습니다.";

const ACTION_TYPES = [
  "ASK_SLOT",
  "ADVANCE",
  "ANSWER",
  "COMPLETED",
  "HANDOFF",
  "WAIT",
] as const;

type SimulationSideTab = "state" | "feedback" | "candidates";

interface SimulationTarget {
  packId: number | null;
  versionId: number | null;
  workflowId: number | null;
}

interface CandidateWorkflowTarget {
  workflowId: number;
  workflowCode: string | null;
  workflowName: string;
}

interface CandidatePatchChange {
  label: string;
  before: string;
  after: string;
}

type CandidatePatchReviewModel =
  | {
      kind: "ready";
      operation: string;
      targetLabel: string;
      changes: CandidatePatchChange[];
      evidence: string;
      impactItems: string[];
      rawJson: string;
    }
  | {
      kind: "missing";
      message: string;
      rawJson?: string;
    }
  | {
      kind: "invalid";
      message: string;
      rawJson: string;
    };

const SIDE_TABS: Array<{ value: SimulationSideTab; label: string }> = [
  { value: "state", label: "상태" },
  { value: "feedback", label: "피드백" },
  { value: "candidates", label: "개선 후보" },
];

function readInitialSideTab(searchParams: URLSearchParams): SimulationSideTab {
  if (searchParams.has("candidateStatus")) return "candidates";
  if (searchParams.has("feedbackStatus")) return "feedback";
  return "state";
}

function readFeedbackStatusParam(
  searchParams: URLSearchParams,
): SimulationFeedbackStatus | "" {
  const value = searchParams.get("feedbackStatus");
  return FEEDBACK_STATUSES.some((status) => status.value === value)
    ? (value as SimulationFeedbackStatus | "")
    : "OPEN";
}

function readCandidateStatusParam(
  searchParams: URLSearchParams,
): SimulationImprovementCandidateStatus | "" {
  const value = searchParams.get("candidateStatus");
  return CANDIDATE_STATUSES.some((status) => status.value === value)
    ? (value as SimulationImprovementCandidateStatus | "")
    : "DRAFT";
}

function readPositiveIntParam(
  searchParams: URLSearchParams,
  key: keyof SimulationTarget,
): number | null {
  return parseRouteId(searchParams.get(key) ?? undefined);
}

function readSimulationTargetFromSearch(
  searchParams: URLSearchParams,
): SimulationTarget | null {
  const packId = readPositiveIntParam(searchParams, "packId");
  const versionId = readPositiveIntParam(searchParams, "versionId");
  const workflowId = readPositiveIntParam(searchParams, "workflowId");
  return packId !== null || versionId !== null || workflowId !== null
    ? { packId, versionId, workflowId }
    : null;
}

function readStateTargetId(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

function readSimulationTargetFromState(
  state: unknown,
): SimulationTarget | null {
  if (typeof state !== "object" || state === null) return null;
  const value = (state as { simulationTarget?: unknown }).simulationTarget;
  if (typeof value !== "object" || value === null) return null;
  const target = value as {
    packId?: unknown;
    versionId?: unknown;
    workflowId?: unknown;
  };
  const packId = readStateTargetId(target.packId);
  const versionId = readStateTargetId(target.versionId);
  const workflowId = readStateTargetId(target.workflowId);
  return packId !== null || versionId !== null || workflowId !== null
    ? { packId, versionId, workflowId }
    : null;
}

function findTargetWorkflow(
  workflows: WorkspaceWorkflowEntry[],
  target: SimulationTarget | null,
): WorkspaceWorkflowEntry | null {
  if (target?.workflowId === null || target?.workflowId === undefined) {
    return null;
  }

  return (
    workflows.find(
      (workflow) =>
        workflow.workflowId === target.workflowId &&
        (target.packId === null || workflow.packId === target.packId) &&
        (target.versionId === null || workflow.versionId === target.versionId),
    ) ??
    workflows.find((workflow) => workflow.workflowId === target.workflowId) ??
    null
  );
}

function formatTargetId(value: number | null, fallback: string): string {
  return value === null ? fallback : `#${value}`;
}

function matchesTargetContext(
  workflow: WorkspaceWorkflowEntry | null,
  target: SimulationTarget | null,
): boolean {
  if (!workflow || !target) return false;
  return (
    (target.workflowId === null || workflow.workflowId === target.workflowId) &&
    (target.packId === null || workflow.packId === target.packId) &&
    (target.versionId === null || workflow.versionId === target.versionId)
  );
}

type Meta = {
  customerName?: string;
  selectedIntentCode?: string;
};

function parseMeta(metaJson?: string | null): Meta {
  if (!metaJson) return {};
  try {
    const parsed = JSON.parse(metaJson);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Meta;
    }
  } catch {
    return {};
  }
  return {};
}

function formatTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getHours().toString().padStart(2, "0")}:${date
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

function roleLabel(role?: string | null): string {
  switch (role) {
    case "USER":
    case "CUSTOMER":
      return "고객";
    case "ASSISTANT":
      return "시스템";
    case "SYSTEM":
      return "상태";
    default:
      return role ?? "메시지";
  }
}

function customerName(session: ChatSession | null): string {
  return parseMeta(session?.metaJson).customerName ?? "시뮬레이션 고객";
}

function selectedIntentCode(session: ChatSession | null): string | null {
  const intentCode = parseMeta(session?.metaJson).selectedIntentCode?.trim();
  return intentCode || null;
}

function slotEntries(detail: SimulationSessionDetail | null) {
  const values = detail?.slotValues ?? {};
  return Object.entries(values).filter(
    ([, value]) => value !== null && value !== undefined,
  );
}

function hasMissingRequiredSlot(
  detail: SimulationSessionDetail | null,
): boolean {
  return (
    detail?.slots.some((slot) => {
      if (typeof slot !== "object" || slot === null || Array.isArray(slot))
        return false;
      const required = (slot as { required?: unknown }).required;
      const hasValue = (slot as { hasValue?: unknown }).hasValue;
      return required === true && hasValue !== true;
    }) ?? false
  );
}

function inferExpectedActionType(
  detail: SimulationSessionDetail | null,
): string {
  return hasMissingRequiredSlot(detail) ? "ASK_SLOT" : "";
}

function feedbackTypeLabel(type: SimulationFeedbackType): string {
  return FEEDBACK_TYPES.find((item) => item.value === type)?.label ?? type;
}

function feedbackSeverityLabel(severity: SimulationFeedbackSeverity): string {
  return (
    FEEDBACK_SEVERITIES.find((item) => item.value === severity)?.label ??
    severity
  );
}

function feedbackStatusLabel(status: SimulationFeedbackStatus): string {
  return (
    FEEDBACK_STATUSES.find((item) => item.value === status)?.label ?? status
  );
}

function candidateStatusLabel(
  status: SimulationImprovementCandidateStatus,
): string {
  return (
    CANDIDATE_STATUSES.find((item) => item.value === status)?.label ?? status
  );
}

function candidateTypeLabel(
  type: SimulationImprovementCandidate["candidateType"],
): string {
  switch (type) {
    case "INTENT_DESCRIPTION_EXAMPLE":
      return "intent 설명/예시";
    case "SLOT_QUESTION":
      return "slot 질문";
    case "POLICY_CONDITION":
      return "policy 조건";
    case "RISK_RULE":
      return "risk rule";
    case "WORKFLOW_STATE_TRANSITION":
      return "workflow 전이";
    case "HANDOFF_CONDITION":
      return "handoff 조건";
    case "RESPONSE_COPY":
      return "응답 문구";
    case "OTHER":
      return "기타";
    default:
      return type;
  }
}

function candidateTargetLabel(
  candidate: SimulationImprovementCandidate,
): string {
  const id = candidate.targetElementId ? ` #${candidate.targetElementId}` : "";
  const key = candidate.targetElementKey
    ? ` · ${candidate.targetElementKey}`
    : "";
  return `${candidate.targetElementType}${id}${key}`;
}

function candidateTargetTypeLabel(
  type: SimulationImprovementCandidateTargetType,
): string {
  return (
    CANDIDATE_TARGET_TYPES.find((item) => item.value === type)?.label ?? type
  );
}

function inferCandidateTargetType(
  feedbackType: SimulationFeedbackType,
): SimulationImprovementCandidateTargetType {
  switch (feedbackType) {
    case "INTENT_MISMATCH":
      return "INTENT";
    case "MISSING_SLOT_QUESTION":
      return "SLOT";
    case "POLICY_CONDITION_MISSING":
      return "POLICY";
    case "RISK_HANDOFF_REQUIRED":
      return "RISK_RULE";
    case "WORKFLOW_BRANCH_ERROR":
      return "WORKFLOW";
    case "INAPPROPRIATE_RESPONSE":
      return "RESPONSE";
    case "OTHER":
      return "UNKNOWN";
    default:
      return "UNKNOWN";
  }
}

function candidateTargetDescription(
  targetType: SimulationImprovementCandidateTargetType,
  workflowTarget: CandidateWorkflowTarget | null,
): string {
  if (targetType === "WORKFLOW") {
    return workflowTarget
      ? `${workflowTarget.workflowName} workflow id/key를 후보에 함께 저장합니다.`
      : "workflow 맥락이 확인되지 않아 target type만 후보에 저장됩니다.";
  }

  if (targetType === "UNKNOWN") {
    return "기타 피드백은 구체 대상이 확정되지 않은 제한 상태로 후보화됩니다.";
  }

  return "현재 화면은 세부 element 선택을 지원하지 않아 target type까지만 후보에 저장합니다.";
}

function candidateTargetElementLabel(
  targetType: SimulationImprovementCandidateTargetType,
  workflowTarget: CandidateWorkflowTarget | null,
): string {
  if (targetType === "WORKFLOW" && workflowTarget) {
    const key = workflowTarget.workflowCode ?? workflowTarget.workflowName;
    return `#${workflowTarget.workflowId} · ${key}`;
  }

  return "세부 element 미선택";
}

const BEFORE_SUMMARY_MAX_LENGTH =
  createSimulationImprovementCandidateRequestBeforeSummaryMax;

function buildCandidateBeforeSummary(
  feedback: SimulationFeedback,
  workflowTarget: CandidateWorkflowTarget | null,
): string {
  if (!workflowTarget) {
    return feedback.description;
  }
  const summary = `${feedback.description} (세션에 적용된 workflow: ${workflowTarget.workflowName})`;
  return summary.length <= BEFORE_SUMMARY_MAX_LENGTH
    ? summary
    : feedback.description;
}

function buildCandidateTargetPayload(
  feedback: SimulationFeedback,
  targetType: SimulationImprovementCandidateTargetType,
  workflowTarget: CandidateWorkflowTarget | null,
  intentCode?: string | null,
): CreateSimulationImprovementCandidatePayload {
  const payload: CreateSimulationImprovementCandidatePayload = {
    targetElementType: targetType,
    beforeSummary: buildCandidateBeforeSummary(feedback, workflowTarget),
    afterSummary: feedback.expectedBehavior,
  };

  if (targetType === "WORKFLOW" && workflowTarget) {
    payload.targetElementId = workflowTarget.workflowId;
    payload.targetElementKey =
      workflowTarget.workflowCode ?? workflowTarget.workflowName;
  }

  if (targetType === "INTENT" && intentCode) {
    payload.targetElementKey = intentCode;
  }

  return payload;
}

function replayStatusLabel(
  status?: SimulationGoldenCaseReplayStatus | null,
): string {
  switch (status) {
    case "PASS":
      return "PASS";
    case "FAIL":
      return "FAIL";
    default:
      return "미실행";
  }
}

function readExpectedField(
  goldenCase: SimulationGoldenCase,
  field: string,
): string | null {
  try {
    const parsed = JSON.parse(goldenCase.expectedJson);
    if (parsed && typeof parsed === "object" && field in parsed) {
      const value = (parsed as Record<string, unknown>)[field];
      return value == null ? null : String(value);
    }
  } catch {
    return null;
  }
  return null;
}

function optionalText(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function displayText(value?: string | number | null): string {
  if (value === null || value === undefined || value === "") return "미확인";
  return String(value);
}

function stringifySlotValues(values?: Record<string, unknown> | null): string {
  return JSON.stringify(values ?? {}, null, 2);
}

function parseSlotValuesInput(value: string): Record<string, unknown> | null {
  const trimmed = value.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  return parsed as Record<string, unknown>;
}

function patchText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number")
    return Number.isFinite(value) ? String(value) : null;
  if (typeof value === "boolean") return value ? "true" : "false";
  try {
    const json = JSON.stringify(value);
    return typeof json === "string" ? json : null;
  } catch {
    return null;
  }
}

function firstPatchText(...values: unknown[]): string | null {
  for (const value of values) {
    const text = patchText(value);
    if (text) return text;
  }
  return null;
}

function formatDraftPatchRaw(raw: unknown): string {
  if (typeof raw === "string") {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }
  try {
    return JSON.stringify(raw, null, 2);
  } catch {
    return String(raw);
  }
}

function readPatchObject(raw: string): Record<string, unknown> | null {
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  return parsed as Record<string, unknown>;
}

function readPatchChanges(
  patch: Record<string, unknown>,
): CandidatePatchChange[] {
  const changes: CandidatePatchChange[] = [];
  const rawChanges = patch.changes;

  if (Array.isArray(rawChanges)) {
    rawChanges.forEach((rawChange, index) => {
      if (
        typeof rawChange !== "object" ||
        rawChange === null ||
        Array.isArray(rawChange)
      ) {
        return;
      }
      const change = rawChange as Record<string, unknown>;
      const before = firstPatchText(
        change.before,
        change.beforeValue,
        change.old,
        change.oldValue,
        change.from,
      );
      const after = firstPatchText(
        change.after,
        change.afterValue,
        change.new,
        change.newValue,
        change.to,
      );
      if (!before && !after) return;
      changes.push({
        label:
          firstPatchText(
            change.field,
            change.path,
            change.name,
            change.label,
          ) ?? `변경 ${index + 1}`,
        before: before ?? "값 없음",
        after: after ?? "값 없음",
      });
    });
  }

  const beforeSummary = firstPatchText(patch.beforeSummary, patch.before);
  const afterSummary = firstPatchText(patch.afterSummary, patch.after);
  if (beforeSummary || afterSummary) {
    changes.push({
      label: "초안 변경 요약",
      before: beforeSummary ?? "값 없음",
      after: afterSummary ?? "값 없음",
    });
  }

  return changes;
}

function patchTargetLabel(
  patch: Record<string, unknown>,
  candidate: SimulationImprovementCandidate,
): string {
  const targetType =
    firstPatchText(patch.targetElementType) ?? candidate.targetElementType;
  const targetId =
    firstPatchText(patch.targetElementId) ??
    patchText(candidate.targetElementId);
  const targetKey =
    firstPatchText(patch.targetElementKey) ?? candidate.targetElementKey;
  return [targetType, targetId ? `#${targetId}` : null, targetKey]
    .filter(Boolean)
    .join(" · ");
}

function buildCandidatePatchReview(
  candidate: SimulationImprovementCandidate,
): CandidatePatchReviewModel {
  const raw = candidate.draftPatchJson?.trim();
  if (!raw || raw === "{}" || raw === "[]" || raw === "null") {
    return {
      kind: "missing",
      message:
        "draft patch 정보가 없습니다. 변경 전/후 필드를 확인할 수 없습니다.",
    };
  }

  let patch: Record<string, unknown> | null;
  try {
    patch = readPatchObject(raw);
  } catch {
    return {
      kind: "invalid",
      message: "draft patch JSON을 해석할 수 없습니다.",
      rawJson: raw,
    };
  }

  if (!patch || Object.keys(patch).length === 0) {
    return {
      kind: "missing",
      message: "draft patch가 객체 형식이 아니거나 비어 있습니다.",
      rawJson: formatDraftPatchRaw(raw),
    };
  }

  const changes = readPatchChanges(patch);
  if (changes.length === 0) {
    return {
      kind: "missing",
      message: "draft patch에 변경 전/후 필드가 없습니다.",
      rawJson: formatDraftPatchRaw(raw),
    };
  }

  const targetLabel = patchTargetLabel(patch, candidate);
  const evidence =
    firstPatchText(patch.evidenceSummary, patch.evidence) ??
    candidate.evidenceSummary;
  const impactItems = [
    `Domain Pack version #${candidate.domainPackVersionId}`,
    targetLabel ? `변경 대상: ${targetLabel}` : null,
    `세션 #${candidate.sessionId}`,
    candidate.chatMessageId ? `메시지 #${candidate.chatMessageId}` : null,
    candidate.feedbackId ? `피드백 #${candidate.feedbackId}` : null,
  ].filter((item): item is string => Boolean(item));

  return {
    kind: "ready",
    operation: firstPatchText(patch.operation) ?? "작업 미지정",
    targetLabel: targetLabel || candidateTargetLabel(candidate),
    changes,
    evidence,
    impactItems,
    rawJson: formatDraftPatchRaw(raw),
  };
}

function usesStructuralReview(candidate: SimulationImprovementCandidate): boolean {
  const kind = buildStructuralPatchReview(candidate).kind;
  return kind === "structural" || kind === "invalid";
}

function canApproveCandidate(
  candidate: SimulationImprovementCandidate,
  confirmed: boolean,
): boolean {
  if (usesStructuralReview(candidate)) {
    const model = buildStructuralPatchReview(candidate);
    return evaluateApprovalGuardrail(model, confirmed).canApprove;
  }
  return confirmed && buildCandidatePatchReview(candidate).kind === "ready";
}

function candidatePatchConfirmationKey(
  candidate: SimulationImprovementCandidate,
): string {
  return `${candidate.id}:${candidate.draftPatchJson ?? ""}`;
}

function candidateApprovalGuide(
  candidate: SimulationImprovementCandidate,
): string {
  const versionPart = candidate.appliedDomainPackVersionId
    ? `적용 version #${candidate.appliedDomainPackVersionId}`
    : "적용 version 응답 대기";
  const reviewPart =
    candidate.reviewSessionId || candidate.reviewTaskId
      ? [
          candidate.reviewSessionId
            ? `review session #${candidate.reviewSessionId}`
            : null,
          candidate.reviewTaskId
            ? `review task #${candidate.reviewTaskId}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : "review 대상은 응답에 포함되지 않았습니다";
  return `${versionPart} · ${reviewPart}. 변경 확인 후 검증 케이스 replay로 재검증하세요.`;
}

export function WorkspaceSimulationPage() {
  const { workspaceId } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.toString();
  const querySearchParams = useMemo(
    () => new URLSearchParams(searchQuery),
    [searchQuery],
  );
  const querySimulationTarget = useMemo(
    () => readSimulationTargetFromSearch(querySearchParams),
    [querySearchParams],
  );
  const stateSimulationTarget = useMemo(
    () => readSimulationTargetFromState(location.state),
    [location.state],
  );
  const simulationTarget = querySimulationTarget ?? stateSimulationTarget;
  const feedbackStatusFromQuery = useMemo(
    () => readFeedbackStatusParam(querySearchParams),
    [querySearchParams],
  );
  const candidateStatusFromQuery = useMemo(
    () => readCandidateStatusParam(querySearchParams),
    [querySearchParams],
  );
  const parsedWorkspaceId = parseRouteId(workspaceId);
  const { setCrumbs } = useOutletContext<ShellContext>();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [detail, setDetail] = useState<SimulationSessionDetail | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(
    null,
  );
  const [customerNameInput, setCustomerNameInput] = useState("시뮬레이션 고객");
  const [workflowDefinitionId, setWorkflowDefinitionId] = useState("");
  const [workflowSelectionTouched, setWorkflowSelectionTouched] =
    useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [feedbackItems, setFeedbackItems] = useState<SimulationFeedback[]>([]);
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState<
    SimulationFeedbackStatus | ""
  >(() => feedbackStatusFromQuery);
  const [candidateItems, setCandidateItems] = useState<
    SimulationImprovementCandidate[]
  >([]);
  const [goldenCases, setGoldenCases] = useState<SimulationGoldenCase[]>([]);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [goldenCaseError, setGoldenCaseError] = useState<string | null>(null);
  const [candidateStatusFilter, setCandidateStatusFilter] = useState<
    SimulationImprovementCandidateStatus | ""
  >(() => candidateStatusFromQuery);
  const [activeSideTab, setActiveSideTab] = useState<SimulationSideTab>(() =>
    readInitialSideTab(querySearchParams),
  );
  const [feedbackTarget, setFeedbackTarget] = useState("session");
  const [feedbackType, setFeedbackType] = useState<SimulationFeedbackType>(
    DEFAULT_FEEDBACK_TYPE,
  );
  const [feedbackSeverity, setFeedbackSeverity] =
    useState<SimulationFeedbackSeverity>(DEFAULT_FEEDBACK_SEVERITY);
  const [feedbackDescription, setFeedbackDescription] = useState("");
  const [feedbackExpectedBehavior, setFeedbackExpectedBehavior] = useState("");
  const [goldenCaseName, setGoldenCaseName] = useState("");
  const [expectedIntentCode, setExpectedIntentCode] = useState("");
  const [expectedWorkflowCode, setExpectedWorkflowCode] = useState("");
  const [expectedCurrentState, setExpectedCurrentState] = useState("");
  const [expectedActionType, setExpectedActionType] = useState("");
  const [expectedSlotValuesJson, setExpectedSlotValuesJson] = useState("{}");
  const [replayVersionId, setReplayVersionId] = useState("");
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [isLoadingGoldenCases, setIsLoadingGoldenCases] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [isCreatingGoldenCase, setIsCreatingGoldenCase] = useState(false);
  const [replayingGoldenCaseId, setReplayingGoldenCaseId] = useState<
    number | null
  >(null);
  const [creatingCandidateId, setCreatingCandidateId] = useState<number | null>(
    null,
  );
  const [candidateTargetSelections, setCandidateTargetSelections] = useState<
    Record<number, SimulationImprovementCandidateTargetType>
  >({});
  const [updatingCandidateId, setUpdatingCandidateId] = useState<number | null>(
    null,
  );
  const [candidateRejectReasons, setCandidateRejectReasons] = useState<
    Record<number, string>
  >({});
  const [confirmedCandidatePatchKeys, setConfirmedCandidatePatchKeys] =
    useState<ReadonlySet<string>>(() => new Set());
  const [candidateApprovalNotice, setCandidateApprovalNotice] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const workflows = useListAllWorkspaceWorkflows({
    workspaceId: parsedWorkspaceId,
  });
  const targetWorkflow = useMemo(
    () => findTargetWorkflow(workflows.entries, simulationTarget),
    [simulationTarget, workflows.entries],
  );
  const selectedWorkflow = useMemo(() => {
    const numericId = Number(workflowDefinitionId);
    return (
      workflows.entries.find((entry) => entry.workflowId === numericId) ?? null
    );
  }, [workflowDefinitionId, workflows.entries]);
  const candidateWorkflowTarget =
    useMemo<CandidateWorkflowTarget | null>(() => {
      if (detail?.matchedWorkflow?.workflowDefinitionId) {
        return {
          workflowId: detail.matchedWorkflow.workflowDefinitionId,
          workflowCode: detail.matchedWorkflow.workflowCode ?? null,
          workflowName:
            detail.matchedWorkflow.workflowName ??
            detail.matchedWorkflow.workflowCode ??
            `Workflow #${detail.matchedWorkflow.workflowDefinitionId}`,
        };
      }

      if (selectedWorkflow) {
        return {
          workflowId: selectedWorkflow.workflowId,
          workflowCode: selectedWorkflow.workflowCode,
          workflowName: selectedWorkflow.name,
        };
      }

      if (targetWorkflow) {
        return {
          workflowId: targetWorkflow.workflowId,
          workflowCode: targetWorkflow.workflowCode,
          workflowName: targetWorkflow.name,
        };
      }

      if (simulationTarget?.workflowId) {
        return {
          workflowId: simulationTarget.workflowId,
          workflowCode: null,
          workflowName: `Workflow #${simulationTarget.workflowId}`,
        };
      }

      return null;
    }, [
      detail?.matchedWorkflow,
      selectedWorkflow,
      simulationTarget,
      targetWorkflow,
    ]);
  const matched = detail?.matchedWorkflow ?? null;
  // 기대 intent 자동완성 옵션을 위해 시뮬레이션 대상 도메인팩 버전의 intent 목록을 불러온다. 세션의
  // matchedWorkflow 버전을 우선 사용하고, 없으면 시작 target/워크스페이스 워크플로우에서 pack·version을 찾는다.
  const intentLookupSource = useMemo(() => {
    const versionId =
      matched?.domainPackVersionId ?? simulationTarget?.versionId ?? null;
    const entry =
      workflows.entries.find((wf) => wf.versionId === versionId) ??
      workflows.entries[0] ??
      null;
    return entry ? { packId: entry.packId, versionId: entry.versionId } : null;
  }, [
    matched?.domainPackVersionId,
    simulationTarget?.versionId,
    workflows.entries,
  ]);
  const workspaceIntents = useListIntents(
    parsedWorkspaceId ?? -1,
    intentLookupSource?.packId ?? -1,
    intentLookupSource?.versionId ?? -1,
    {
      query: {
        enabled: parsedWorkspaceId !== null && intentLookupSource !== null,
      },
    },
  );
  const expectedWorkflowOptions = useMemo(() => {
    const codes = new Set<string>();
    workflows.entries.forEach((entry) => {
      if (entry.workflowCode) codes.add(entry.workflowCode);
    });
    if (matched?.workflowCode) codes.add(matched.workflowCode);
    return Array.from(codes);
  }, [workflows.entries, matched?.workflowCode]);
  const expectedStateOptions = useMemo(() => {
    const states = new Set<string>();
    safeParseGraph(matched?.graphJson).nodes.forEach((node) =>
      states.add(node.id),
    );
    if (matched?.currentState) states.add(matched.currentState);
    return Array.from(states);
  }, [matched?.graphJson, matched?.currentState]);
  const expectedIntentOptions = useMemo(() => {
    const codes = new Set<string>();
    selectApiList<IntentDefinitionSummary>(workspaceIntents.data).forEach(
      (intent) => {
        if (intent.intentCode) codes.add(intent.intentCode);
      },
    );
    if (matched?.intentCode) codes.add(matched.intentCode);
    return Array.from(codes);
  }, [workspaceIntents.data, matched?.intentCode]);
  const currentIntentCode =
    matched?.intentCode ?? selectedIntentCode(detail?.session ?? null);
  const currentIntentLabel = matched?.intentName ?? currentIntentCode;
  const isTargetContextConfirmed = matchesTargetContext(
    targetWorkflow,
    simulationTarget,
  );
  const targetPackLabel =
    (isTargetContextConfirmed ? targetWorkflow?.packName : null) ??
    (simulationTarget
      ? `Pack ${formatTargetId(simulationTarget.packId, "미지정")}`
      : "");
  const targetVersionLabel = simulationTarget
    ? `Version ${formatTargetId(simulationTarget.versionId, "미지정")}`
    : "";
  const targetWorkflowLabel =
    targetWorkflow?.name ??
    (simulationTarget
      ? `Workflow ${formatTargetId(simulationTarget.workflowId, "미지정")}`
      : "");
  const targetWorkflowMeta =
    targetWorkflow?.workflowCode ??
    (simulationTarget?.workflowId
      ? `workflowId ${simulationTarget.workflowId}`
      : "자동 매칭");

  const reloadFeedback = async (status = feedbackStatusFilter) => {
    if (parsedWorkspaceId === null) return;
    setFeedbackError(null);
    try {
      const page = await simulationApi.listFeedback(parsedWorkspaceId, {
        status,
        page: 0,
        size: PAGE_SIZE,
      });
      setFeedbackItems(page.content);
    } catch (error) {
      console.error("Failed to load simulation feedback list:", error);
      setFeedbackItems([]);
      setFeedbackError(FEEDBACK_LIST_ERROR);
      throw error;
    }
  };

  const reloadCandidates = async (status = candidateStatusFilter) => {
    if (parsedWorkspaceId === null) return;
    setCandidateError(null);
    try {
      const page = await simulationApi.listImprovementCandidates(
        parsedWorkspaceId,
        {
          status,
          page: 0,
          size: PAGE_SIZE,
        },
      );
      setCandidateItems(page.content);
    } catch (error) {
      console.error("Failed to load simulation improvement candidates:", error);
      setCandidateItems([]);
      setCandidateError(CANDIDATE_LIST_ERROR);
      throw error;
    }
  };

  const reloadGoldenCases = async () => {
    if (parsedWorkspaceId === null) return;
    setGoldenCaseError(null);
    try {
      const page = await simulationApi.listGoldenCases(parsedWorkspaceId, {
        page: 0,
        size: PAGE_SIZE,
      });
      setGoldenCases(page.content);
    } catch (error) {
      console.error("Failed to load simulation golden cases:", error);
      setGoldenCases([]);
      setGoldenCaseError(GOLDEN_CASE_LIST_ERROR);
      throw error;
    }
  };

  const reloadFeedbackAndCandidates = async () => {
    await Promise.allSettled([reloadFeedback(), reloadCandidates()]);
  };

  useEffect(() => {
    setCrumbs(["시뮬레이션"]);
    return () => setCrumbs([]);
  }, [setCrumbs]);

  useEffect(() => {
    setFeedbackStatusFilter(feedbackStatusFromQuery);
    setCandidateStatusFilter(candidateStatusFromQuery);
    setActiveSideTab(readInitialSideTab(querySearchParams));
  }, [candidateStatusFromQuery, feedbackStatusFromQuery, querySearchParams]);

  useEffect(() => {
    if (!simulationTarget?.workflowId || workflowSelectionTouched) return;
    setWorkflowDefinitionId(String(simulationTarget.workflowId));
  }, [simulationTarget?.workflowId, workflowSelectionTouched]);

  useEffect(() => {
    setFeedbackTarget("session");
    setFeedbackType(DEFAULT_FEEDBACK_TYPE);
    setFeedbackSeverity(DEFAULT_FEEDBACK_SEVERITY);
    setFeedbackDescription("");
    setFeedbackExpectedBehavior("");
  }, [selectedSessionId]);

  useEffect(() => {
    if (detail?.session) {
      setGoldenCaseName(`${customerName(detail.session)} 검증 케이스`);
      setExpectedIntentCode(
        detail.matchedWorkflow?.intentCode ??
          selectedIntentCode(detail.session) ??
          "",
      );
      setExpectedWorkflowCode(detail.matchedWorkflow?.workflowCode ?? "");
      setExpectedCurrentState(detail.matchedWorkflow?.currentState ?? "");
      setExpectedSlotValuesJson(stringifySlotValues(detail.slotValues));
      setReplayVersionId(
        String(
          simulationTarget?.versionId ??
            detail.matchedWorkflow?.domainPackVersionId ??
            "",
        ),
      );
      setExpectedActionType(inferExpectedActionType(detail));
    } else {
      setGoldenCaseName("");
      setExpectedIntentCode("");
      setExpectedWorkflowCode("");
      setExpectedCurrentState("");
      setExpectedSlotValuesJson("{}");
      setReplayVersionId("");
      setExpectedActionType("");
    }
  }, [detail, simulationTarget?.versionId]);

  useEffect(() => {
    if (parsedWorkspaceId === null) return;

    let active = true;
    setIsLoadingSessions(true);
    setError(null);
    simulationApi
      .listSessions(parsedWorkspaceId, { page: 0, size: PAGE_SIZE })
      .then((page) => {
        if (!active) return;
        setSessions(page.content);
        if (selectedSessionId === null && page.content[0]?.id) {
          setSelectedSessionId(page.content[0].id);
        }
      })
      .catch(() => {
        if (!active) return;
        setError("시뮬레이션 세션 목록을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setIsLoadingSessions(false);
      });

    return () => {
      active = false;
    };
  }, [parsedWorkspaceId, selectedSessionId]);

  useEffect(() => {
    if (parsedWorkspaceId === null) return;

    let active = true;
    setIsLoadingFeedback(true);
    setFeedbackError(null);
    simulationApi
      .listFeedback(parsedWorkspaceId, {
        status: feedbackStatusFilter,
        page: 0,
        size: PAGE_SIZE,
      })
      .then((page) => {
        if (active) setFeedbackItems(page.content);
      })
      .catch((error) => {
        if (!active) return;
        console.error("Failed to load simulation feedback list:", error);
        setFeedbackItems([]);
        setFeedbackError(FEEDBACK_LIST_ERROR);
      })
      .finally(() => {
        if (active) setIsLoadingFeedback(false);
      });

    return () => {
      active = false;
    };
  }, [feedbackStatusFilter, parsedWorkspaceId]);

  useEffect(() => {
    if (parsedWorkspaceId === null) return;

    let active = true;
    setIsLoadingCandidates(true);
    setCandidateError(null);
    simulationApi
      .listImprovementCandidates(parsedWorkspaceId, {
        status: candidateStatusFilter,
        page: 0,
        size: PAGE_SIZE,
      })
      .then((page) => {
        if (active) setCandidateItems(page.content);
      })
      .catch((error) => {
        if (!active) return;
        console.error(
          "Failed to load simulation improvement candidates:",
          error,
        );
        setCandidateItems([]);
        setCandidateError(CANDIDATE_LIST_ERROR);
      })
      .finally(() => {
        if (active) setIsLoadingCandidates(false);
      });

    return () => {
      active = false;
    };
  }, [candidateStatusFilter, parsedWorkspaceId]);

  useEffect(() => {
    if (parsedWorkspaceId === null) return;

    let active = true;
    setIsLoadingGoldenCases(true);
    setGoldenCaseError(null);
    simulationApi
      .listGoldenCases(parsedWorkspaceId, { page: 0, size: PAGE_SIZE })
      .then((page) => {
        if (active) setGoldenCases(page.content);
      })
      .catch((error) => {
        if (!active) return;
        console.error("Failed to load simulation golden cases:", error);
        setGoldenCases([]);
        setGoldenCaseError(GOLDEN_CASE_LIST_ERROR);
      })
      .finally(() => {
        if (active) setIsLoadingGoldenCases(false);
      });

    return () => {
      active = false;
    };
  }, [parsedWorkspaceId]);

  useEffect(() => {
    if (parsedWorkspaceId === null || selectedSessionId === null) {
      setDetail(null);
      return;
    }

    let active = true;
    // 세션을 전환하면 이전 세션의 Runtime State/기대값이 잔존하지 않도록 즉시 비운 뒤 다시 불러온다.
    setDetail(null);
    setIsLoadingDetail(true);
    setError(null);
    simulationApi
      .getSession(parsedWorkspaceId, selectedSessionId)
      .then((nextDetail) => {
        if (active) setDetail(nextDetail);
      })
      .catch(() => {
        if (active) setError("시뮬레이션 세션 상세를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setIsLoadingDetail(false);
      });

    return () => {
      active = false;
    };
  }, [parsedWorkspaceId, selectedSessionId]);

  if (parsedWorkspaceId === null) {
    return <Navigate to="/workspaces" replace />;
  }

  const reloadSessions = async () => {
    const page = await simulationApi.listSessions(parsedWorkspaceId, {
      page: 0,
      size: PAGE_SIZE,
    });
    setSessions(page.content);
  };

  const handleCreateSession = async () => {
    setIsCreating(true);
    setError(null);
    try {
      const workflowIdForSession = workflowDefinitionId
        ? Number(workflowDefinitionId)
        : !workflowSelectionTouched && simulationTarget?.workflowId
          ? simulationTarget.workflowId
          : null;
      const created = await simulationApi.createSession(parsedWorkspaceId, {
        customerName: customerNameInput,
        ...(workflowIdForSession
          ? {
              workflowDefinitionId: workflowIdForSession,
            }
          : {}),
      });
      setDetail(created);
      setSelectedSessionId(created.session.id ?? null);
      toast.success("새 시뮬레이션 세션을 만들었습니다.");
      await reloadSessions().catch(() => {
        toast.error("세션 목록을 새로고침하지 못했습니다.");
      });
    } catch (err) {
      toast.error(
        err instanceof ApiRequestError
          ? `시뮬레이션 세션을 만들지 못했습니다: ${err.message}`
          : "시뮬레이션 세션을 만들지 못했습니다.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendMessage = async () => {
    const content = messageInput.trim();
    if (!content || detail?.session.id == null) return;
    setIsSending(true);
    setError(null);
    try {
      const nextDetail = await simulationApi.sendMessage(
        parsedWorkspaceId,
        detail.session.id,
        {
          content,
        },
      );
      setDetail(nextDetail);
      setMessageInput("");
      await reloadSessions();
    } catch {
      toast.error("시뮬레이션 메시지 응답을 생성하지 못했습니다.");
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmitFeedbackAndCreateCandidate = async () => {
    const description = feedbackDescription.trim();
    const expectedBehavior = feedbackExpectedBehavior.trim();
    if (!description || !expectedBehavior || detail?.session.id == null) return;
    const chatMessageId =
      feedbackTarget === "session" ? null : Number.parseInt(feedbackTarget, 10);
    const existingFeedbackIds = new Set(
      (detail.feedback?.items ?? []).map((item) => item.id),
    );
    setIsSubmittingFeedback(true);
    try {
      const nextDetail = await simulationApi.createFeedback(
        parsedWorkspaceId,
        detail.session.id,
        {
          chatMessageId: Number.isNaN(chatMessageId) ? null : chatMessageId,
          feedbackType,
          description,
          expectedBehavior,
          severity: feedbackSeverity,
        },
      );
      setDetail(nextDetail);
      setFeedbackDescription("");
      setFeedbackExpectedBehavior("");
      toast.success("시뮬레이션 피드백을 남겼습니다.");
      await reloadFeedbackAndCandidates();

      const newFeedback = nextDetail.feedback?.items?.find(
        (item) => !existingFeedbackIds.has(item.id),
      );
      if (newFeedback) {
        const resolvedIntentCode =
          detail?.matchedWorkflow?.intentCode ??
          selectedIntentCode(detail?.session ?? null);
        try {
          const targetType = inferCandidateTargetType(newFeedback.feedbackType);
          const payload = buildCandidateTargetPayload(
            newFeedback,
            targetType,
            candidateWorkflowTarget,
            resolvedIntentCode,
          );
          const candidate = await simulationApi.createImprovementCandidate(
            parsedWorkspaceId,
            newFeedback.id,
            payload,
          );
          await simulationApi.updateImprovementCandidateStatus(
            parsedWorkspaceId,
            candidate.id,
            { status: "READY_FOR_REVIEW" },
          );
          toast.success("리뷰 대기 개선 후보로 등록했습니다.");
          setActiveSideTab("candidates");
          await reloadFeedbackAndCandidates();
        } catch (candidateError) {
          console.error(
            "Failed to auto-create improvement candidate:",
            candidateError,
          );
          toast.error(
            "개선 후보 자동 등록에 실패했습니다. 피드백 목록에서 직접 후보를 생성하세요.",
          );
        }
      }
    } catch {
      toast.error("시뮬레이션 피드백을 저장하지 못했습니다.");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleCreateCandidate = async (feedback: SimulationFeedback) => {
    setCreatingCandidateId(feedback.id);
    try {
      const targetType =
        candidateTargetSelections[feedback.id] ??
        inferCandidateTargetType(feedback.feedbackType);
      const payload = buildCandidateTargetPayload(
        feedback,
        targetType,
        candidateWorkflowTarget,
        detail?.matchedWorkflow?.intentCode ??
          selectedIntentCode(detail?.session ?? null),
      );
      await simulationApi.createImprovementCandidate(
        parsedWorkspaceId,
        feedback.id,
        payload,
      );
      toast.success("개선 후보를 생성했습니다.");
      setActiveSideTab("candidates");
      await reloadFeedbackAndCandidates();
    } catch {
      toast.error("개선 후보를 생성하지 못했습니다.");
    } finally {
      setCreatingCandidateId(null);
    }
  };

  const handleCandidateStatusChange = async (
    candidate: SimulationImprovementCandidate,
    status: SimulationImprovementCandidateStatus,
  ) => {
    setUpdatingCandidateId(candidate.id);
    try {
      await simulationApi.updateImprovementCandidateStatus(
        parsedWorkspaceId,
        candidate.id,
        {
          status,
        },
      );
      toast.success("개선 후보 상태를 변경했습니다.");
      await reloadCandidates().catch(() => undefined);
    } catch {
      toast.error("개선 후보 상태를 변경하지 못했습니다.");
    } finally {
      setUpdatingCandidateId(null);
    }
  };

  const handleApproveCandidate = async (
    candidate: SimulationImprovementCandidate,
  ) => {
    setUpdatingCandidateId(candidate.id);
    try {
      const approved = await simulationApi.approveImprovementCandidate(
        parsedWorkspaceId,
        candidate.id,
        {
          reason: "시뮬레이션 리뷰 승인",
        },
      );
      const guide = candidateApprovalGuide({
        ...approved,
        reviewSessionId: approved.reviewSessionId ?? candidate.reviewSessionId,
        reviewTaskId: approved.reviewTaskId ?? candidate.reviewTaskId,
      });
      setCandidateApprovalNotice(guide);
      toast.success(`개선 후보를 초안 버전에 반영했습니다. ${guide}`);
      await reloadFeedbackAndCandidates();
    } catch {
      toast.error("개선 후보를 승인하지 못했습니다.");
    } finally {
      setUpdatingCandidateId(null);
    }
  };

  const handleConfirmCandidatePatch = (
    candidate: SimulationImprovementCandidate,
  ) => {
    const confirmationKey = candidatePatchConfirmationKey(candidate);
    setConfirmedCandidatePatchKeys((current) => {
      const next = new Set(current);
      if (next.has(confirmationKey)) {
        next.delete(confirmationKey);
      } else {
        next.add(confirmationKey);
      }
      return next;
    });
  };

  const handleReplayAppliedVersion = (versionId: number) => {
    setReplayVersionId(String(versionId));
    setActiveSideTab("state");
    toast.success(
      `검증 케이스에서 version #${versionId} 기준으로 Replay를 실행하세요.`,
    );
  };

  const handleRejectCandidate = async (
    candidate: SimulationImprovementCandidate,
  ) => {
    const reason = (candidateRejectReasons[candidate.id] ?? "").trim();
    if (!reason) {
      toast.error("반려 사유를 입력하세요.");
      return;
    }
    setUpdatingCandidateId(candidate.id);
    try {
      await simulationApi.rejectImprovementCandidate(
        parsedWorkspaceId,
        candidate.id,
        { reason },
      );
      toast.success("개선 후보를 반려했습니다.");
      setCandidateRejectReasons((current) => {
        const next = { ...current };
        delete next[candidate.id];
        return next;
      });
      await reloadFeedbackAndCandidates();
    } catch {
      toast.error("개선 후보를 반려하지 못했습니다.");
    } finally {
      setUpdatingCandidateId(null);
    }
  };

  const handleCreateGoldenCase = async () => {
    if (detail?.session.id == null) return;
    if (
      messages.filter(
        (message) =>
          message.senderRole === "USER" || message.senderRole === "CUSTOMER",
      ).length === 0
    ) {
      toast.error("고객 메시지가 있어야 검증 케이스로 저장할 수 있습니다.");
      return;
    }
    const expectedIntent = expectedIntentCode.trim();
    const expectedWorkflow = expectedWorkflowCode.trim();
    const expectedState = expectedCurrentState.trim();
    const expectedAction = expectedActionType.trim();
    if (!expectedIntent || !expectedWorkflow || !expectedAction) {
      toast.error("기대 intent, workflow, action을 확인하세요.");
      return;
    }
    let expectedSlotValues: Record<string, unknown>;
    try {
      const parsedSlotValues = parseSlotValuesInput(expectedSlotValuesJson);
      if (parsedSlotValues === null) {
        toast.error("필수 slot은 JSON 객체로 입력하세요.");
        return;
      }
      expectedSlotValues = parsedSlotValues;
    } catch {
      toast.error("필수 slot JSON 형식을 확인하세요.");
      return;
    }
    setIsCreatingGoldenCase(true);
    try {
      await simulationApi.createGoldenCase(
        parsedWorkspaceId,
        detail.session.id,
        {
          name: optionalText(goldenCaseName),
          expectedIntentCode: expectedIntent,
          expectedWorkflowCode: expectedWorkflow,
          expectedCurrentState: optionalText(expectedState),
          expectedActionType: expectedAction,
          expectedSlotValues,
        },
      );
      toast.success("검증 케이스를 저장했습니다.");
      await reloadGoldenCases().catch(() => undefined);
    } catch {
      toast.error("검증 케이스를 저장하지 못했습니다.");
    } finally {
      setIsCreatingGoldenCase(false);
    }
  };

  const handleReplayGoldenCase = async (goldenCase: SimulationGoldenCase) => {
    const versionId = Number.parseInt(replayVersionId, 10);
    if (!Number.isFinite(versionId) || versionId <= 0) {
      toast.error("Replay version을 입력하세요.");
      return;
    }
    setReplayingGoldenCaseId(goldenCase.id);
    try {
      const result = await simulationApi.replayGoldenCase(
        parsedWorkspaceId,
        goldenCase.id,
        {
          domainPackVersionId: versionId,
        },
      );
      if (result.status === "PASS") {
        toast.success("검증 케이스 replay가 통과했습니다.");
      } else {
        toast.error(
          result.failureSummary
            ? `검증 케이스 replay가 실패했습니다: ${result.failureSummary}`
            : "검증 케이스 replay가 실패했습니다.",
        );
      }
      await reloadGoldenCases().catch(() => undefined);
    } catch {
      toast.error("검증 케이스 replay를 실행하지 못했습니다.");
    } finally {
      setReplayingGoldenCaseId(null);
    }
  };

  const messages = detail?.messages ?? [];
  const slots = slotEntries(detail);
  const feedbackCounts = detail?.feedback?.messageFeedbackCounts ?? {};
  const selectedFeedbackTarget = messages.find(
    (message) => String(message.id) === feedbackTarget,
  );
  const selectedTargetLabel =
    feedbackTarget === "session"
      ? "세션 전체"
      : `Turn ${selectedFeedbackTarget?.seqNo ?? ""}`;

  return (
    <div className={styles.pageWrapper}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Simulation Lab</p>
          <h1 className={styles.pageTitle}>상담 시뮬레이션</h1>
          <p className={styles.pageSubtitle}>
            운영 중인 Domain Pack 기준으로 고객 문의를 시험하고 매칭된 workflow
            상태를 확인합니다.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void reloadSessions().catch(() => {
              toast.error("시뮬레이션 세션 목록을 새로고침하지 못했습니다.");
            });
          }}
          disabled={isLoadingSessions}
        >
          <RefreshCwIcon className={styles.buttonIcon} />
          <span>새로고침</span>
        </Button>
      </header>

      {error ? <ErrorState message={error} /> : null}

      {simulationTarget ? (
        <section
          className={styles.targetBanner}
          aria-labelledby="simulation-target-title"
        >
          <div>
            <p className={styles.eyebrow}>Verification Target</p>
            <h2 id="simulation-target-title">{targetWorkflowLabel}</h2>
            <p>
              {targetPackLabel} · {targetVersionLabel} · {targetWorkflowMeta}
            </p>
          </div>
          <span className={styles.targetBadge}>
            {isTargetContextConfirmed ? "대상 확인됨" : "대상 ID 유지"}
          </span>
        </section>
      ) : null}

      <section
        className={styles.createPanel}
        aria-labelledby="simulation-create-title"
      >
        <div>
          <h2 id="simulation-create-title" className={styles.sectionTitle}>
            새 시뮬레이션
          </h2>
          <p className={styles.sectionDescription}>
            workflow를 비워두면 첫 고객 메시지를 기준으로 intent를 매칭합니다.
          </p>
        </div>
        <label className={styles.field}>
          <span>시뮬레이션 이름</span>
          <input
            value={customerNameInput}
            onChange={(event) => setCustomerNameInput(event.target.value)}
            maxLength={100}
          />
        </label>
        <label className={styles.field}>
          <span>시작 workflow</span>
          <NativeSelect
            value={workflowDefinitionId}
            onChange={(event) => {
              setWorkflowSelectionTouched(true);
              setWorkflowDefinitionId(event.target.value);
            }}
            aria-label="시작 workflow 선택"
          >
            <NativeSelectOption value="">자동 매칭</NativeSelectOption>
            {simulationTarget?.workflowId && !targetWorkflow ? (
              <NativeSelectOption value={String(simulationTarget.workflowId)}>
                {targetWorkflowLabel}
              </NativeSelectOption>
            ) : null}
            {workflows.entries.map((workflow) => (
              <NativeSelectOption
                key={workflow.workflowId}
                value={String(workflow.workflowId)}
              >
                {workflow.packName} · {workflow.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <Button
          type="button"
          onClick={handleCreateSession}
          disabled={isCreating}
        >
          <PlusIcon className={styles.buttonIcon} />
          <span>{isCreating ? "생성 중" : "세션 생성"}</span>
        </Button>
      </section>

      <div className={styles.labGrid}>
        <aside className={styles.sessionPane} aria-label="시뮬레이션 세션 목록">
          <div className={styles.paneHeader}>
            <h2 className={styles.sectionTitle}>세션</h2>
            <span className={styles.countBadge}>{sessions.length}</span>
          </div>
          {isLoadingSessions ? (
            <div className={styles.statePanel}>
              <LoadingSpinner />
              <p>세션을 불러오는 중입니다.</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className={styles.statePanel}>
              <EmptyState message="아직 시뮬레이션 세션이 없습니다." />
            </div>
          ) : (
            <div className={styles.sessionList}>
              {sessions.map((session) => {
                const selected = session.id === selectedSessionId;
                return (
                  <button
                    key={session.id}
                    type="button"
                    className={`${styles.sessionItem} ${selected ? styles.sessionItemSelected : ""}`}
                    onClick={() => setSelectedSessionId(session.id ?? null)}
                  >
                    <span>{customerName(session)}</span>
                    <small>
                      {session.status} · {formatTime(session.startedAt)}
                    </small>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <section className={styles.chatPane} aria-label="시뮬레이션 대화">
          <div className={styles.paneHeader}>
            <div>
              <h2 className={styles.sectionTitle}>
                {customerName(detail?.session ?? null)}
              </h2>
              <p className={styles.sectionDescription}>
                {selectedWorkflow?.name ??
                  targetWorkflow?.name ??
                  (simulationTarget?.workflowId
                    ? `Workflow #${simulationTarget.workflowId}`
                    : "자동 매칭")}{" "}
                기준으로 응답합니다.
              </p>
            </div>
            <span className={styles.channelBadge}>SIMULATION</span>
          </div>

          {isLoadingDetail ? (
            <div className={styles.statePanel}>
              <LoadingSpinner />
              <p>대화를 불러오는 중입니다.</p>
            </div>
          ) : detail === null ? (
            <div className={styles.statePanel}>
              <EmptyState message="세션을 선택하거나 새 세션을 생성하세요." />
            </div>
          ) : (
            <>
              <div className={styles.messageList}>
                {messages.length === 0 ? (
                  <p className={styles.emptyMessage}>
                    고객 메시지를 입력하면 응답이 생성됩니다.
                  </p>
                ) : (
                  messages.map((message, index) => (
                    <MessageBubble
                      key={
                        message.id ??
                        `${message.seqNo ?? index}-${message.createdAt ?? ""}`
                      }
                      message={message}
                      feedbackCount={
                        message.id
                          ? (feedbackCounts[String(message.id)] ?? 0)
                          : 0
                      }
                      onFeedbackClick={
                        message.id
                          ? () => {
                              setFeedbackTarget(String(message.id));
                              setActiveSideTab("feedback");
                            }
                          : undefined
                      }
                    />
                  ))
                )}
              </div>
              <div className={styles.composer}>
                <textarea
                  value={messageInput}
                  onChange={(event) => setMessageInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.nativeEvent.isComposing) return;
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSendMessage();
                    }
                  }}
                  placeholder="고객 역할 메시지 입력"
                  rows={3}
                />
                <Button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={isSending || !messageInput.trim()}
                >
                  <SendIcon className={styles.buttonIcon} />
                  <span>{isSending ? "응답 생성 중" : "전송"}</span>
                </Button>
              </div>
            </>
          )}
        </section>

        <aside
          className={styles.statePane}
          aria-label="시뮬레이션 상태와 개선 작업"
        >
          <div
            className={styles.sideTabList}
            role="tablist"
            aria-label="시뮬레이션 우측 패널"
          >
            {SIDE_TABS.map((tab) => (
              <button
                key={tab.value}
                id={`simulation-side-tab-${tab.value}`}
                type="button"
                role="tab"
                aria-selected={activeSideTab === tab.value}
                aria-controls={`simulation-side-panel-${tab.value}`}
                className={`${styles.sideTab} ${activeSideTab === tab.value ? styles.sideTabActive : ""}`}
                onClick={() => setActiveSideTab(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeSideTab === "state" ? (
            <div
              id="simulation-side-panel-state"
              className={styles.sideTabPanel}
              role="tabpanel"
              aria-labelledby="simulation-side-tab-state"
            >
              <h2 className={styles.sectionTitle}>Runtime State</h2>
              <dl className={styles.stateList}>
                <div>
                  <dt>Intent</dt>
                  <dd>{currentIntentLabel ?? "미매칭"}</dd>
                </div>
                <div>
                  <dt>Workflow</dt>
                  <dd>
                    {matched?.workflowName ?? matched?.workflowCode ?? "미매칭"}
                  </dd>
                </div>
                <div>
                  <dt>Current State</dt>
                  <dd>{matched?.currentState ?? "대기"}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    {matched?.executionStatus ??
                      detail?.session.status ??
                      "대기"}
                  </dd>
                </div>
              </dl>

              <div className={styles.slotPanel}>
                <h3>수집된 Slot</h3>
                {slots.length === 0 ? (
                  <p>아직 수집된 slot 값이 없습니다.</p>
                ) : (
                  <ul>
                    {slots.map(([key, value]) => (
                      <li key={key}>
                        <span>{key}</span>
                        <strong>{String(value)}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className={styles.goldenCasePanel}>
                <div className={styles.feedbackPanelHeader}>
                  <h3>검증 케이스</h3>
                  <span>{goldenCases.length}</span>
                </div>
                <label className={styles.feedbackField}>
                  <span>이름</span>
                  <input
                    value={goldenCaseName}
                    onChange={(event) => setGoldenCaseName(event.target.value)}
                    maxLength={255}
                    aria-label="검증 케이스 이름"
                  />
                </label>
                <div className={styles.goldenCaseSnapshot}>
                  <div className={styles.feedbackPanelHeader}>
                    <h4>현재 실행 결과</h4>
                    <span>제안값</span>
                  </div>
                  <dl>
                    <div>
                      <dt>Intent</dt>
                      <dd>{displayText(currentIntentCode)}</dd>
                    </div>
                    <div>
                      <dt>Workflow</dt>
                      <dd>
                        {displayText(
                          matched?.workflowCode ?? matched?.workflowName,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>State</dt>
                      <dd>{displayText(matched?.currentState)}</dd>
                    </div>
                    <div>
                      <dt>Action</dt>
                      <dd>직접 선택</dd>
                    </div>
                  </dl>
                </div>
                <div className={styles.goldenCaseExpected}>
                  <div className={styles.feedbackPanelHeader}>
                    <h4>기대 결과</h4>
                    <span>저장 전 확인</span>
                  </div>
                  <label className={styles.feedbackField}>
                    <span>기대 intent</span>
                    <input
                      value={expectedIntentCode}
                      onChange={(event) =>
                        setExpectedIntentCode(event.target.value)
                      }
                      maxLength={255}
                      aria-label="기대 intent"
                      list="expected-intent-options"
                    />
                    <datalist id="expected-intent-options">
                      {expectedIntentOptions.map((option) => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                  </label>
                  <label className={styles.feedbackField}>
                    <span>기대 workflow</span>
                    <input
                      value={expectedWorkflowCode}
                      onChange={(event) =>
                        setExpectedWorkflowCode(event.target.value)
                      }
                      maxLength={255}
                      aria-label="기대 workflow"
                      list="expected-workflow-options"
                    />
                    <datalist id="expected-workflow-options">
                      {expectedWorkflowOptions.map((option) => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                  </label>
                  <label className={styles.feedbackField}>
                    <span>기대 state</span>
                    <input
                      value={expectedCurrentState}
                      onChange={(event) =>
                        setExpectedCurrentState(event.target.value)
                      }
                      maxLength={255}
                      aria-label="기대 state"
                      list="expected-state-options"
                    />
                    <datalist id="expected-state-options">
                      {expectedStateOptions.map((option) => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                  </label>
                  <label className={styles.feedbackField}>
                    <span>기대 action</span>
                    <NativeSelect
                      value={expectedActionType}
                      onChange={(event) =>
                        setExpectedActionType(event.target.value)
                      }
                      aria-label="기대 action"
                    >
                      <NativeSelectOption value="">
                        선택하세요
                      </NativeSelectOption>
                      {ACTION_TYPES.map((type) => (
                        <NativeSelectOption key={type} value={type}>
                          {type}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </label>
                  <label className={styles.feedbackField}>
                    <span>필수 slot JSON</span>
                    <textarea
                      value={expectedSlotValuesJson}
                      onChange={(event) =>
                        setExpectedSlotValuesJson(event.target.value)
                      }
                      rows={4}
                      aria-label="필수 slot JSON"
                    />
                  </label>
                </div>
                <label className={styles.feedbackField}>
                  <span>Replay version</span>
                  <input
                    value={replayVersionId}
                    onChange={(event) => setReplayVersionId(event.target.value)}
                    inputMode="numeric"
                    aria-label="Replay version"
                  />
                </label>
                <Button
                  type="button"
                  onClick={handleCreateGoldenCase}
                  disabled={isCreatingGoldenCase || detail === null}
                >
                  <CheckCircleIcon className={styles.buttonIcon} />
                  <span>{isCreatingGoldenCase ? "저장 중" : "등록"}</span>
                </Button>
                {isLoadingGoldenCases ? (
                  <p className={styles.feedbackMuted}>
                    검증 케이스를 불러오는 중입니다.
                  </p>
                ) : goldenCaseError ? (
                  <div className={styles.secondaryErrorState}>
                    <ErrorState
                      message={goldenCaseError}
                      onRetry={() => {
                        void reloadGoldenCases().catch(() => undefined);
                      }}
                    />
                  </div>
                ) : goldenCases.length === 0 ? (
                  <p className={styles.feedbackMuted}>
                    저장된 검증 케이스가 없습니다.
                  </p>
                ) : (
                  <ul className={styles.goldenCaseList}>
                    {goldenCases.map((goldenCase) => {
                      const replayStatus =
                        goldenCase.latestReplayResult?.status;
                      const state = readExpectedField(
                        goldenCase,
                        "currentState",
                      );
                      const action = readExpectedField(
                        goldenCase,
                        "actionType",
                      );
                      return (
                        <li key={goldenCase.id}>
                          <div className={styles.feedbackRowHeader}>
                            <div>
                              <strong>{goldenCase.name}</strong>
                              <span>
                                version #{goldenCase.sourceDomainPackVersionId}
                                {state ? ` · ${state}` : ""}
                                {action ? ` · ${action}` : ""}
                              </span>
                            </div>
                            <span
                              className={`${styles.replayStatus} ${
                                replayStatus === "PASS"
                                  ? styles.replayStatusPass
                                  : replayStatus === "FAIL"
                                    ? styles.replayStatusFail
                                    : ""
                              }`}
                            >
                              {replayStatus === "FAIL" ? (
                                <XCircleIcon className={styles.buttonIcon} />
                              ) : replayStatus === "PASS" ? (
                                <CheckCircleIcon
                                  className={styles.buttonIcon}
                                />
                              ) : (
                                <PlayIcon className={styles.buttonIcon} />
                              )}
                              {replayStatusLabel(replayStatus)}
                            </span>
                          </div>
                          {goldenCase.latestReplayResult?.failureSummary ? (
                            <p className={styles.failureSummary}>
                              {goldenCase.latestReplayResult.failureSummary}
                            </p>
                          ) : null}
                          <div className={styles.candidateActions}>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                void handleReplayGoldenCase(goldenCase)
                              }
                              disabled={replayingGoldenCaseId === goldenCase.id}
                              aria-label={`${goldenCase.name} replay`}
                            >
                              <PlayIcon className={styles.buttonIcon} />
                              <span>
                                {replayingGoldenCaseId === goldenCase.id
                                  ? "Replay 중"
                                  : "Replay"}
                              </span>
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          ) : null}

          {activeSideTab === "feedback" ? (
            <div
              id="simulation-side-panel-feedback"
              className={styles.sideTabPanel}
              role="tabpanel"
              aria-labelledby="simulation-side-tab-feedback"
            >
              <div className={styles.feedbackPanel}>
                <div className={styles.feedbackPanelHeader}>
                  <h3>Feedback</h3>
                  <span>{selectedTargetLabel}</span>
                </div>
                <label className={styles.feedbackField}>
                  <span>대상</span>
                  <NativeSelect
                    value={feedbackTarget}
                    onChange={(event) => setFeedbackTarget(event.target.value)}
                    aria-label="피드백 대상 선택"
                  >
                    <NativeSelectOption value="session">
                      세션 전체
                    </NativeSelectOption>
                    {messages.map((message) => (
                      <NativeSelectOption
                        key={message.id ?? message.seqNo}
                        value={String(message.id ?? "")}
                        disabled={message.id == null}
                      >
                        Turn {message.seqNo} · {roleLabel(message.senderRole)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </label>
                <label className={styles.feedbackField}>
                  <span>유형</span>
                  <NativeSelect
                    value={feedbackType}
                    onChange={(event) =>
                      setFeedbackType(
                        event.target.value as SimulationFeedbackType,
                      )
                    }
                    aria-label="피드백 유형 선택"
                  >
                    {FEEDBACK_TYPES.map((item) => (
                      <NativeSelectOption key={item.value} value={item.value}>
                        {item.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </label>
                <label className={styles.feedbackField}>
                  <span>심각도</span>
                  <NativeSelect
                    value={feedbackSeverity}
                    onChange={(event) =>
                      setFeedbackSeverity(
                        event.target.value as SimulationFeedbackSeverity,
                      )
                    }
                    aria-label="피드백 심각도 선택"
                  >
                    {FEEDBACK_SEVERITIES.map((item) => (
                      <NativeSelectOption key={item.value} value={item.value}>
                        {item.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </label>
                <label className={styles.feedbackField}>
                  <span>설명</span>
                  <textarea
                    value={feedbackDescription}
                    onChange={(event) =>
                      setFeedbackDescription(event.target.value)
                    }
                    maxLength={2000}
                    rows={3}
                  />
                </label>
                <label className={styles.feedbackField}>
                  <span>기대 응답/행동</span>
                  <textarea
                    value={feedbackExpectedBehavior}
                    onChange={(event) =>
                      setFeedbackExpectedBehavior(event.target.value)
                    }
                    maxLength={2000}
                    rows={3}
                  />
                </label>
                <Button
                  type="button"
                  onClick={handleSubmitFeedbackAndCreateCandidate}
                  disabled={
                    isSubmittingFeedback ||
                    detail === null ||
                    !feedbackDescription.trim() ||
                    !feedbackExpectedBehavior.trim()
                  }
                >
                  <FlagIcon className={styles.buttonIcon} />
                  <span>
                    {isSubmittingFeedback ? "저장 중" : "피드백 저장"}
                  </span>
                </Button>
              </div>

              <div className={styles.feedbackListPanel}>
                <div className={styles.feedbackPanelHeader}>
                  <h3>워크스페이스 피드백</h3>
                  <NativeSelect
                    value={feedbackStatusFilter}
                    onChange={(event) =>
                      setFeedbackStatusFilter(
                        event.target.value as SimulationFeedbackStatus | "",
                      )
                    }
                    aria-label="피드백 상태 필터"
                  >
                    {FEEDBACK_STATUSES.map((item) => (
                      <NativeSelectOption
                        key={item.value || "ALL"}
                        value={item.value}
                      >
                        {item.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                {isLoadingFeedback ? (
                  <p className={styles.feedbackMuted}>
                    피드백을 불러오는 중입니다.
                  </p>
                ) : feedbackError ? (
                  <div className={styles.secondaryErrorState}>
                    <ErrorState
                      message={feedbackError}
                      onRetry={() => {
                        void reloadFeedback().catch(() => undefined);
                      }}
                    />
                  </div>
                ) : feedbackItems.length === 0 ? (
                  <p className={styles.feedbackMuted}>
                    조건에 맞는 피드백이 없습니다.
                  </p>
                ) : (
                  <ul className={styles.feedbackList}>
                    {feedbackItems.map((feedback) => {
                      const targetType =
                        candidateTargetSelections[feedback.id] ??
                        inferCandidateTargetType(feedback.feedbackType);
                      const targetDescription = candidateTargetDescription(
                        targetType,
                        candidateWorkflowTarget,
                      );
                      const targetElementLabel = candidateTargetElementLabel(
                        targetType,
                        candidateWorkflowTarget,
                      );
                      const isCandidateActionDisabled =
                        feedback.status !== "OPEN" ||
                        creatingCandidateId === feedback.id;
                      return (
                        <li key={feedback.id}>
                          <div className={styles.feedbackRowHeader}>
                            <div>
                              <strong>
                                {feedbackTypeLabel(feedback.feedbackType)}
                              </strong>
                              <span>
                                {feedbackSeverityLabel(feedback.severity)} ·{" "}
                                {feedbackStatusLabel(feedback.status)}
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                void handleCreateCandidate(feedback)
                              }
                              disabled={isCandidateActionDisabled}
                            >
                              <LightbulbIcon className={styles.buttonIcon} />
                              <span>
                                {creatingCandidateId === feedback.id
                                  ? "생성 중"
                                  : "후보"}
                              </span>
                            </Button>
                          </div>
                          <p>{feedback.description}</p>
                          <div className={styles.candidateTargetPanel}>
                            <label className={styles.candidateTargetField}>
                              <span>개선 대상</span>
                              <NativeSelect
                                value={targetType}
                                onChange={(event) =>
                                  setCandidateTargetSelections((current) => ({
                                    ...current,
                                    [feedback.id]: event.target
                                      .value as SimulationImprovementCandidateTargetType,
                                  }))
                                }
                                disabled={isCandidateActionDisabled}
                                aria-label={`피드백 #${feedback.id} 개선 대상 선택`}
                              >
                                {CANDIDATE_TARGET_TYPES.map((item) => (
                                  <NativeSelectOption
                                    key={item.value}
                                    value={item.value}
                                  >
                                    {item.label}
                                  </NativeSelectOption>
                                ))}
                              </NativeSelect>
                            </label>
                            <dl className={styles.candidateTargetSummary}>
                              <div>
                                <dt>Target type</dt>
                                <dd>{candidateTargetTypeLabel(targetType)}</dd>
                              </div>
                              <div>
                                <dt>Target element</dt>
                                <dd>{targetElementLabel}</dd>
                              </div>
                            </dl>
                            <p>{targetDescription}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          ) : null}

          {activeSideTab === "candidates" ? (
            <div
              id="simulation-side-panel-candidates"
              className={styles.sideTabPanel}
              role="tabpanel"
              aria-labelledby="simulation-side-tab-candidates"
            >
              <div className={styles.feedbackListPanel}>
                <div className={styles.feedbackPanelHeader}>
                  <h3>개선 후보</h3>
                  <NativeSelect
                    value={candidateStatusFilter}
                    onChange={(event) =>
                      setCandidateStatusFilter(
                        event.target.value as
                          | SimulationImprovementCandidateStatus
                          | "",
                      )
                    }
                    aria-label="개선 후보 상태 필터"
                  >
                    {CANDIDATE_STATUSES.map((item) => (
                      <NativeSelectOption
                        key={item.value || "ALL"}
                        value={item.value}
                      >
                        {item.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                {candidateApprovalNotice ? (
                  <output className={styles.candidateApprovalNotice}>
                    {candidateApprovalNotice}
                  </output>
                ) : null}
                {isLoadingCandidates ? (
                  <p className={styles.feedbackMuted}>
                    개선 후보를 불러오는 중입니다.
                  </p>
                ) : candidateError ? (
                  <div className={styles.secondaryErrorState}>
                    <ErrorState
                      message={candidateError}
                      onRetry={() => {
                        void reloadCandidates().catch(() => undefined);
                      }}
                    />
                  </div>
                ) : candidateItems.length === 0 ? (
                  <p className={styles.feedbackMuted}>
                    조건에 맞는 개선 후보가 없습니다.
                  </p>
                ) : (
                  <ul className={styles.candidateList}>
                    {candidateItems.map((candidate) => (
                      <li key={candidate.id}>
                        <div className={styles.feedbackRowHeader}>
                          <div>
                            <strong>
                              {candidateTypeLabel(candidate.candidateType)}
                            </strong>
                            <span>
                              버전 #{candidate.domainPackVersionId} · 대상:{" "}
                              {candidateTargetLabel(candidate)}
                            </span>
                          </div>
                          <span className={styles.statusPill}>
                            {candidateStatusLabel(candidate.status)}
                          </span>
                        </div>
                        <dl className={styles.candidateSummary}>
                          <div>
                            <dt>현재 동작 (피드백 설명)</dt>
                            <dd>{candidate.beforeSummary}</dd>
                          </div>
                          <div>
                            <dt>기대 동작 (기대 응답/행동)</dt>
                            <dd>{candidate.afterSummary}</dd>
                          </div>
                          <div>
                            <dt>근거</dt>
                            <dd>
                              {candidate.evidenceSummary}
                              <span className={styles.evidenceMeta}>
                                세션 #{candidate.sessionId}
                                {candidate.chatMessageId
                                  ? ` · 메시지 #${candidate.chatMessageId}`
                                  : ""}
                                {candidate.feedbackId
                                  ? ` · 피드백 #${candidate.feedbackId}`
                                  : ""}
                              </span>
                            </dd>
                          </div>
                        </dl>
                        {usesStructuralReview(candidate) ? (
                          <StructuralPatchReview
                            candidate={candidate}
                            confirmed={confirmedCandidatePatchKeys.has(
                              candidatePatchConfirmationKey(candidate),
                            )}
                            onToggleConfirm={() => handleConfirmCandidatePatch(candidate)}
                            onReplayAppliedVersion={handleReplayAppliedVersion}
                            legacyFallback={
                              <CandidatePatchReview
                                candidate={candidate}
                                confirmed={confirmedCandidatePatchKeys.has(
                                  candidatePatchConfirmationKey(candidate),
                                )}
                                onConfirm={() => handleConfirmCandidatePatch(candidate)}
                              />
                            }
                          />
                        ) : (
                          <CandidatePatchReview
                            candidate={candidate}
                            confirmed={confirmedCandidatePatchKeys.has(
                              candidatePatchConfirmationKey(candidate),
                            )}
                            onConfirm={() => handleConfirmCandidatePatch(candidate)}
                          />
                        )}
                        {candidate.status === "DRAFT" ? (
                          <div className={styles.candidateActions}>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={updatingCandidateId === candidate.id}
                              onClick={() =>
                                void handleCandidateStatusChange(
                                  candidate,
                                  "READY_FOR_REVIEW",
                                )
                              }
                            >
                              <span>
                                {updatingCandidateId === candidate.id
                                  ? "요청 중"
                                  : "리뷰 요청"}
                              </span>
                            </Button>
                          </div>
                        ) : null}
                        {candidate.status === "READY_FOR_REVIEW" ? (
                          <div className={styles.candidateReviewForm}>
                            <input
                              value={candidateRejectReasons[candidate.id] ?? ""}
                              onChange={(event) =>
                                setCandidateRejectReasons((current) => ({
                                  ...current,
                                  [candidate.id]: event.target.value,
                                }))
                              }
                              maxLength={500}
                              placeholder="검토 의견 — 반려 시 필수 입력"
                              aria-label="개선 후보 검토 의견"
                            />
                            <div className={styles.candidateActions}>
                              <Button
                                type="button"
                                variant="outline"
                                disabled={updatingCandidateId === candidate.id}
                                onClick={() =>
                                  void handleRejectCandidate(candidate)
                                }
                              >
                                <span>반려</span>
                              </Button>
                              <Button
                                type="button"
                                disabled={
                                  updatingCandidateId === candidate.id ||
                                  !canApproveCandidate(
                                    candidate,
                                    confirmedCandidatePatchKeys.has(
                                      candidatePatchConfirmationKey(candidate),
                                    ),
                                  )
                                }
                                onClick={() =>
                                  void handleApproveCandidate(candidate)
                                }
                              >
                                <span>승인</span>
                              </Button>
                            </div>
                          </div>
                        ) : null}
                        {candidate.decisionReason ? (
                          <p className={styles.decisionReason}>
                            결정 사유: {candidate.decisionReason}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

interface CandidatePatchReviewProps {
  candidate: SimulationImprovementCandidate;
  confirmed: boolean;
  onConfirm: () => void;
}

function CandidatePatchReview({
  candidate,
  confirmed,
  onConfirm,
}: Readonly<CandidatePatchReviewProps>) {
  const patchReview = buildCandidatePatchReview(candidate);

  return (
    <section
      className={styles.candidatePatchPanel}
      aria-label="draft patch 검토"
    >
      <div className={styles.candidatePatchHeader}>
        <div>
          <strong>Draft patch 검토</strong>
          <span>승인 전 실제 변경 내용을 확인하세요.</span>
        </div>
        {patchReview.kind === "ready" ? (
          <span className={styles.patchStatusReady}>확인 가능</span>
        ) : (
          <span className={styles.patchStatusBlocked}>확인 불가</span>
        )}
      </div>

      {patchReview.kind === "ready" ? (
        <>
          <dl className={styles.patchMetaList}>
            <div>
              <dt>작업</dt>
              <dd>{patchReview.operation}</dd>
            </div>
            <div>
              <dt>대상</dt>
              <dd>{patchReview.targetLabel}</dd>
            </div>
          </dl>
          <dl className={styles.patchChangeList}>
            {patchReview.changes.map((change, index) => (
              <div key={`${change.label}-${index}`}>
                <dt>{change.label}</dt>
                <dd>
                  <span>Before</span>
                  <p>{change.before}</p>
                </dd>
                <dd>
                  <span>After</span>
                  <p>{change.after}</p>
                </dd>
              </div>
            ))}
          </dl>
          <div className={styles.patchEvidenceBlock}>
            <span>근거</span>
            <p>{patchReview.evidence}</p>
          </div>
          <div className={styles.patchEvidenceBlock}>
            <span>영향 범위</span>
            <ul>
              {patchReview.impactItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <details className={styles.patchRawDetails}>
            <summary>원본 patch JSON</summary>
            <pre>
              <code>{patchReview.rawJson}</code>
            </pre>
          </details>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onConfirm}
            disabled={confirmed}
          >
            <span>{confirmed ? "변경 확인 완료" : "변경 상세 확인"}</span>
          </Button>
        </>
      ) : (
        <>
          <p className={styles.patchUnavailableMessage}>
            {patchReview.message}
          </p>
          {patchReview.rawJson ? (
            <pre className={styles.patchRawPreview}>
              <code>{patchReview.rawJson}</code>
            </pre>
          ) : null}
          <p className={styles.patchConfirmHint}>
            patch 내용을 확인할 수 없어 승인할 수 없습니다. 리뷰 요청 상태나
            후보 생성 데이터를 먼저 확인하세요.
          </p>
        </>
      )}
    </section>
  );
}

type MessageBubbleProps = Readonly<{
  message: ChatMessage;
  feedbackCount: number;
  onFeedbackClick?: () => void;
}>;

function MessageBubble({
  message,
  feedbackCount,
  onFeedbackClick,
}: MessageBubbleProps) {
  const isCustomer =
    message.senderRole === "USER" || message.senderRole === "CUSTOMER";
  return (
    <article
      className={`${styles.message} ${isCustomer ? styles.messageCustomer : ""}`}
    >
      <div className={styles.messageMeta}>
        <span>{roleLabel(message.senderRole)}</span>
        <div className={styles.messageActions}>
          {feedbackCount > 0 ? (
            <span className={styles.feedbackBadge}>{feedbackCount}</span>
          ) : null}
          {onFeedbackClick ? (
            <button
              type="button"
              className={styles.messageFeedbackButton}
              onClick={onFeedbackClick}
              aria-label={`Turn ${message.seqNo ?? ""} 피드백 대상 선택`}
            >
              <FlagIcon className={styles.buttonIcon} />
            </button>
          ) : null}
          <time>{formatTime(message.createdAt)}</time>
        </div>
      </div>
      <p>{message.content}</p>
    </article>
  );
}
