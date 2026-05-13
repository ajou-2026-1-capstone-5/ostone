import type { DomainPackVersionDetail, DomainPackVersionSummary } from "@/entities/domain-pack";
import type { IntentDefinitionSummary } from "@/shared/api/generated/zod";

export type DomainPackApprovalBlockerType =
  | "VERSION"
  | "INTENT"
  | "POLICY"
  | "RISK"
  | "SLOT"
  | "WORKFLOW"
  | "SERVER";

export interface DomainPackApprovalBlocker {
  type: DomainPackApprovalBlockerType;
  message: string;
  count?: number;
  actionPath?: string;
}

export interface DomainPackApprovalReadiness {
  ready: boolean;
  isLoading: boolean;
  isError: boolean;
  blockers: DomainPackApprovalBlocker[];
  retry: () => void;
}

interface BuildDomainPackApprovalReadinessParams {
  version?: DomainPackVersionDetail;
  versions: DomainPackVersionSummary[];
  intents?: IntentDefinitionSummary[];
  intentActionPath?: string;
}

const REQUIRED_INFO_MISSING_MESSAGE =
  "승인 준비 상태를 확인하는 데 필요한 정보가 부족합니다.";

export function buildDomainPackApprovalReadiness({
  version,
  versions,
  intents,
  intentActionPath,
}: BuildDomainPackApprovalReadinessParams): Pick<
  DomainPackApprovalReadiness,
  "ready" | "blockers"
> {
  if (
    version?.versionId == null ||
    version.versionNo == null ||
    version.lifecycleStatus == null
  ) {
    return blockedByRequiredInfo();
  }

  if (version.lifecycleStatus !== "DRAFT") {
    return {
      ready: false,
      blockers: [
        {
          type: "VERSION",
          message: "DRAFT 상태의 버전만 승인할 수 있습니다.",
        },
      ],
    };
  }

  const maxVersionNo = findMaxDomainPackVersionNo(versions);
  if (maxVersionNo == null) {
    return blockedByRequiredInfo();
  }

  if (version.versionNo !== maxVersionNo) {
    return {
      ready: false,
      blockers: [
        {
          type: "VERSION",
          message: "최신 버전만 승인할 수 있습니다.",
        },
      ],
    };
  }

  if (!intents) {
    return blockedByRequiredInfo();
  }

  if (intents.some((intent) => intent.status == null)) {
    return blockedByRequiredInfo();
  }

  const draftIntentCount = intents.filter((intent) => intent.status === "DRAFT").length;
  if (draftIntentCount > 0) {
    return {
      ready: false,
      blockers: [
        {
          type: "INTENT",
          count: draftIntentCount,
          message: `승인 또는 반려되지 않은 Intent가 ${draftIntentCount}개 남아 있습니다.`,
          actionPath: intentActionPath,
        },
      ],
    };
  }

  return {
    ready: true,
    blockers: [],
  };
}

function blockedByRequiredInfo(): Pick<
  DomainPackApprovalReadiness,
  "ready" | "blockers"
> {
  return {
    ready: false,
    blockers: [
      {
        type: "SERVER",
        message: REQUIRED_INFO_MISSING_MESSAGE,
      },
    ],
  };
}

export function findMaxDomainPackVersionNo(versions: DomainPackVersionSummary[]): number | null {
  const versionNos = versions
    .map((version) => version.versionNo)
    .filter((versionNo): versionNo is number => versionNo != null);

  if (versionNos.length === 0) {
    return null;
  }

  return Math.max(...versionNos);
}
