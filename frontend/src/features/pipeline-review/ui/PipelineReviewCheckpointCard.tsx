import { useMemo, useState } from "react";
import {
  type ReviewCaseContext,
  useConfirmPipelineDomain,
  usePipelineReviewCheckpoint,
  useSubmitPipelineFeedback,
} from "../api/pipelineReviewApi";
import styles from "./PipelineReviewCheckpointCard.module.css";

interface Props {
  workspaceId?: number;
  pipelineJobId?: number;
}

export function PipelineReviewCheckpointCard({ workspaceId, pipelineJobId }: Props) {
  const query = usePipelineReviewCheckpoint(workspaceId, pipelineJobId);
  const confirmDomain = useConfirmPipelineDomain(workspaceId, pipelineJobId);
  const submitFeedback = useSubmitPipelineFeedback(workspaceId, pipelineJobId);
  const [feedbackDecisions, setFeedbackDecisions] = useState<Record<number, string>>({});

  const openTasks = useMemo(
    () => query.data?.tasks.filter((task) => task.status === "OPEN") ?? [],
    [query.data?.tasks],
  );
  const allFeedbackResolved =
    openTasks.length > 0 && openTasks.every((task) => feedbackDecisions[task.id] !== undefined);

  if (!pipelineJobId) {
    return null;
  }

  if (query.isLoading) {
    return <section className={styles.stateCard}>리뷰 체크포인트를 불러오는 중입니다.</section>;
  }

  if (query.isError) {
    return <section className={styles.stateCard}>리뷰 체크포인트를 불러오지 못했습니다.</section>;
  }

  if (!query.data?.reviewKind) {
    return (
      <section className={styles.stateCard}>
        <strong className={styles.stateTitle}>{checkpointStateTitle(query.data?.pipelineStatus)}</strong>
        <span>{checkpointStateDescription(query.data?.pipelineStatus)}</span>
      </section>
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
            <p className={styles.description}>선택한 도메인 profile이 intent clustering 입력으로 사용됩니다.</p>
          </div>
          <span className={styles.badge}>{openTasks.length} candidates</span>
        </div>
        <div className={styles.domainGrid}>
          {openTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              className={styles.domainOption}
              disabled={confirmDomain.isPending}
              onClick={() => confirmDomain.mutate(task.id)}
            >
              <span className={styles.optionHeader}>
                <strong>{task.payload.displayName ?? task.title}</strong>
                {task.payload.confidence !== undefined && (
                  <span className={styles.confidence}>{Math.round(task.payload.confidence * 100)}%</span>
                )}
              </span>
              <span className={styles.optionDescription}>{task.payload.description}</span>
              <span className={styles.termRow}>
                {(task.payload.evidenceTerms ?? []).slice(0, 6).map((term) => (
                  <span key={term} className={styles.term}>
                    {term}
                  </span>
                ))}
              </span>
            </button>
          ))}
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
          <p className={styles.description}>답변은 같은 업무/다른 업무 제약으로 replay에 반영됩니다.</p>
        </div>
        <span className={styles.badge}>
          {Object.keys(feedbackDecisions).length}/{openTasks.length} answered
        </span>
      </div>
      <div className={styles.feedbackList}>
        {openTasks.map((task) => (
          <div key={task.id} className={styles.feedbackItem}>
            <div className={styles.questionHeader}>
              <p className={styles.question}>{task.payload.questionText ?? "두 상담을 같은 intent로 묶어도 되나요?"}</p>
              <span className={styles.reason}>{task.payload.reasonLabel ?? reasonLabel(task.payload.reason)}</span>
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
              {[
                ["must_link", "같은 intent로 묶기"],
                ["cannot_link", "분리하기"],
                ["unsure", "판단 보류"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.choiceButton} ${feedbackDecisions[task.id] === value ? styles.choiceButtonSelected : ""}`}
                  aria-pressed={feedbackDecisions[task.id] === value}
                  onClick={() => setFeedbackDecisions((current) => ({ ...current, [task.id]: value }))}
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
              decisionType: feedbackDecisions[task.id] ?? "unsure",
            })),
          )
        }
      >
        피드백 반영 후 replay
      </button>
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
  const summary = context?.summary || fallbackSnippet || "업무 내용을 확인할 수 없습니다.";
  const frame = [context?.object, context?.action].filter(Boolean).join(" · ");
  const signals = context?.signals?.filter(Boolean).slice(0, 5) ?? [];

  return (
    <article className={styles.caseCard}>
      <div className={styles.caseHeader}>
        <span className={styles.caseLabel}>{label}</span>
        {context?.conversationId && <span className={styles.caseId}>{context.conversationId}</span>}
      </div>
      <strong className={styles.caseSummary}>{summary}</strong>
      {frame && <span className={styles.caseFrame}>{frame}</span>}
      {fallbackSnippet && <p className={styles.caseSnippet}>{fallbackSnippet}</p>}
      {signals.length > 0 && (
        <div className={styles.signalRow}>
          {signals.map((signal) => (
            <span key={signal} className={styles.signal}>
              {signal}
            </span>
          ))}
        </div>
      )}
      <ConversationExcerpt context={context} fallbackSnippet={fallbackSnippet} />
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
        <span className={styles.turnIds}>{context.evidenceTurnIds.slice(0, 5).join(" · ")}</span>
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

function checkpointStateTitle(pipelineStatus?: string): string {
  if (pipelineStatus === "SUCCEEDED") {
    return "리뷰 체크포인트가 완료되었습니다.";
  }
  if (pipelineStatus === "FAILED") {
    return "파이프라인이 실패했습니다.";
  }
  return "활성 리뷰 체크포인트가 없습니다.";
}

function checkpointStateDescription(pipelineStatus?: string): string {
  if (pipelineStatus === "SUCCEEDED") {
    return "생성된 Domain Pack 초안에서 최종 검토를 이어갈 수 있습니다.";
  }
  if (pipelineStatus === "FAILED") {
    return "실패 원인은 파이프라인 job 상세에서 확인할 수 있습니다.";
  }
  return "파이프라인이 검토 입력을 기다리는 상태가 되면 이 화면에 작업이 표시됩니다.";
}
