import type { DomainPackVersionDetail } from "@/entities/domain-pack";

export interface IntentRevisionDraftSource {
  type: "INTENT_REVISION";
  baseVersionId: number;
  baseVersionNo?: number;
  reason?: string;
}

export function parseIntentRevisionDraftSource(
  summaryJson?: string | null,
): IntentRevisionDraftSource | null {
  if (!summaryJson) return null;

  try {
    const parsed: unknown = JSON.parse(summaryJson);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

    const draftSource = (parsed as { draftSource?: unknown }).draftSource;
    if (!draftSource || typeof draftSource !== "object" || Array.isArray(draftSource)) {
      return null;
    }

    const source = draftSource as Record<string, unknown>;
    if (source.type !== "INTENT_REVISION" || typeof source.baseVersionId !== "number") {
      return null;
    }

    return {
      type: "INTENT_REVISION",
      baseVersionId: source.baseVersionId,
      baseVersionNo: typeof source.baseVersionNo === "number" ? source.baseVersionNo : undefined,
      reason: typeof source.reason === "string" ? source.reason : undefined,
    };
  } catch {
    return null;
  }
}

export function isIntentRevisionDraft(version?: DomainPackVersionDetail | null): boolean {
  return (
    version?.lifecycleStatus === "DRAFT" &&
    parseIntentRevisionDraftSource(version.summaryJson)?.type === "INTENT_REVISION"
  );
}
