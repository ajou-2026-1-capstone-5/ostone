import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  confirmDomain,
  getCheckpoint,
  getReplayDiff,
  submitFeedback,
} from "@/shared/api/generated/endpoints/pipeline-review-controller/pipeline-review-controller";
import { requireApiData } from "@/shared/api";

// 호출은 generated pipeline-review-controller(getCheckpoint/confirmDomain/submitFeedback)에 위임한다.
// 이 wrapper는 (1) 응답 data envelope unwrap, (2) UI가 의존하는 도메인 타입 정규화
// (generated ReviewCheckpointView는 tasks가 optional이고 payload가 loose object라 화면 계약에 부족),
// (3) React Query queryKey/enabled/invalidate 표준화 목적으로만 유지한다.

export interface ReviewTaskPayload {
  candidateId?: string;
  displayName?: string;
  confidence?: number;
  description?: string;
  rationale?: string;
  kind?: string;
  isFallback?: boolean;
  fallbackReason?: string;
  evidenceTerms?: string[];
  evidenceConversationIds?: string[];
  evidenceSnippets?: DomainEvidenceSnippet[];
  suggestedDomainLexicon?: string[];
  sourceId?: string;
  targetId?: string;
  sourceReviewContext?: ReviewCaseContext;
  targetReviewContext?: ReviewCaseContext;
  sourceSnippet?: string;
  targetSnippet?: string;
  questionText?: string;
  questionType?: string;
  decisionScope?: string;
  answerOptions?: FeedbackAnswerOption[];
  reason?: string;
  reasonLabel?: string;
}

export interface DomainEvidenceSnippet {
  conversationId?: string;
  snippet?: string;
}

export interface FeedbackAnswerOption {
  value?: string;
  label?: string;
  decisionScope?: string;
  constraintType?: string;
}

export interface ReviewCaseContext {
  id?: string;
  conversationId?: string;
  summary?: string;
  action?: string;
  object?: string;
  intentType?: string;
  signals?: string[];
  logExcerpt?: string;
  evidenceTurnIds?: string[];
  turns?: Array<{ role?: string; text?: string }>;
}

export interface ReviewTaskView {
  id: number;
  targetType: "DOMAIN_CANDIDATE" | "FEEDBACK_PAIR" | string;
  status: string;
  priority: string;
  title: string;
  payload: ReviewTaskPayload;
}

export interface ReviewCheckpointView {
  pipelineJobId: number;
  pipelineStatus: string;
  reviewKind: "DOMAIN_CONFIRMATION" | "HUMAN_FEEDBACK" | null;
  tasks: ReviewTaskView[];
}

interface PipelineReviewCheckpointOptions {
  autoRefresh?: boolean;
  refetchIntervalMs?: number;
}

const FINAL_PIPELINE_STATUSES = new Set(["SUCCEEDED", "FAILED", "CANCELLED"]);
const PIPELINE_REVIEW_AUTO_REFRESH_INTERVAL_MS = 5_000;

const checkpointQueryKey = (workspaceId?: number, pipelineJobId?: number) =>
  ["pipeline-review-checkpoint", workspaceId, pipelineJobId] as const;

function requirePipelineReviewIds(
  workspaceId?: number,
  pipelineJobId?: number,
) {
  if (workspaceId == null || pipelineJobId == null) {
    throw new Error("workspaceId and pipelineJobId are required");
  }
  return { workspaceId, pipelineJobId };
}

export function shouldPollPipelineReviewCheckpoint(
  checkpoint?: ReviewCheckpointView,
): boolean {
  if (!checkpoint) {
    return true;
  }
  if (checkpoint.reviewKind) {
    return false;
  }
  return !FINAL_PIPELINE_STATUSES.has(checkpoint.pipelineStatus);
}

