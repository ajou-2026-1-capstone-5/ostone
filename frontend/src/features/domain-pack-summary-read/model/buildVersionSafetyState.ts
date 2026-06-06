import type { DomainPackVersionDetail, DomainPackVersionSummary } from "@/entities/domain-pack";
import { findMaxDomainPackVersionNo } from "./buildDomainPackApprovalReadiness";
import { formatCurrentVersionLabel, formatLifecycleStatus, formatVersionNo } from "./versionFormat";

/**
 * 배너 톤. operating=현재 운영 중, review=검토/진행 중, blocked=배포·적용 불가,
 * previous=다시 배포 가능한 이전 버전.
 */
export type VersionSafetyTone = "operating" | "review" | "blocked" | "previous";

export interface VersionSafetyCounts {
  intent: number;
  slot: number;
  policy: number;
  risk: number;
  workflow: number;
}

export interface VersionSafetyState {
  versionNo: number | null;
  lifecycleLabel: string;
  /** 현재 운영 중(배포중)인 버전인지 */
  isCurrent: boolean;
  isDraft: boolean;
  changeDescription: string | null;
  counts: VersionSafetyCounts;
  countsLabel: string;
  transitionLabel: string;
  tone: VersionSafetyTone;
  reason: string;
}

interface BuildVersionSafetyStateParams {
  version: DomainPackVersionDetail;
  versions: DomainPackVersionSummary[];
  currentVersionId?: number | null;
  currentVersionNo?: number | null;
  deployingVersionId?: number | null;
  applyingVersionId?: number | null;
}

export function buildVersionSafetyState({
  version,
  versions,
  currentVersionId = null,
  currentVersionNo = null,
  deployingVersionId = null,
  applyingVersionId = null,
}: BuildVersionSafetyStateParams): VersionSafetyState {
  const versionId = version.versionId ?? null;
  const versionNo = version.versionNo ?? null;
  const isCurrent = versionId != null && versionId === currentVersionId;
  const isDraft = version.lifecycleStatus === "DRAFT";
  const isDeploying = versionId != null && versionId === deployingVersionId;
  const isApplying = versionId != null && versionId === applyingVersionId;

  const { tone, reason } = resolveStatus({
    versionNo,
    versions,
    isCurrent,
    isDraft,
    isDeploying,
    isApplying,
  });

  return {
    versionNo,
    lifecycleLabel: formatLifecycleStatus(version.lifecycleStatus),
    isCurrent,
    isDraft,
    changeDescription: readChangeDescription(version.description),
    counts: {
      intent: version.intentCount ?? 0,
      slot: version.slotCount ?? 0,
      policy: version.policyCount ?? 0,
      risk: version.riskCount ?? 0,
      workflow: version.workflowCount ?? 0,
    },
    countsLabel: isCurrent ? "운영 구성요소" : "반영 대상 구성요소",
    transitionLabel: buildTransitionLabel({
      isCurrent,
      currentVersionId,
      currentVersionNo,
      versionNo,
    }),
    tone,
    reason,
  };
}

interface ResolveStatusParams {
  versionNo: number | null;
  versions: DomainPackVersionSummary[];
  isCurrent: boolean;
  isDraft: boolean;
  isDeploying: boolean;
  isApplying: boolean;
}

function resolveStatus({
  versionNo,
  versions,
  isCurrent,
  isDraft,
  isDeploying,
  isApplying,
}: ResolveStatusParams): { tone: VersionSafetyTone; reason: string } {
  if (isDeploying) {
    return { tone: "review", reason: "배포를 진행하고 있습니다." };
  }
  if (isApplying) {
    return { tone: "review", reason: "수정 내용을 적용하고 있습니다." };
  }
  if (isCurrent) {
    return {
      tone: "operating",
      reason: "현재 운영 중인 버전입니다. 이미 배포되어 있어 다시 배포할 수 없습니다.",
    };
  }
  if (isDraft) {
    const maxVersionNo = findMaxDomainPackVersionNo(versions);
    if (versionNo != null && maxVersionNo != null && versionNo !== maxVersionNo) {
      return {
        tone: "blocked",
        reason: "이전 검토본입니다. 최신 검토본만 적용할 수 있어 지금은 배포·적용할 수 없습니다.",
      };
    }
    return {
      tone: "review",
      reason:
        "검토 중인 버전입니다. 적용하면 변경 내용이 도메인팩에 반영되며, 운영 배포는 적용 후 가능합니다.",
    };
  }
  return {
    tone: "previous",
    reason: "이전에 운영된 버전입니다. 다시 배포하면 운영 도메인팩이 이 버전으로 전환됩니다.",
  };
}

interface BuildTransitionLabelParams {
  isCurrent: boolean;
  currentVersionId: number | null;
  currentVersionNo: number | null;
  versionNo: number | null;
}

function buildTransitionLabel({
  isCurrent,
  currentVersionId,
  currentVersionNo,
  versionNo,
}: BuildTransitionLabelParams): string {
  const currentLabel = formatCurrentVersionLabel(currentVersionNo, currentVersionId);
  if (isCurrent) {
    return `${currentLabel} · 운영 중`;
  }
  return `${currentLabel} → 대상 ${formatVersionNo(versionNo)}`;
}

function readChangeDescription(description?: string | null): string | null {
  if (typeof description !== "string") return null;
  const trimmed = description.trim();
  return trimmed || null;
}
