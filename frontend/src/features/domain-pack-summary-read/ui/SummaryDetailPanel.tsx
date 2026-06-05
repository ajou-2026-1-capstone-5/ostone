import { useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { DomainPackVersionDetail } from "@/entities/domain-pack";
import { ApiRequestError } from "@/shared/api";
import { Button } from "@/shared/ui/button";
import { ErrorState } from "@/shared/ui/ostone/atoms/ErrorState";
import { Spinner } from "@/shared/ui/spinner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { SummaryJsonCard } from "./SummaryJsonCard";
import { ComponentCountGrid } from "./ComponentCountGrid";
import { useDomainPackRevisionSummary } from "../model/useDomainPackRevisionSummary";
import styles from "./SummaryDetailPanel.module.css";

interface SummaryDetailPanelProps {
  query: UseQueryResult<DomainPackVersionDetail>;
  wsId: number;
  packId: number;
  currentVersionId?: number | null;
  currentVersionNo?: number | null;
  deployingVersionId?: number | null;
  applyingVersionId?: number | null;
  discardingVersionId?: number | null;
  onDeploy?: (versionId: number) => void;
  onApplyDraft?: (versionId: number, description?: string) => void;
  onDiscardDraft?: (versionId: number) => void;
}

export function SummaryDetailPanel({
  query,
  wsId,
  packId,
  currentVersionId = null,
  currentVersionNo = null,
  deployingVersionId = null,
  applyingVersionId = null,
  discardingVersionId = null,
  onDeploy,
  onApplyDraft,
  onDiscardDraft,
}: Readonly<SummaryDetailPanelProps>) {
  const [isDeployDialogOpen, setDeployDialogOpen] = useState(false);
  const [isApplyDialogOpen, setApplyDialogOpen] = useState(false);
  const [isDiscardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [applyDescription, setApplyDescription] = useState("");
  const v = query.data;
  const versionId = v?.versionId;
  const isCurrentVersion = versionId != null && versionId === currentVersionId;
  const isDeploying = versionId != null && versionId === deployingVersionId;
  const isApplying = versionId != null && versionId === applyingVersionId;
  const isDiscarding = versionId != null && versionId === discardingVersionId;
  const isDraftVersion = v?.lifecycleStatus === "DRAFT";
  const targetVersionLabel = formatVersionNo(v?.versionNo);
  const currentVersionLabel = formatCurrentVersionLabel(currentVersionNo, currentVersionId);
  const canDeploy =
    onDeploy != null && versionId != null && !isCurrentVersion && !isDeploying && !isDraftVersion;
  const canApplyDraft =
    onApplyDraft != null && versionId != null && isDraftVersion && !isApplying && !isDiscarding;
  const canDiscardDraft =
    onDiscardDraft != null && versionId != null && isDraftVersion && !isApplying && !isDiscarding;
  const revisionSummaryState = useDomainPackRevisionSummary({
    workspaceId: wsId,
    packId,
    versionId,
    summaryJson: v?.summaryJson,
  });

  const handleConfirmDeploy = () => {
    if (!canDeploy) return;
    onDeploy(versionId);
    setDeployDialogOpen(false);
  };
  const handleConfirmApply = () => {
    if (!canApplyDraft) return;
    onApplyDraft(versionId, normalizeDescription(applyDescription));
    setApplyDialogOpen(false);
  };
  const handleConfirmDiscard = () => {
    if (!canDiscardDraft) return;
    onDiscardDraft(versionId);
    setDiscardDialogOpen(false);
  };

  if (!query.isFetching && !query.data && !query.isLoading && !query.isError) {
    return (
      <div className={styles.panel}>
        <div className={styles.placeholder}>버전을 선택하세요.</div>
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className={styles.panel}>
        <div className={styles.skeleton} aria-label="로딩 중">
          <div className={styles.skeletonBlock} style={{ height: 80 }} aria-hidden />
          <div className={styles.skeletonBlock} style={{ height: 160 }} aria-hidden />
          <div className={styles.skeletonBlock} style={{ height: 200 }} aria-hidden />
        </div>
      </div>
    );
  }

  if (query.isError) {
    const is404 = query.error instanceof ApiRequestError && query.error.status === 404;
    return (
      <div className={styles.panel}>
        <ErrorState
          message={is404 ? "버전을 찾을 수 없습니다." : "버전 정보를 불러오지 못했습니다."}
          onRetry={!is404 ? () => query.refetch() : undefined}
        />
      </div>
    );
  }

  if (!v) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.metaCard}>
        <div className={styles.metaInfo}>
          <div className={styles.metaHeader}>
            <div className={styles.metaTitleRow}>
              <span className={styles.versionNoLabel}>v{v.versionNo}</span>
              {v.lifecycleStatus !== "PUBLISHED" && (
                <span className={styles.badge}>{formatLifecycleStatus(v.lifecycleStatus)}</span>
              )}
              {isCurrentVersion && (
                <span className={`${styles.badge} ${styles.badgeOperating}`}>배포중</span>
              )}
            </div>
          </div>
          <div className={styles.metaGrid}>
            <span className={styles.metaKey}>생성</span>
            <span className={styles.metaValue}>{formatDate(v.createdAt ?? "")}</span>
          </div>
        </div>
        <div className={styles.metaSide}>
          {v.description ? <p className={styles.versionDescription}>{v.description}</p> : null}
          {isDraftVersion && versionId != null && (onApplyDraft || onDiscardDraft) ? (
            <div className={styles.deployActions}>
              {onDiscardDraft && (
                <button
                  type="button"
                  className={`${styles.deployButton} ${styles.discardButton}`}
                  disabled={!canDiscardDraft}
                  onClick={() => {
                    if (canDiscardDraft) setDiscardDialogOpen(true);
                  }}
                >
                  {isDiscarding ? "삭제 중..." : "삭제"}
                </button>
              )}
              {onApplyDraft && (
                <button
                  type="button"
                  className={styles.deployButton}
                  disabled={!canApplyDraft}
                  onClick={() => {
                    if (canApplyDraft) {
                      setApplyDescription(v.description ?? "");
                      setApplyDialogOpen(true);
                    }
                  }}
                >
                  {isApplying ? "적용 중..." : "적용"}
                </button>
              )}
            </div>
          ) : onDeploy && versionId != null ? (
            <div className={styles.deployActions}>
              <button
                type="button"
                className={styles.deployButton}
                disabled={!canDeploy}
                onClick={() => {
                  if (canDeploy) setDeployDialogOpen(true);
                }}
              >
                {isCurrentVersion ? "배포중" : isDeploying ? "배포 중..." : "배포"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <AlertDialog
        open={isDeployDialogOpen}
        onOpenChange={(next) => {
          if (!isDeploying) setDeployDialogOpen(next);
        }}
      >
        <AlertDialogContent size="sm" className={styles.approvalDialogContent}>
          <AlertDialogTitle className={styles.approvalDialogTitle}>
            {targetVersionLabel} 버전을 배포할까요?
          </AlertDialogTitle>
          <AlertDialogDescription className={styles.approvalDialogDescription}>
            배포하면 현재 운영 중인 도메인팩이 아래 대상 버전으로 전환됩니다.
          </AlertDialogDescription>
          <VersionActionContext
            version={v}
            transitionLabel={`${currentVersionLabel} → ${targetVersionLabel}`}
          />
          <AlertDialogFooter className={styles.approvalDialogFooter}>
            <Button
              type="button"
              variant="outline"
              className={styles.approvalDialogCancel}
              onClick={() => setDeployDialogOpen(false)}
              disabled={isDeploying}
            >
              취소
            </Button>
            <Button
              type="button"
              className={styles.approvalDialogConfirm}
              onClick={handleConfirmDeploy}
              disabled={isDeploying}
            >
              {isDeploying ? (
                <>
                  <Spinner />
                  배포 중...
                </>
              ) : (
                "배포하기"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isApplyDialogOpen}
        onOpenChange={(next) => {
          if (isApplying) return;
          if (next) setApplyDescription(v.description ?? "");
          setApplyDialogOpen(next);
        }}
      >
        <AlertDialogContent size="sm" className={styles.approvalDialogContent}>
          <AlertDialogTitle className={styles.approvalDialogTitle}>
            검토 중인 {targetVersionLabel} 수정버전을 적용할까요?
          </AlertDialogTitle>
          <AlertDialogDescription className={styles.approvalDialogDescription}>
            적용하면 검토 중인 {targetVersionLabel}의 수정 내용이 도메인 팩에 반영됩니다.
          </AlertDialogDescription>
          <VersionActionContext
            version={v}
            transitionLabel={`${currentVersionLabel} → ${targetVersionLabel}`}
            scopeLabel="수정 반영"
          />
          <div className={styles.applyMessageField}>
            <label htmlFor={`apply-message-${versionId}`} className={styles.applyMessageLabel}>
              변경사항 정리
            </label>
            <textarea
              id={`apply-message-${versionId}`}
              className={styles.applyMessageInput}
              value={applyDescription}
              maxLength={50}
              rows={3}
              disabled={isApplying}
              placeholder="예: 상담 유형명을 정리하고 확인 항목을 보강했습니다."
              onChange={(event) => setApplyDescription(event.target.value)}
            />
            <span className={styles.applyMessageCount}>{applyDescription.length}/50</span>
          </div>
          <AlertDialogFooter className={styles.approvalDialogFooter}>
            <Button
              type="button"
              variant="outline"
              className={styles.approvalDialogCancel}
              onClick={() => setApplyDialogOpen(false)}
              disabled={isApplying}
            >
              취소
            </Button>
            <Button
              type="button"
              className={styles.approvalDialogConfirm}
              onClick={handleConfirmApply}
              disabled={isApplying}
            >
              {isApplying ? (
                <>
                  <Spinner />
                  적용 중...
                </>
              ) : (
                "적용하기"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isDiscardDialogOpen}
        onOpenChange={(next) => {
          if (!isDiscarding) setDiscardDialogOpen(next);
        }}
      >
        <AlertDialogContent size="sm" className={styles.approvalDialogContent}>
          <AlertDialogTitle className={styles.approvalDialogTitle}>
            검토 중인 {targetVersionLabel} 버전을 삭제할까요?
          </AlertDialogTitle>
          <AlertDialogDescription className={styles.approvalDialogDescription}>
            삭제하면 {targetVersionLabel} 검토본과 저장된 수정 내용이 모두 삭제되며 되돌릴 수
            없습니다.
          </AlertDialogDescription>
          <VersionActionContext
            version={v}
            transitionLabel={`${targetVersionLabel} 검토본 삭제`}
            scopeLabel="삭제 범위"
            scopeValue="버전 메타데이터와 저장된 draft 수정 내용"
          />
          <AlertDialogFooter className={styles.approvalDialogFooter}>
            <Button
              type="button"
              variant="outline"
              className={styles.approvalDialogCancel}
              onClick={() => setDiscardDialogOpen(false)}
              disabled={isDiscarding}
            >
              취소
            </Button>
            <Button
              type="button"
              className={styles.approvalDialogConfirm}
              onClick={handleConfirmDiscard}
              disabled={isDiscarding}
            >
              {isDiscarding ? (
                <>
                  <Spinner />
                  삭제 중...
                </>
              ) : (
                "삭제하기"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SummaryJsonCard
        summaryJson={v.summaryJson ?? ""}
        finalMessage={v.description}
        revisionSummary={
          revisionSummaryState.status === "ready" ? revisionSummaryState.data : undefined
        }
        isRevisionSummaryLoading={revisionSummaryState.status === "loading"}
        revisionSummaryError={
          revisionSummaryState.status === "error" ? revisionSummaryState.message : null
        }
      />

      <div>
        <div className={styles.sectionTitle}>구성요소</div>
        {versionId != null && (
          <ComponentCountGrid
            wsId={wsId}
            packId={packId}
            versionId={versionId}
            intentCount={v.intentCount ?? 0}
            slotCount={v.slotCount ?? 0}
            policyCount={v.policyCount ?? 0}
            riskCount={v.riskCount ?? 0}
            workflowCount={v.workflowCount ?? 0}
          />
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR");
}

function formatVersionNo(versionNo?: number | null): string {
  return versionNo == null ? "선택한 버전" : `v${versionNo}`;
}

function formatCurrentVersionLabel(
  currentVersionNo?: number | null,
  currentVersionId?: number | null,
): string {
  if (currentVersionNo != null) return `현재 v${currentVersionNo}`;
  if (currentVersionId != null) return "현재 운영 버전";
  return "운영 버전 없음";
}

function formatLifecycleStatus(status?: string | null): string {
  if (status === "PUBLISHED") return "운영 가능";
  if (status === "DRAFT") return "검토 중";
  return status ?? "상태 없음";
}

function VersionActionContext({
  version,
  transitionLabel,
  scopeLabel = "운영 전환",
  scopeValue,
}: Readonly<{
  version: DomainPackVersionDetail;
  transitionLabel: string;
  scopeLabel?: string;
  scopeValue?: string;
}>) {
  const summary = buildActionSummary(version.summaryJson);

  return (
    <dl className={styles.versionActionContext} aria-label="대상 버전 정보">
      <div className={styles.versionActionRow}>
        <dt>대상 버전</dt>
        <dd>
          <strong>{formatVersionNo(version.versionNo)}</strong>
          <span>{formatLifecycleStatus(version.lifecycleStatus)}</span>
        </dd>
      </div>
      <div className={styles.versionActionRow}>
        <dt>{scopeLabel}</dt>
        <dd>{scopeValue ?? transitionLabel}</dd>
      </div>
      <div className={styles.versionActionRow}>
        <dt>생성</dt>
        <dd>{formatDate(version.createdAt ?? "") || "생성일 없음"}</dd>
      </div>
      {summary && (
        <div className={styles.versionActionRow}>
          <dt>변경 요약</dt>
          <dd>{summary}</dd>
        </div>
      )}
    </dl>
  );
}

function buildActionSummary(summaryJson?: string | null): string | null {
  if (!summaryJson) return null;

  try {
    const parsed: unknown = JSON.parse(summaryJson);
    if (!isRecord(parsed)) return null;
    return (
      readTrimmedString(parsed.topic) ??
      readNestedString(parsed, ["draftSource", "reason"]) ??
      readNestedString(parsed, ["generation", "description"]) ??
      readFirstString(parsed, ["review", "topIssues"]) ??
      readFirstString(parsed, ["review", "issues"])
    );
  } catch {
    return null;
  }
}

function readNestedString(data: Record<string, unknown>, path: string[]): string | null {
  const value = path.reduce<unknown>((acc, key) => (isRecord(acc) ? acc[key] : undefined), data);
  return readTrimmedString(value);
}

function readFirstString(data: Record<string, unknown>, path: string[]): string | null {
  const value = path.reduce<unknown>((acc, key) => (isRecord(acc) ? acc[key] : undefined), data);
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    const text = readTrimmedString(item);
    if (text) return text;
    if (isRecord(item)) {
      const message = readTrimmedString(item.message) ?? readTrimmedString(item.title);
      if (message) return message;
    }
  }
  return null;
}

function readTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeDescription(value: string): string {
  return value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
