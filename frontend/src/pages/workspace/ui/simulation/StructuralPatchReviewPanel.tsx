import type { ReactNode } from "react";

import type {
  SimulationImprovementCandidate,
  SimulationImprovementCandidateStatus,
} from "@/features/simulation";
import { Button } from "@/shared/ui/button";

import {
  buildStructuralPatchReview,
  evaluateApprovalGuardrail,
  type PatchOperationDiff,
  type StructuralPatchReviewModel,
} from "./structuralPatchReview";
import styles from "./workspace-simulation-page.module.css";

interface StructuralPatchReviewProps {
  readonly candidate: SimulationImprovementCandidate;
  readonly confirmed: boolean;
  readonly onToggleConfirm: () => void;
  readonly legacyFallback: ReactNode;
  readonly onReplayAppliedVersion?: (versionId: number) => void;
}

const APPLIED_STATUS: SimulationImprovementCandidateStatus = "APPLIED";

function candidateStatusBadgeLabel(candidate: SimulationImprovementCandidate): string {
  switch (candidate.status) {
    case "DRAFT":
      return "초안 패치";
    case "READY_FOR_REVIEW":
      return "리뷰 대기";
    case "APPLIED":
      return candidate.appliedDomainPackVersionId
        ? "초안 버전 반영됨"
        : "승인됨 · 적용 버전 응답 대기";
    case "REJECTED":
      return "반려됨";
    default:
      return candidate.status;
  }
}

function patchValidationBadgeLabel(model: StructuralPatchReviewModel): string {
  switch (model.status) {
    case "VALID":
      return "검증 통과";
    case "INVALID":
      return "검증 실패";
    case "LEGACY":
      return "레거시 패치";
    case "NONE":
    default:
      return "패치 없음";
  }
}

function StructuralReviewShell({
  candidate,
  model,
  children,
}: Readonly<{
  candidate: SimulationImprovementCandidate;
  model: StructuralPatchReviewModel;
  children: ReactNode;
}>) {
  return (
    <section className={styles.candidatePatchPanel} aria-label="구조 패치 검토">
      <div className={styles.candidatePatchHeader}>
        <div>
          <strong>구조 패치 검토</strong>
          <span>승인 시 초안 Domain Pack 버전에 반영됩니다. 아직 운영에 적용된 변경이 아닙니다.</span>
        </div>
        <span className={styles.structuralBadgeGroup}>
          {model.hasWorkflowStructureChange ? (
            <span className={styles.workflowStructureBadge}>워크플로우 구조 변경</span>
          ) : null}
          <span
            className={
              model.status === "VALID" ? styles.patchStatusReady : styles.patchStatusBlocked
            }
          >
            {patchValidationBadgeLabel(model)}
          </span>
          <span className={styles.statusPill}>{candidateStatusBadgeLabel(candidate)}</span>
        </span>
      </div>
      {children}
    </section>
  );
}

