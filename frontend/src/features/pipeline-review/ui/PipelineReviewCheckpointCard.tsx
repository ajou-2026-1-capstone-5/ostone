import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ListChecksIcon, RefreshCwIcon, UploadIcon } from "lucide-react";
import { Link } from "react-router-dom";
import {
  type FeedbackAnswerOption,
  type ReviewCaseContext,
  type ReviewTaskPayload,
  type ReviewTaskView,
  useConfirmPipelineDomain,
  usePipelineReviewCheckpoint,
  useSubmitPipelineFeedback,
} from "../api/pipelineReviewApi";
import { ReplayDiffSection } from "./ReplayDiffSection";
import { domainPackListPath } from "@/shared/lib/domainPackRoutes";
import {
  CTA_GO_DOMAIN_PACK,
  CTA_RETRY_FROM_UPLOAD,
} from "@/shared/lib/ctaLabels";
import styles from "./PipelineReviewCheckpointCard.module.css";

interface Props {
  workspaceId?: number;
  pipelineJobId?: number;
}

const FEEDBACK_DRAFT_KEY_PREFIX = "ostone:pipeline-review:feedback-draft";
const INTENT_FEEDBACK_ANSWER_OPTIONS = [
  { value: "must_link", label: "같은 intent로 묶기" },
  { value: "cannot_link", label: "분리하기" },
  { value: "unsure", label: "판단 보류" },
];
const WORKFLOW_FEEDBACK_ANSWER_OPTIONS = [
  { value: "same_workflow", label: "같은 workflow로 합치기" },
  {
    value: "same_intent_separate_workflow",
    label: "같은 intent지만 workflow는 분리",
  },
  { value: "different_intent", label: "다른 intent로 분리" },
  { value: "unsure", label: "판단 보류" },
];

type FeedbackDecision = string;
type FeedbackDecisions = Record<number, FeedbackDecision>;

interface DomainProfileEdits {
  confirmedDomain: string;
  displayName: string;
  description: string;
  domainLexicon: string;
  evidenceTerms: string;
  exclusionTerms: string;
}

