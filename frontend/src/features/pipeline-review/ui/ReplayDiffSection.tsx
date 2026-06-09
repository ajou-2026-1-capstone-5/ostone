import { type ReactNode } from "react";
import { RefreshCwIcon } from "lucide-react";
import {
  type ReplayDecision,
  type ReplayDecisionStatus,
  type ReplayStructureDiff,
  useReplayDiff,
} from "../api/pipelineReviewApi";
import styles from "./PipelineReviewCheckpointCard.module.css";

interface Props {
  workspaceId?: number;
  pipelineJobId?: number;
}

const SECTION_EYEBROW = "Feedback replay";
const SECTION_TITLE = "이번 피드백으로 바뀐 것";

const DECISION_STATUS_LABEL: Record<ReplayDecisionStatus, string> = {
  applied: "적용됨",
  partially_applied: "부분 적용",
  ignored: "미적용",
};

const DECISION_STATUS_CLASS: Record<ReplayDecisionStatus, string> = {
  applied: styles.statusApplied,
  partially_applied: styles.statusPartial,
  ignored: styles.statusIgnored,
};

// ML/백엔드가 내려주는 사유 코드를 운영자용 한국어 문구로 옮긴다. 미정의 코드는 원문을 노출한다.
const REASON_LABEL: Record<string, string> = {
  endpoint_not_in_candidate:
    "대상 상담이 이번 후보 결과에 포함되지 않았습니다.",
  intent_not_merged: "두 상담이 같은 intent로 합쳐지지 않았습니다.",
  intent_not_separated: "두 상담이 여전히 같은 intent로 남아 있습니다.",
  endpoints_in_different_clusters:
    "두 상담이 서로 다른 클러스터에 있어 workflow에 반영되지 않았습니다.",
  conflicts_with_same_workflow:
    "같은 workflow로 묶으라는 다른 피드백과 충돌했습니다.",
  workflow_separated_but_intent_differs:
    "workflow는 분리됐지만 두 상담의 intent가 서로 달라졌습니다.",
  not_evaluated: "이 피드백은 이번 replay에서 평가되지 않았습니다.",
  source_candidate_not_found:
    "비교할 이전 replay 결과를 찾지 못해 구조 비교를 생략했습니다.",
  diff_not_emitted: "이번 replay 산출물에 변경 정보가 포함되지 않았습니다.",
  structure_snapshot_missing: "구조 스냅샷이 없어 변경을 계산할 수 없습니다.",
  no_feedback_constraints: "제출된 피드백 결정이 없습니다.",
};

const DECISION_SCOPE_LABEL: Record<string, string> = {
  intent: "Intent",
  workflow: "Workflow",
};

// workflow 적용 결과를 함께 보여 traceability를 높인다.
const EFFECT_LABEL: Record<string, string> = {
  merged: "병합됨",
  split: "분리됨",
  already_same: "이미 동일",
  already_separate: "이미 분리",
};

function reasonText(reason: string | null): string | null {
  if (!reason) {
    return null;
  }
  return REASON_LABEL[reason] ?? reason;
}

function SectionShell({ children }: { children: ReactNode }) {
  return (
    <section
      className={styles.replaySection}
      aria-labelledby="replay-diff-title"
    >
      <div>
        <span className={styles.eyebrow}>{SECTION_EYEBROW}</span>
        <h3 id="replay-diff-title" className={styles.title}>
          {SECTION_TITLE}
        </h3>
      </div>
      {children}
    </section>
  );
}