function CandidateOverview({
  candidate,
  model,
}: Readonly<{
  candidate: SimulationImprovementCandidate;
  model: StructuralPatchReviewModel;
}>) {
  const targetReference = [
    candidate.targetElementKey,
    candidate.targetElementId !== null ? `#${candidate.targetElementId}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <dl className={styles.patchMetaList} aria-label="패치 개요">
      <div>
        <dt>대상 요소</dt>
        <dd>{candidate.targetElementType}</dd>
      </div>
      <div>
        <dt>대상 식별자</dt>
        <dd>{targetReference || "(미지정)"}</dd>
      </div>
      <div>
        <dt>출처</dt>
        <dd>
          세션 #{candidate.sessionId} · 피드백 #{candidate.feedbackId}
        </dd>
      </div>
      {model.summary ? (
        <div>
          <dt>패치 요약</dt>
          <dd>{model.summary}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function EvidencePanel({ candidate }: Readonly<{ candidate: SimulationImprovementCandidate }>) {
  return (
    <div className={styles.evidencePanel} aria-label="검토 근거">
      <span>근거</span>
      <p>{candidate.evidenceSummary}</p>
      <ul>
        <li>세션 #{candidate.sessionId}</li>
        {candidate.chatMessageId ? <li>메시지 #{candidate.chatMessageId}</li> : null}
        <li>피드백 #{candidate.feedbackId}</li>
      </ul>
    </div>
  );
}

function StructuralDiffCard({ diff }: Readonly<{ diff: PatchOperationDiff }>) {
  return (
    <article className={styles.diffOpCard}>
      <header className={styles.diffOpHeader}>
        <strong>{diff.operationLabel}</strong>
        <span>{diff.targetLabel}</span>
      </header>
      {diff.targetComplete ? null : (
        <p className={styles.diffTargetWarning}>대상 확인 불가 — 적용 전 검증이 필요합니다.</p>
      )}
      <dl className={styles.patchChangeList}>
        {diff.fields.map((field, index) => (
          <div key={`${field.label}-${index}`} className={styles.diffBeforeAfter}>
            <dt>{field.label}</dt>
            <dd>
              <span>Before</span>
              <p>{field.before}</p>
            </dd>
            <dd>
              <span>After</span>
              <p>{field.after}</p>
            </dd>
          </div>
        ))}
      </dl>
      {diff.reason ? (
        <p className={styles.diffReason}>
          <span>근거</span>
          {diff.reason}
        </p>
      ) : null}
    </article>
  );
}

function RawPatchDetails({ candidate }: Readonly<{ candidate: SimulationImprovementCandidate }>) {
  return (
    <details className={styles.patchRawDetails}>
      <summary>원본 patch JSON</summary>
      <pre>
        <code>{candidate.draftPatchJson}</code>
      </pre>
    </details>
  );
}

function ApprovedReplayCta({
  candidate,
  onReplay,
}: Readonly<{
  candidate: SimulationImprovementCandidate;
  onReplay: ((versionId: number) => void) | undefined;
}>) {
  if (candidate.status !== APPLIED_STATUS) return null;
  const versionId = candidate.appliedDomainPackVersionId;
  return (
    <div className={styles.approvedReplayCta} role="status">
      {versionId ? (
        <p>
          초안 버전 #{versionId}에 반영했습니다. 같은 버전으로 검증 케이스를 리플레이해 회귀를
          확인하세요.
        </p>
      ) : (
        <p>승인을 처리했지만 적용 버전 응답을 기다리는 중입니다.</p>
      )}
      {versionId && onReplay ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onReplay(versionId)}
        >
          <span>이 버전으로 검증 케이스 리플레이</span>
        </Button>
      ) : null}
    </div>
  );
}

export function StructuralPatchReview({
  candidate,
  confirmed,
  onToggleConfirm,
  legacyFallback,
  onReplayAppliedVersion,
}: Readonly<StructuralPatchReviewProps>) {
  const model = buildStructuralPatchReview(candidate);

  if (model.kind === "legacy") {
    return <>{legacyFallback}</>;
  }

  if (model.kind === "missing") {
    return (
      <StructuralReviewShell candidate={candidate} model={model}>
        <CandidateOverview candidate={candidate} model={model} />
        <p className={styles.patchUnavailableMessage}>
          {model.message ?? "draft patch 정보가 없습니다."}
        </p>
        <p className={styles.patchConfirmHint}>
          패치 내용을 확인할 수 없어 승인할 수 없습니다. 후보 생성 데이터를 먼저 확인하세요.
        </p>
      </StructuralReviewShell>
    );
  }

  if (model.kind === "invalid") {
    return (
      <StructuralReviewShell candidate={candidate} model={model}>
        <CandidateOverview candidate={candidate} model={model} />
        <p className={styles.patchUnavailableMessage}>
          {model.message ?? "패치 검증에 실패했습니다."}
        </p>
        {model.errors.length > 0 ? (
          <ul className={styles.validationErrorList} aria-label="검증 오류 목록">
            {model.errors.map((error, index) => (
              <li key={`${index}-${error}`}>{error}</li>
            ))}
          </ul>
        ) : null}
        <RawPatchDetails candidate={candidate} />
        <p className={styles.patchConfirmHint}>검증 실패 상태에서는 승인할 수 없습니다.</p>
      </StructuralReviewShell>
    );
  }

  const guardrail = evaluateApprovalGuardrail(model, confirmed);
  return (
    <StructuralReviewShell candidate={candidate} model={model}>
      <CandidateOverview candidate={candidate} model={model} />
      <EvidencePanel candidate={candidate} />
      <div className={styles.structuralDiffPanel} aria-label="구조 변경 상세">
        {model.diffs.map((diff, index) => (
          <StructuralDiffCard key={`${diff.operationType}-${index}`} diff={diff} />
        ))}
      </div>
      <div className={styles.guardrailChecklist}>
        <label>
          <input type="checkbox" checked={confirmed} onChange={onToggleConfirm} />
          <span>워크플로우 구조 변경을 검토했습니다</span>
        </label>
        {guardrail.disabledReasons.length > 0 ? (
          <ul aria-label="승인 차단 사유">
            {guardrail.disabledReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <RawPatchDetails candidate={candidate} />
      <ApprovedReplayCta candidate={candidate} onReplay={onReplayAppliedVersion} />
    </StructuralReviewShell>
  );
}