export function PipelineReviewCheckpointCard({
  workspaceId,
  pipelineJobId,
}: Props) {
  const query = usePipelineReviewCheckpoint(workspaceId, pipelineJobId);
  const confirmDomain = useConfirmPipelineDomain(workspaceId, pipelineJobId);
  const submitFeedback = useSubmitPipelineFeedback(workspaceId, pipelineJobId);
  const draftStorageKey = createFeedbackDraftStorageKey(
    workspaceId,
    pipelineJobId,
  );
  const [feedbackDraft, setFeedbackDraft] = useState<{
    storageKey: string | null;
    decisions: FeedbackDecisions;
  }>({
    storageKey: null,
    decisions: {},
  });
  const [domainSelection, setDomainSelection] = useState<{
    selectionKey: string | null;
    taskId: number | null;
  }>({
    selectionKey: null,
    taskId: null,
  });
  const [domainEdits, setDomainEdits] = useState<{
    taskKey: string | null;
    values: DomainProfileEdits;
  }>({ taskKey: null, values: emptyDomainEdits() });

  const openTasks = useMemo(
    () => query.data?.tasks.filter((task) => task.status === "OPEN") ?? [],
    [query.data?.tasks],
  );
  const openTaskIds = useMemo(
    () => openTasks.map((task) => task.id),
    [openTasks],
  );
  const domainSelectionKey =
    query.data?.reviewKind === "DOMAIN_CONFIRMATION"
      ? `${workspaceId}:${pipelineJobId}:${openTaskIds.join(",")}`
      : null;
  const selectedDomainTask = useMemo(
    () =>
      domainSelection.selectionKey === domainSelectionKey
        ? openTasks.find((task) => task.id === domainSelection.taskId)
        : undefined,
    [
      domainSelection.selectionKey,
      domainSelection.taskId,
      domainSelectionKey,
      openTasks,
    ],
  );
  const currentDomainEditKey = selectedDomainTask
    ? `${domainSelectionKey}:${selectedDomainTask.id}`
    : null;
  // 후보를 바꾸면 편집값을 그 후보로 다시 시드한다. 운영자가 입력하기 전까지는 후보 기반 시드를 보여 준다.
  const activeDomainEdits =
    selectedDomainTask && domainEdits.taskKey === currentDomainEditKey
      ? domainEdits.values
      : seedDomainEdits(selectedDomainTask);
  const updateDomainEdit = (field: keyof DomainProfileEdits, value: string) => {
    if (!selectedDomainTask) {
      return;
    }
    setDomainEdits((current) => {
      const base =
        current.taskKey === currentDomainEditKey
          ? current.values
          : seedDomainEdits(selectedDomainTask);
      return {
        taskKey: currentDomainEditKey,
        values: { ...base, [field]: value },
      };
    });
  };
  const openTaskDecisionValues = useMemo(
    () =>
      new Map(
        openTasks.map((task) => [
          task.id,
          new Set(
            feedbackAnswerOptions(task.payload).map((option) => option.value),
          ),
        ]),
      ),
    [openTasks],
  );
  const storedFeedbackDecisions = useMemo(() => {
    if (query.data?.reviewKind !== "HUMAN_FEEDBACK" || !draftStorageKey) {
      return {};
    }
    return readFeedbackDraft(
      draftStorageKey,
      openTaskIds,
      openTaskDecisionValues,
    );
  }, [
    draftStorageKey,
    openTaskDecisionValues,
    openTaskIds,
    query.data?.reviewKind,
  ]);
  const activeFeedbackDecisions = filterFeedbackDecisions(
    {
      ...storedFeedbackDecisions,
      ...(feedbackDraft.storageKey === draftStorageKey
        ? feedbackDraft.decisions
        : {}),
    },
    openTaskIds,
    openTaskDecisionValues,
  );
  const answeredFeedbackCount = openTasks.filter(
    (task) => activeFeedbackDecisions[task.id] !== undefined,
  ).length;
  const allFeedbackResolved =
    openTasks.length > 0 && answeredFeedbackCount === openTasks.length;
  const hasUnsavedFeedback =
    query.data?.reviewKind === "HUMAN_FEEDBACK" && answeredFeedbackCount > 0;

  useEffect(() => {
    if (
      query.data?.reviewKind !== undefined &&
      query.data.reviewKind !== "HUMAN_FEEDBACK" &&
      draftStorageKey
    ) {
      removeFeedbackDraft(draftStorageKey);
    }
  }, [draftStorageKey, query.data?.reviewKind]);

  useEffect(() => {
    if (!hasUnsavedFeedback) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedFeedback]);

  const updateFeedbackDecision = (
    taskId: number,
    decision: FeedbackDecision,
  ) => {
    setFeedbackDraft((current) => {
      const currentDecisions =
        current.storageKey === draftStorageKey ? current.decisions : {};
      const next = filterFeedbackDecisions(
        { ...currentDecisions, [taskId]: decision },
        openTaskIds,
        openTaskDecisionValues,
      );
      if (draftStorageKey) {
        writeFeedbackDraft(draftStorageKey, next);
      }
      return { storageKey: draftStorageKey, decisions: next };
    });
  };

  const clearFeedbackDraft = () => {
    if (draftStorageKey) {
      removeFeedbackDraft(draftStorageKey);
    }
    setFeedbackDraft({ storageKey: draftStorageKey, decisions: {} });
  };

  if (workspaceId == null || pipelineJobId == null) {
    return null;
  }

  if (query.isLoading) {
    return (
      <section className={styles.stateCard}>
        리뷰 체크포인트를 불러오는 중입니다.
      </section>
    );
  }

  if (query.isError) {
    return (
      <StateActionCard
        role="alert"
        title="현재 job 상태를 확인할 수 없습니다."
        description="상태 조회에 실패했습니다. 완료나 초안 생성 성공으로 처리하지 않고 같은 job을 다시 조회합니다."
      >
        <button
          type="button"
          className={styles.stateActionPrimary}
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          <RefreshCwIcon aria-hidden="true" />
          다시 시도
        </button>
        <Link
          to={`/workspaces/${workspaceId}/upload`}
          className={styles.stateActionSecondary}
        >
          <UploadIcon aria-hidden="true" />
          업로드 화면으로 돌아가기
        </Link>
      </StateActionCard>
    );
  }

  if (!query.data?.reviewKind) {
    return (
      <>
        <StateActionCard
          title={checkpointStateTitle(query.data?.pipelineStatus)}
          description={checkpointStateDescription(query.data?.pipelineStatus)}
        >
          {query.data?.pipelineStatus === "SUCCEEDED" ? (
            <>
              <Link
                to={domainPackListPath(workspaceId)}
                className={styles.stateActionPrimary}
              >
                <ListChecksIcon aria-hidden="true" />
                {CTA_GO_DOMAIN_PACK}
              </Link>
              <button
                type="button"
                className={styles.stateActionSecondary}
                disabled={query.isFetching}
                onClick={() => void query.refetch()}
              >
                <RefreshCwIcon aria-hidden="true" />
                상태 새로고침
              </button>
            </>
          ) : query.data?.pipelineStatus === "FAILED" ||
            query.data?.pipelineStatus === "CANCELLED" ? (
            <>
              <Link
                to={`/workspaces/${workspaceId}/upload`}
                className={styles.stateActionPrimary}
              >
                <UploadIcon aria-hidden="true" />
                {CTA_RETRY_FROM_UPLOAD}
              </Link>
              <button
                type="button"
                className={styles.stateActionSecondary}
                disabled={query.isFetching}
                onClick={() => void query.refetch()}
              >
                <RefreshCwIcon aria-hidden="true" />
                현재 job 새로고침
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.stateActionPrimary}
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              <RefreshCwIcon aria-hidden="true" />
              상태 새로고침
            </button>
          )}
        </StateActionCard>
        <ReplayDiffSection
          workspaceId={workspaceId}
          pipelineJobId={pipelineJobId}
        />
      </>
    );
  }

  if (openTasks.length === 0) {
    return (
      <StateActionCard
        title="현재 확인할 리뷰 작업이 없습니다."
        description="열린 작업이 생기면 이 화면에서 바로 이어서 검토할 수 있습니다."
      >
        <button
          type="button"
          className={styles.stateActionPrimary}
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          <RefreshCwIcon aria-hidden="true" />
          작업 새로고침
        </button>
      </StateActionCard>
    );
  }

  if (query.data.reviewKind === "DOMAIN_CONFIRMATION") {
    return (
      <section className={styles.card} aria-labelledby="pipeline-review-title">
        <div className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Domain confirmation</span>
            <h2 id="pipeline-review-title" className={styles.title}>
              상담 도메인을 확정합니다.
            </h2>
            <p className={styles.description}>
              선택한 도메인 profile이 intent clustering 입력으로 사용됩니다.
            </p>
          </div>
          <span className={styles.badge}>{openTasks.length} candidates</span>
        </div>
        <div className={styles.domainGrid}>
          {openTasks.map((task) => {
            const isSelected = selectedDomainTask?.id === task.id;
            const fallback = isFallbackCandidate(task.payload);
            return (
              <button
                key={task.id}
                type="button"
                className={`${styles.domainOption} ${isSelected ? styles.domainOptionSelected : ""} ${fallback ? styles.domainOptionFallback : ""}`}
                aria-pressed={isSelected}
                disabled={confirmDomain.isPending}
                onClick={() =>
                  setDomainSelection({
                    selectionKey: domainSelectionKey,
                    taskId: task.id,
                  })
                }
              >
                <span className={styles.optionHeader}>
                  <strong>{task.payload.displayName ?? task.title}</strong>
                  {fallback ? (
                    <span className={styles.fallbackBadge}>
                      {fallbackReasonLabel(task.payload.fallbackReason)}
                    </span>
                  ) : (
                    task.payload.confidence !== undefined && (
                      <span className={styles.confidence}>
                        {formatDomainConfidence(task.payload.confidence)}
                      </span>
                    )
                  )}
                </span>
                <span className={styles.optionDescription}>
                  {task.payload.description}
                </span>
                {task.payload.rationale && (
                  <span className={styles.optionRationale}>
                    {task.payload.rationale}
                  </span>
                )}
                <span className={styles.termRow}>
                  {(task.payload.evidenceTerms ?? [])
                    .slice(0, 6)
                    .map((term) => (
                      <span key={term} className={styles.term}>
                        {term}
                      </span>
                    ))}
                </span>
              </button>
            );
          })}
        </div>
        <div className={styles.domainConfirmPanel} aria-live="polite">
          <span className={styles.eyebrow}>Confirmed profile</span>
          {selectedDomainTask ? (
            <>
              <p className={styles.domainReviewImpact}>
                후보 값을 기본으로 채웠습니다. 필요하면 직접 다듬어 확정하세요.
                이 profile은 intent clustering 입력으로 반영되며, 확정 후
                pipeline replay를 거쳐 다음 review 단계 또는 Domain Pack 초안
                생성으로 이어집니다.
              </p>
              {lowConfidenceGuidance(selectedDomainTask.payload) && (
                <p className={styles.domainReviewWarning} role="status">
                  {lowConfidenceGuidance(selectedDomainTask.payload)}
                </p>
              )}
              <div className={styles.profileForm}>
                <ProfileTextField
                  id="domain-edit-confirmed-domain"
                  label="도메인명"
                  value={activeDomainEdits.confirmedDomain}
                  disabled={confirmDomain.isPending}
                  invalid={activeDomainEdits.confirmedDomain.trim() === ""}
                  onChange={(value) =>
                    updateDomainEdit("confirmedDomain", value)
                  }
                />
                <ProfileTextField
                  id="domain-edit-display-name"
                  label="표시 이름"
                  value={activeDomainEdits.displayName}
                  disabled={confirmDomain.isPending}
                  onChange={(value) => updateDomainEdit("displayName", value)}
                />
                <ProfileMultilineField
                  id="domain-edit-description"
                  label="설명"
                  value={activeDomainEdits.description}
                  disabled={confirmDomain.isPending}
                  onChange={(value) => updateDomainEdit("description", value)}
                />
                <ProfileMultilineField
                  id="domain-edit-lexicon"
                  label="도메인 키워드"
                  hint="쉼표 또는 줄바꿈으로 구분합니다."
                  value={activeDomainEdits.domainLexicon}
                  disabled={confirmDomain.isPending}
                  showChips
                  onChange={(value) => updateDomainEdit("domainLexicon", value)}
                />
                <ProfileMultilineField
                  id="domain-edit-exclusion"
                  label="제외 키워드 (선택)"
                  hint="이 도메인과 무관한 표현을 쉼표 또는 줄바꿈으로 구분합니다."
                  value={activeDomainEdits.exclusionTerms}
                  disabled={confirmDomain.isPending}
                  showChips
                  onChange={(value) =>
                    updateDomainEdit("exclusionTerms", value)
                  }
                />
              </div>
              {selectedDomainTask.payload.confidence !== undefined && (
                <div className={styles.termRow} aria-label="후보 신뢰도">
                  <span className={styles.term}>
                    후보 신뢰도{" "}
                    {formatDomainConfidence(
                      selectedDomainTask.payload.confidence,
                    )}
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <strong className={styles.domainReviewTitle}>
                확정할 도메인을 선택하세요.
              </strong>
              <span className={styles.domainReviewDescription}>
                후보를 선택하면 profile 필드를 다듬어 확정할 수 있습니다.
              </span>
            </>
          )}
          <button
            type="button"
            className={styles.submitButton}
            disabled={
              confirmDomain.isPending ||
              !selectedDomainTask ||
              activeDomainEdits.confirmedDomain.trim() === ""
            }
            onClick={() => {
              if (!selectedDomainTask) {
                return;
              }
              confirmDomain.mutate({
                reviewTaskId: selectedDomainTask.id,
                confirmedDomain: activeDomainEdits.confirmedDomain.trim(),
                displayName: activeDomainEdits.displayName.trim(),
                description: activeDomainEdits.description.trim(),
                domainLexicon: parseTerms(activeDomainEdits.domainLexicon),
                evidenceTerms: parseTerms(activeDomainEdits.evidenceTerms),
                exclusionTerms: parseTerms(activeDomainEdits.exclusionTerms),
              });
            }}
          >
            {confirmDomain.isPending ? "확정 중입니다" : "선택한 도메인 확정"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.card} aria-labelledby="pipeline-feedback-title">
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Human feedback</span>
          <h2 id="pipeline-feedback-title" className={styles.title}>
            애매한 클러스터 경계를 확인합니다.
          </h2>
          <p className={styles.description}>
            답변은 검토 유형에 맞는 intent 또는 workflow scope로 기록됩니다.
          </p>
        </div>
        <span className={styles.badge}>
          {answeredFeedbackCount}/{openTasks.length} answered
        </span>
      </div>
      <div className={styles.feedbackList}>
        {openTasks.map((task) => (
          <div key={task.id} className={styles.feedbackItem}>
            <div className={styles.questionHeader}>
              <p className={styles.question}>
                {task.payload.questionText ??
                  "두 상담을 같은 intent로 묶어도 되나요?"}
              </p>
              <span className={styles.reason}>
                {questionScopeLabel(
                  task.payload.questionType,
                  task.payload.decisionScope,
                )}
              </span>
              <span className={styles.reason}>
                {task.payload.reasonLabel ?? reasonLabel(task.payload.reason)}
              </span>
            </div>
            <div className={styles.caseGrid}>
              <CaseContextCard
                label="A"
                context={task.payload.sourceReviewContext}
                fallbackSnippet={task.payload.sourceSnippet}
              />
              <CaseContextCard
                label="B"
                context={task.payload.targetReviewContext}
                fallbackSnippet={task.payload.targetSnippet}
              />
            </div>
            <div className={styles.choiceRow}>
              {feedbackAnswerOptions(task.payload).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.choiceButton} ${activeFeedbackDecisions[task.id] === value ? styles.choiceButtonSelected : ""}`}
                  aria-pressed={activeFeedbackDecisions[task.id] === value}
                  onClick={() => updateFeedbackDecision(task.id, value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        className={styles.submitButton}
        disabled={submitFeedback.isPending || !allFeedbackResolved}
        onClick={() =>
          submitFeedback.mutate(
            openTasks.map((task) => ({
              reviewTaskId: task.id,
              decisionType: activeFeedbackDecisions[task.id] ?? "unsure",
            })),
            { onSuccess: clearFeedbackDraft },
          )
        }
      >
        피드백 반영 후 replay
      </button>
    </section>
  );
}

function StateActionCard({
  title,
  description,
  children,
  role,
}: {
  title: string;
  description: string;
  children: ReactNode;
  role?: "alert" | "status";
}) {
  return (
    <section className={styles.stateCard} role={role}>
      <div className={styles.stateCopy}>
        <strong className={styles.stateTitle}>{title}</strong>
        <span>{description}</span>
      </div>
      <div className={styles.stateActions}>{children}</div>
    </section>
  );
}

function CaseContextCard({
  label,
  context,
  fallbackSnippet,
}: {
  label: string;
  context?: ReviewCaseContext;
  fallbackSnippet?: string;
}) {
  const summary =
    context?.summary || fallbackSnippet || "업무 내용을 확인할 수 없습니다.";
  const frame = [context?.object, context?.action].filter(Boolean).join(" · ");
  const signals = context?.signals?.filter(Boolean).slice(0, 5) ?? [];

  return (
    <article className={styles.caseCard}>
      <div className={styles.caseHeader}>
        <span className={styles.caseLabel}>{label}</span>
        {context?.conversationId && (
          <span className={styles.caseId}>{context.conversationId}</span>
        )}
      </div>
      <strong className={styles.caseSummary}>{summary}</strong>
      {frame && <span className={styles.caseFrame}>{frame}</span>}
      {fallbackSnippet && (
        <p className={styles.caseSnippet}>{fallbackSnippet}</p>
      )}
      {signals.length > 0 && (
        <div className={styles.signalRow}>
          {signals.map((signal) => (
            <span key={signal} className={styles.signal}>
              {signal}
            </span>
          ))}
        </div>
      )}
      <ConversationExcerpt
        context={context}
        fallbackSnippet={fallbackSnippet}
      />
    </article>
  );
}

function ConversationExcerpt({
  context,
  fallbackSnippet,
}: {
  context?: ReviewCaseContext;
  fallbackSnippet?: string;
}) {
  const turns = context?.turns?.filter((turn) => turn.text?.trim()) ?? [];
  const logExcerpt = context?.logExcerpt?.trim() || fallbackSnippet?.trim();

  if (turns.length === 0 && !logExcerpt) {
    return null;
  }

  return (
    <div className={styles.logBox}>
      <span className={styles.logLabel}>상담 로그 발췌</span>
      {turns.length > 0 ? (
        <div className={styles.turnList}>
          {turns.slice(0, 6).map((turn, index) => (
            <p key={`${turn.role ?? "turn"}-${index}`} className={styles.turn}>
              <span>{normalizeRole(turn.role)}</span>
              {turn.text}
            </p>
          ))}
        </div>
      ) : (
        <p className={styles.logText}>{logExcerpt}</p>
      )}
      {context?.evidenceTurnIds && context.evidenceTurnIds.length > 0 && (
        <span className={styles.turnIds}>
          {context.evidenceTurnIds.slice(0, 5).join(" · ")}
        </span>
      )}
    </div>
  );
}

function normalizeRole(role?: string): string {
  const normalized = role?.toLowerCase();
  if (normalized === "agent" || normalized === "counselor") return "상담사";
  if (normalized === "customer" || normalized === "user") return "고객";
  return role || "기록";
}

function reasonLabel(reason?: string): string {
  if (reason === "same_source_cluster_split") {
    return "같은 클러스터에서 서로 다른 workflow 후보로 갈라졌습니다.";
  }
  if (reason === "low_confidence_cluster_boundary") {
    return "같은 클러스터로 묶였지만 경계 신뢰도가 낮습니다.";
  }
  return "클러스터 경계 판단이 필요합니다.";
}

function questionScopeLabel(
  questionType?: string,
  decisionScope?: string,
): string {
  if (questionType === "WORKFLOW_BOUNDARY") {
    return `Workflow boundary · ${decisionScope || "workflow"} scope`;
  }
  if (questionType === "INTENT_BOUNDARY") {
    return `Intent boundary · ${decisionScope || "intent"} scope`;
  }
  return `${decisionScope || "intent"} scope`;
}

function formatDomainConfidence(confidence: number): string {
  if (confidence >= 0.8) return "1순위";
  if (confidence >= 0.5) return "2순위";
  return "3순위";
}

const LOW_CONFIDENCE_THRESHOLD = 0.5;

function isFallbackCandidate(payload: ReviewTaskPayload): boolean {
  return payload.isFallback === true || payload.kind === "fallback";
}

function fallbackReasonLabel(reason?: string): string {
  switch (reason) {
    case "llm_request_failure":
      return "도메인 분류 호출 실패";
    case "schema_validation_failure":
      return "도메인 분류 응답 오류";
    case "insufficient_evidence":
      return "근거 부족";
    case "genuinely_mixed":
      return "도메인 혼합";
    default:
      return "확정 필요";
  }
}

// 선택한 후보가 fallback이거나 confidence가 낮으면 profile 편집/재검토를 유도한다.
function lowConfidenceGuidance(payload: ReviewTaskPayload): string | null {
  if (isFallbackCandidate(payload)) {
    return `자동 분류가 어려운 후보입니다(${fallbackReasonLabel(payload.fallbackReason)}). profile을 직접 작성하거나 업로드부터 재검토하세요.`;
  }
  if (
    payload.confidence !== undefined &&
    payload.confidence < LOW_CONFIDENCE_THRESHOLD
  ) {
    return "후보 신뢰도가 낮습니다. profile 필드를 직접 다듬거나 다른 후보를 검토하세요.";
  }
  return null;
}

function emptyDomainEdits(): DomainProfileEdits {
  return {
    confirmedDomain: "",
    displayName: "",
    description: "",
    domainLexicon: "",
    evidenceTerms: "",
    exclusionTerms: "",
  };
}

function seedDomainEdits(task?: ReviewTaskView): DomainProfileEdits {
  if (!task) {
    return emptyDomainEdits();
  }
  const name = task.payload.displayName ?? task.title ?? "";
  return {
    confirmedDomain: name,
    displayName: name,
    description: task.payload.description ?? "",
    domainLexicon: (task.payload.suggestedDomainLexicon ?? []).join(", "),
    evidenceTerms: (task.payload.evidenceTerms ?? []).join(", "),
    exclusionTerms: "",
  };
}

// 쉼표/줄바꿈으로 구분된 입력을 trim·중복제거해 term 배열로 변환한다.
function parseTerms(value: string): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const raw of value.split(/[,\n]/)) {
    const term = raw.trim();
    if (term && !seen.has(term)) {
      seen.add(term);
      terms.push(term);
    }
  }
  return terms;
}

function ProfileTextField({
  id,
  label,
  value,
  disabled,
  invalid,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.fieldLabel}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        className={styles.textInput}
        value={value}
        disabled={disabled}
        aria-invalid={invalid}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function ProfileMultilineField({
  id,
  label,
  hint,
  value,
  disabled,
  showChips,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  disabled: boolean;
  showChips?: boolean;
  onChange: (value: string) => void;
}) {
  const hintId = `${id}-hint`;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.fieldLabel}>
        {label}
      </label>
      {hint && (
        <span id={hintId} className={styles.fieldHint}>
          {hint}
        </span>
      )}
      <textarea
        id={id}
        className={styles.textArea}
        value={value}
        disabled={disabled}
        aria-describedby={hint ? hintId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {showChips && <DomainTermChips value={value} />}
    </div>
  );
}

function DomainTermChips({ value }: { value: string }) {
  const terms = parseTerms(value);
  if (terms.length === 0) {
    return null;
  }
  return (
    <div className={styles.termRow} aria-hidden="true">
      {terms.map((term) => (
        <span key={term} className={styles.term}>
          {term}
        </span>
      ))}
    </div>
  );
}

function feedbackAnswerOptions(payload: {
  questionType?: string;
  answerOptions?: FeedbackAnswerOption[];
}): Array<{ value: FeedbackDecision; label: string }> {
  const options =
    payload.answerOptions
      ?.map((option) => ({
        value: option.value?.trim() ?? "",
        label: option.label?.trim() ?? option.value?.trim() ?? "",
      }))
      .filter((option) => option.value && option.label) ?? [];

  if (options.length > 0) {
    return options;
  }

  if (payload.questionType === "WORKFLOW_BOUNDARY") {
    return WORKFLOW_FEEDBACK_ANSWER_OPTIONS;
  }
  return INTENT_FEEDBACK_ANSWER_OPTIONS;
}

function createFeedbackDraftStorageKey(
  workspaceId?: number,
  pipelineJobId?: number,
): string | null {
  if (workspaceId == null || pipelineJobId == null) {
    return null;
  }
  return `${FEEDBACK_DRAFT_KEY_PREFIX}:${workspaceId}:${pipelineJobId}`;
}

function readFeedbackDraft(
  storageKey: string,
  openTaskIds: number[],
  allowedValuesByTaskId: Map<number, Set<string>>,
): FeedbackDecisions {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return {};
    }

    return filterFeedbackDecisions(
      JSON.parse(raw) as Record<string, unknown>,
      openTaskIds,
      allowedValuesByTaskId,
    );
  } catch {
    return {};
  }
}

function writeFeedbackDraft(storageKey: string, decisions: FeedbackDecisions) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (Object.keys(decisions).length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(decisions));
  } catch {
    // Feedback can still be submitted even when browser storage is unavailable.
  }
}

function removeFeedbackDraft(storageKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Ignore storage failures; local component state is enough for the current session.
  }
}

function filterFeedbackDecisions(
  decisions: Record<string, unknown>,
  openTaskIds: number[],
  allowedValuesByTaskId: Map<number, Set<string>>,
): FeedbackDecisions {
  const openTaskIdSet = new Set(openTaskIds);

  return Object.entries(decisions).reduce<FeedbackDecisions>(
    (filtered, [taskId, decision]) => {
      const numericTaskId = Number(taskId);
      const allowedValues = allowedValuesByTaskId.get(numericTaskId);
      if (
        openTaskIdSet.has(numericTaskId) &&
        isFeedbackDecision(decision) &&
        allowedValues?.has(decision)
      ) {
        filtered[numericTaskId] = decision;
      }
      return filtered;
    },
    {},
  );
}

function isFeedbackDecision(value: unknown): value is FeedbackDecision {
  return typeof value === "string" && value.trim().length > 0;
}

function checkpointStateTitle(pipelineStatus?: string): string {
  if (pipelineStatus === "SUCCEEDED") {
    return "리뷰 체크포인트가 완료되었습니다.";
  }
  if (pipelineStatus === "FAILED") {
    return "파이프라인이 실패했습니다.";
  }
  if (pipelineStatus === "CANCELLED") {
    return "파이프라인이 취소되었습니다.";
  }
  return "활성 리뷰 체크포인트가 없습니다.";
}

function checkpointStateDescription(pipelineStatus?: string): string {
  if (pipelineStatus === "SUCCEEDED") {
    return "생성된 Domain Pack 초안에서 최종 검토를 이어갈 수 있습니다.";
  }
  if (pipelineStatus === "FAILED") {
    return "업로드를 다시 시작하거나 현재 job 상태를 다시 조회할 수 있습니다.";
  }
  if (pipelineStatus === "CANCELLED") {
    return "업로드를 다시 시작하거나 취소된 job 상태를 다시 조회할 수 있습니다.";
  }
  return "파이프라인이 검토 입력을 기다리는 상태가 되면 이 화면에 작업이 표시됩니다. 완료 전 승인/적용은 시작하지 않습니다.";
}