export function ReplayDiffSection({ workspaceId, pipelineJobId }: Props) {
  const query = useReplayDiff(workspaceId, pipelineJobId);

  if (workspaceId == null || pipelineJobId == null) {
    return null;
  }

  if (query.isLoading) {
    return (
      <SectionShell>
        <p className={styles.description}>
          피드백 반영 결과를 불러오는 중입니다.
        </p>
      </SectionShell>
    );
  }

  // diff 조회 실패는 draft 성공으로 오인하지 않도록 별도 fallback으로 명확히 알린다.
  if (query.isError) {
    return (
      <SectionShell>
        <p className={styles.description} role="alert">
          피드백 반영 결과를 확인하지 못했습니다. 변경 내용을 확인할 수 없으므로
          초안을 성공으로 간주하지 말고 다시 조회해 주세요.
        </p>
        <button
          type="button"
          className={styles.stateActionSecondary}
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          <RefreshCwIcon aria-hidden="true" />
          다시 조회
        </button>
      </SectionShell>
    );
  }

  const diff = query.data;
  if (!diff || diff.status === "NOT_APPLICABLE") {
    return null;
  }

  if (diff.status === "PENDING") {
    return (
      <SectionShell>
        <p className={styles.description} role="status">
          피드백을 반영해 replay를 진행하고 있습니다. 변경 요약은 완료되면
          표시됩니다.
        </p>
      </SectionShell>
    );
  }

  if (diff.status === "UNAVAILABLE") {
    return (
      <SectionShell>
        <p className={styles.description} role="status">
          이번 피드백의 변경 요약을 가져오지 못했습니다. 초안을 성공으로
          단정하지 말고 아래 사유를 확인해 주세요.
        </p>
        <p className={styles.replayReason}>
          {reasonText(diff.reason) ?? "원인을 확인할 수 없습니다."}
        </p>
      </SectionShell>
    );
  }

  return (
    <SectionShell>
      <p className={styles.description}>
        제출한 피드백이 intent/workflow 구조에 어떻게 반영됐는지 보여줍니다.
        Domain Pack 초안으로 넘어가기 전에 확인하세요.
      </p>

      <div
        className={styles.summaryRow}
        role="list"
        aria-label="피드백 반영 요약"
      >
        <span
          className={`${styles.summaryChip} ${styles.statusApplied}`}
          role="listitem"
        >
          적용 {diff.summary.applied}
        </span>
        <span
          className={`${styles.summaryChip} ${styles.statusPartial}`}
          role="listitem"
        >
          부분 {diff.summary.partiallyApplied}
        </span>
        <span
          className={`${styles.summaryChip} ${styles.statusIgnored}`}
          role="listitem"
        >
          미적용 {diff.summary.ignored}
        </span>
      </div>

      {diff.structureComparisonAvailable ? (
        <div className={styles.structureGrid}>
          <StructureSummary title="Intent 구조 변화" diff={diff.intent} />
          <StructureSummary title="Workflow 구조 변화" diff={diff.workflow} />
        </div>
      ) : (
        <p className={styles.replayReason}>
          이전 replay 결과를 찾지 못해 split/merge·label 변경 요약은
          생략했습니다. 아래 결정별 반영 상태는 그대로 확인할 수 있습니다.
        </p>
      )}

      {diff.decisions.length > 0 ? (
        <ul className={styles.decisionList}>
          {diff.decisions.map((decision, index) => (
            <DecisionRow
              key={`${decision.reviewTaskId ?? "x"}-${index}`}
              decision={decision}
            />
          ))}
        </ul>
      ) : (
        <p className={styles.replayReason}>표시할 피드백 결정이 없습니다.</p>
      )}
    </SectionShell>
  );
}

function StructureSummary({
  title,
  diff,
}: {
  title: string;
  diff: ReplayStructureDiff;
}) {
  return (
    <div className={styles.structureCard}>
      <span className={styles.structureTitle}>{title}</span>
      <p className={styles.structureCounts}>
        분리 {diff.splitCount} · 병합 {diff.mergeCount} · 라벨 변경{" "}
        {diff.labelChanges.length}
      </p>
      {diff.labelChanges.length > 0 && (
        <ul className={styles.labelChangeList}>
          {diff.labelChanges.map((change) => (
            <li key={change.id} className={styles.labelChange}>
              <span className={styles.labelBefore}>
                {change.before || "(없음)"}
              </span>
              <span aria-hidden="true">→</span>
              <span className={styles.labelAfter}>
                {change.after || "(없음)"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DecisionRow({ decision }: { decision: ReplayDecision }) {
  const reason = reasonText(decision.reason);
  const scopeLabel = DECISION_SCOPE_LABEL[decision.scope] ?? decision.scope;
  const effectLabel = decision.effect ? EFFECT_LABEL[decision.effect] : null;
  return (
    <li className={styles.decisionItem}>
      <div className={styles.decisionHead}>
        <span className={styles.decisionScope}>{scopeLabel}</span>
        <span className={styles.decisionPair}>
          {decision.sourceId} ↔ {decision.targetId}
        </span>
        {effectLabel && (
          <span className={styles.decisionEffect}>{effectLabel}</span>
        )}
        <span
          className={`${styles.decisionStatus} ${DECISION_STATUS_CLASS[decision.status]}`}
        >
          {DECISION_STATUS_LABEL[decision.status]}
        </span>
      </div>
      {reason && <p className={styles.decisionReason}>{reason}</p>}
    </li>
  );
}