export function usePipelineReviewCheckpoint(
  workspaceId?: number,
  pipelineJobId?: number,
  options: PipelineReviewCheckpointOptions = {},
) {
  const refetchIntervalMs =
    options.refetchIntervalMs ?? PIPELINE_REVIEW_AUTO_REFRESH_INTERVAL_MS;

  return useQuery({
    queryKey: checkpointQueryKey(workspaceId, pipelineJobId),
    enabled: workspaceId != null && pipelineJobId != null,
    queryFn: async () => {
      const ids = requirePipelineReviewIds(workspaceId, pipelineJobId);
      const response = await getCheckpoint(ids.workspaceId, ids.pipelineJobId);
      return requireApiData<ReviewCheckpointView>(
        response as unknown as { data?: ReviewCheckpointView },
        "리뷰 체크포인트 응답을 확인할 수 없습니다.",
      );
    },
    refetchInterval: options.autoRefresh
      ? (query) =>
          shouldPollPipelineReviewCheckpoint(query.state.data)
            ? refetchIntervalMs
            : false
      : false,
  });
}

// 후보 선택(reviewTaskId)에 더해 운영자가 다듬은 profile override를 함께 보낸다.
// 모든 override 필드는 optional이며 생략하면 백엔드가 후보 값을 유지한다(하위호환).
export interface ConfirmDomainInput {
  reviewTaskId: number;
  confirmedDomain?: string;
  displayName?: string;
  description?: string;
  domainLexicon?: string[];
  evidenceTerms?: string[];
  exclusionTerms?: string[];
}

export function useConfirmPipelineDomain(
  workspaceId?: number,
  pipelineJobId?: number,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ConfirmDomainInput) => {
      const ids = requirePipelineReviewIds(workspaceId, pipelineJobId);
      return confirmDomain(ids.workspaceId, ids.pipelineJobId, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: checkpointQueryKey(workspaceId, pipelineJobId),
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "도메인 확정에 실패했습니다.";
      toast.error(message);
      console.error("Pipeline domain confirmation failed:", error);
    },
  });
}

export function useSubmitPipelineFeedback(
  workspaceId?: number,
  pipelineJobId?: number,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      decisions: Array<{ reviewTaskId: number; decisionType: string }>,
    ) => {
      const ids = requirePipelineReviewIds(workspaceId, pipelineJobId);
      return submitFeedback(ids.workspaceId, ids.pipelineJobId, { decisions });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: checkpointQueryKey(workspaceId, pipelineJobId),
      });
      // replay가 새 draft를 만들 때까지 diff는 PENDING이므로 즉시 무효화해 폴링을 시작한다.
      void queryClient.invalidateQueries({
        queryKey: replayDiffQueryKey(workspaceId, pipelineJobId),
      });
    },
  });
}

// "이번 피드백으로 바뀐 것" 섹션이 의존하는 정규화 타입.
// 생성 ReplayDiffView는 모든 필드가 optional이라 화면 계약에 부족해 firm 타입으로 정규화한다.
export type ReplayDiffStatus =
  | "READY"
  | "PENDING"
  | "UNAVAILABLE"
  | "NOT_APPLICABLE";
export type ReplayDecisionStatus = "applied" | "partially_applied" | "ignored";

export interface ReplayLabelChange {
  id: string;
  before: string;
  after: string;
}

export interface ReplayStructureDiff {
  splitCount: number;
  mergeCount: number;
  labelChanges: ReplayLabelChange[];
}

export interface ReplayDecision {
  reviewTaskId: number | null;
  scope: "intent" | "workflow" | string;
  decisionType: string;
  sourceId: string;
  targetId: string;
  status: ReplayDecisionStatus;
  reason: string | null;
  effect: string | null;
}

export interface ReplayDiffSummary {
  applied: number;
  partiallyApplied: number;
  ignored: number;
  total: number;
}

export interface ReplayDiffView {
  available: boolean;
  status: ReplayDiffStatus;
  reason: string | null;
  structureComparisonAvailable: boolean;
  intent: ReplayStructureDiff;
  workflow: ReplayStructureDiff;
  decisions: ReplayDecision[];
  summary: ReplayDiffSummary;
}

