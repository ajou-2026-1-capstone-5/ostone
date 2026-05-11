import type { DomainPackVersionSummary } from "@/entities/domain-pack";
import { parseIntentRevisionDraftSource } from "./draftSource";

export type ExistingDraftSourceType = "INTENT_REVISION" | "GENERAL_DRAFT";

export type ExistingDraftResolution =
  | { status: "ready"; versionId: number }
  | { status: "invalid" };

export function resolveSingleExistingDraft(
  versions: DomainPackVersionSummary[] | undefined,
): ExistingDraftResolution {
  const drafts = (versions ?? []).filter(
    (version) => version.lifecycleStatus === "DRAFT" && version.versionId != null,
  );

  if (drafts.length !== 1 || drafts[0].versionId == null) {
    return { status: "invalid" };
  }

  return { status: "ready", versionId: drafts[0].versionId };
}

export function classifyExistingDraftSource(summaryJson?: string | null): ExistingDraftSourceType {
  return parseIntentRevisionDraftSource(summaryJson) ? "INTENT_REVISION" : "GENERAL_DRAFT";
}
