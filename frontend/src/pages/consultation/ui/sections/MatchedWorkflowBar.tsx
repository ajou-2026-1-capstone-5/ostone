import { useState, type FocusEvent, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";

import { Mono, Pill, type PillTone } from "@/shared/ui/ostone/atoms";
import { WorkflowGraphMiniSvg } from "@/entities/workflow";
import { domainPackSectionPath } from "@/shared/lib/domainPackRoutes";
import type { MatchedWorkflow } from "../../../../features/consultation/api/llmToolWorkflowApi";

import styles from "./MatchedWorkflowBar.module.css";

interface MatchedWorkflowBarProps {
  workflow: MatchedWorkflow;
}

const STATUS_TONE: Record<string, PillTone> = {
  RUNNING: "signal",
  COMPLETED: "info",
  FAILED: "danger",
  CANCELED: "mute",
};

function resolveStatusTone(status: string | null): PillTone {
  if (!status) return "mute";
  return STATUS_TONE[status.toUpperCase()] ?? "mute";
}

function buildMeta(workflow: MatchedWorkflow): string {
  const parts: string[] = [];
  if (workflow.workflowCode) parts.push(`응대 코드 ${workflow.workflowCode}`);
  if (workflow.domainPackVersionId != null) parts.push(`v${workflow.domainPackVersionId}`);
  if (workflow.currentState) parts.push(workflow.currentState);
  return parts.join(" · ");
}

export function MatchedWorkflowBar({ workflow }: MatchedWorkflowBarProps) {
  const navigate = useNavigate();
  const [previewOpen, setPreviewOpen] = useState(false);
  const title = workflow.workflowName ?? workflow.workflowCode ?? "응대 흐름";
  const meta = buildMeta(workflow);
  const statusLabel = formatExecutionStatus(workflow.executionStatus);
  const tone = resolveStatusTone(workflow.executionStatus);

  const canNavigate =
    workflow.workspaceId != null &&
    workflow.domainPackId != null &&
    workflow.domainPackVersionId != null;

  const handleClick = () => {
    if (!canNavigate) return;
    navigate(
      domainPackSectionPath(
        workflow.workspaceId as number,
        workflow.domainPackId as number,
        workflow.domainPackVersionId as number,
        "workflows",
        workflow.workflowDefinitionId,
      ),
    );
  };

  const handleMouseLeave = (event: MouseEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(document.activeElement)) {
      setPreviewOpen(false);
    }
  };

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    const nextTarget = event.relatedTarget;
    if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
      setPreviewOpen(false);
    }
  };

  return (
    <article
      className={styles.bar}
      data-testid="matched-workflow-bar"
      data-state={previewOpen ? "open" : "closed"}
      aria-label="매칭된 응대 흐름"
      onMouseEnter={() => setPreviewOpen(true)}
      onMouseLeave={handleMouseLeave}
      onFocusCapture={() => setPreviewOpen(true)}
      onBlurCapture={handleBlur}
    >
      <button
        type="button"
        className={styles.toggle}
        onClick={handleClick}
        disabled={!canNavigate}
        data-testid="matched-workflow-bar-open"
      >
        <span className={styles.label}>응대 흐름</span>
        <span className={styles.title} data-testid="matched-workflow-bar-title">
          {title}
        </span>
      </button>

      <div className={styles.expandedWrapper} aria-hidden={!previewOpen}>
        <div className={styles.expandedInner}>
          {previewOpen && (
            <div className={styles.expanded} data-testid="matched-workflow-bar-preview">
              <div className={styles.metaRow}>
                <Pill tone={tone}>{statusLabel}</Pill>
                {meta && (
                  <span data-testid="matched-workflow-bar-meta">
                    <Mono className={styles.meta}>{meta}</Mono>
                  </span>
                )}
              </div>
              {workflow.workflowDescription && (
                <p className={styles.description} data-testid="matched-workflow-bar-description">
                  {workflow.workflowDescription}
                </p>
              )}
              <div className={styles.graphSlot} data-testid="matched-workflow-bar-graph">
                {workflow.graphJson != null ? (
                  <WorkflowGraphMiniSvg
                    workflowId={workflow.workflowDefinitionId}
                    graphJson={workflow.graphJson}
                  />
                ) : (
                  <span className={styles.graphMissing}>흐름 미리보기 없음</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function MatchedWorkflowBarSkeleton() {
  return (
    <div
      className={styles.skeleton}
      data-testid="matched-workflow-bar-skeleton"
      aria-busy="true"
      aria-label="매칭된 응대 흐름 로딩 중"
    >
      <span className={styles.skeletonBar} />
    </div>
  );
}

function formatExecutionStatus(status: string | null): string {
  const labels: Record<string, string> = {
    RUNNING: "진행 중",
    COMPLETED: "완료",
    FAILED: "실패",
    CANCELED: "취소됨",
  };
  return status ? (labels[status.toUpperCase()] ?? status) : "상태 미확인";
}
