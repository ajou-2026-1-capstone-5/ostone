/**
 * 도메인팩 버전 표시용 순수 포매터.
 *
 * SummaryDetailPanel / VersionListPanel / WorkflowDraftReadPage / VersionSafetyBanner가
 * 동일한 라벨 규칙을 공유한다. 과거 `formatLifecycleStatus`가 3곳에 중복돼 있던 것을
 * 여기 한 곳으로 통합한다.
 */

export function formatLifecycleStatus(status?: string | null): string {
  if (status === "PUBLISHED") return "운영 가능";
  if (status === "DRAFT") return "검토 중";
  // lifecycleStatus는 DRAFT/PUBLISHED만 유효하다. 알 수 없는 값(또는 null)은 raw
  // enum을 운영자에게 노출하지 않고 "상태 없음"으로 표기한다.
  return "상태 없음";
}

export function formatVersionNo(versionNo?: number | null): string {
  return versionNo == null ? "선택한 버전" : `v${versionNo}`;
}

export function formatCurrentVersionLabel(
  currentVersionNo?: number | null,
  currentVersionId?: number | null,
): string {
  if (currentVersionNo != null) return `현재 v${currentVersionNo}`;
  if (currentVersionId != null) return "현재 운영 버전";
  return "운영 버전 없음";
}

/** 날짜+시간을 ko-KR locale로 표기. 파싱 불가하면 원본 문자열 반환. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR");
}

export function normalizeDescription(value: string): string {
  return value.trim();
}

/** summaryJson에서 사람이 읽을 변경 요약 한 줄을 우선순위대로 추출. */
export function buildActionSummary(summaryJson?: string | null): string | null {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