const replayDiffQueryKey = (workspaceId?: number, pipelineJobId?: number) =>
  ["pipeline-review-replay-diff", workspaceId, pipelineJobId] as const;

function normalizeReplayStatus(status?: string): ReplayDiffStatus {
  switch (status) {
    case "READY":
    case "PENDING":
    case "UNAVAILABLE":
      return status;
    default:
      return "NOT_APPLICABLE";
  }
}

function normalizeDecisionStatus(status?: string): ReplayDecisionStatus {
  return status === "applied" || status === "partially_applied"
    ? status
    : "ignored";
}

function normalizeStructureDiff(diff?: {
  splitCount?: number;
  mergeCount?: number;
  labelChanges?: Array<{ id?: string; before?: string; after?: string }>;
}): ReplayStructureDiff {
  return {
    splitCount: diff?.splitCount ?? 0,
    mergeCount: diff?.mergeCount ?? 0,
    labelChanges: (diff?.labelChanges ?? []).map((change) => ({
      id: change.id ?? "",
      before: change.before ?? "",
      after: change.after ?? "",
    })),
  };
}

function normalizeReplayDiff(raw: {
  available?: boolean;
  status?: string;
  reason?: string;
  structureComparisonAvailable?: boolean;
  intent?: Parameters<typeof normalizeStructureDiff>[0];
  workflow?: Parameters<typeof normalizeStructureDiff>[0];
  decisions?: Array<{
    reviewTaskId?: number;
    scope?: string;
    decisionType?: string;
    sourceId?: string;
    targetId?: string;
    status?: string;
    reason?: string;
    effect?: string;
  }>;
  summary?: {
    applied?: number;
    partiallyApplied?: number;
    ignored?: number;
    total?: number;
  };
}): ReplayDiffView {
  return {
    available: raw.available ?? false,
    status: normalizeReplayStatus(raw.status),
    reason: raw.reason ?? null,
    structureComparisonAvailable: raw.structureComparisonAvailable ?? false,
    intent: normalizeStructureDiff(raw.intent),
    workflow: normalizeStructureDiff(raw.workflow),
    decisions: (raw.decisions ?? []).map((decision) => ({
      reviewTaskId: decision.reviewTaskId ?? null,
      scope: decision.scope ?? "",
      decisionType: decision.decisionType ?? "",
      sourceId: decision.sourceId ?? "",
      targetId: decision.targetId ?? "",
      status: normalizeDecisionStatus(decision.status),
      reason: decision.reason ?? null,
      effect: decision.effect ?? null,
    })),
    summary: {
      applied: raw.summary?.applied ?? 0,
      partiallyApplied: raw.summary?.partiallyApplied ?? 0,
      ignored: raw.summary?.ignored ?? 0,
      total: raw.summary?.total ?? 0,
    },
  };
}

export function useReplayDiff(workspaceId?: number, pipelineJobId?: number) {
  return useQuery({
    queryKey: replayDiffQueryKey(workspaceId, pipelineJobId),
    enabled: workspaceId != null && pipelineJobId != null,
    queryFn: async () => {
      const ids = requirePipelineReviewIds(workspaceId, pipelineJobId);
      const response = await getReplayDiff(ids.workspaceId, ids.pipelineJobId);
      const data = requireApiData<Parameters<typeof normalizeReplayDiff>[0]>(
        response as unknown as {
          data?: Parameters<typeof normalizeReplayDiff>[0];
        },
        "replay diff 응답을 확인할 수 없습니다.",
      );
      return normalizeReplayDiff(data);
    },
    // replay 진행 중(PENDING)에는 새 draft가 도착할 때까지 폴링한다.
    refetchInterval: (query) =>
      query.state.data?.status === "PENDING"
        ? PIPELINE_REVIEW_AUTO_REFRESH_INTERVAL_MS
        : false,
  });
}
