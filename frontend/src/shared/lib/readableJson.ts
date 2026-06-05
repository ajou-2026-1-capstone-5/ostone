/**
 * Slot/Policy/Risk 등 도메인팩 상세의 JSON 필드를 운영자가 읽을 수 있는 형태로 변환한다.
 * 파이프라인이 만든 JSON은 형태가 고정되어 있지 않으므로, 알 수 없는 구조도 깨지지 않게
 * 방어적으로 처리하고 원본 JSON은 별도 보기로 유지하는 것을 전제로 한다.
 */

export interface ReadableEntry {
  label: string;
  value: string;
}

export type ReadableJson =
  | { kind: "empty" }
  | { kind: "raw"; text: string }
  | { kind: "scalar"; value: string }
  | { kind: "list"; items: string[] }
  | { kind: "object"; entries: ReadableEntry[] };

const KNOWN_KEY_LABELS: Record<string, string> = {
  type: "유형",
  required: "필수 여부",
  optional: "선택 여부",
  pattern: "형식 패턴",
  format: "형식",
  minLength: "최소 길이",
  maxLength: "최대 길이",
  min: "최솟값",
  max: "최댓값",
  enum: "허용 값",
  options: "선택지",
  default: "기본값",
  unit: "단위",
  example: "예시",
  description: "설명",
  channel: "채널",
  severity: "중요도",
  level: "수준",
  action: "조치",
  reason: "사유",
  message: "안내 문구",
  threshold: "임계값",
  keywords: "키워드",
  terms: "용어",
  source: "출처",
  count: "건수",
  status: "상태",
  condition: "조건",
  operator: "연산자",
  value: "값",
  field: "항목",
  label: "이름",
  name: "이름",
};

function humanizeKey(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  if (!spaced) return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function labelForKey(key: string): string {
  return KNOWN_KEY_LABELS[key] ?? humanizeKey(key);
}

export function isBlankJson(raw: unknown): boolean {
  if (raw === null || raw === undefined) return true;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed === "" || trimmed === "null" || trimmed === "{}" || trimmed === "[]";
  }
  if (Array.isArray(raw)) return raw.length === 0;
  if (typeof raw === "object") return Object.keys(raw as Record<string, unknown>).length === 0;
  return false;
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString("ko-KR") : "";
  if (typeof value === "boolean") return value ? "예" : "아니오";
  if (Array.isArray(value)) {
    return value
      .map((item) => stringifyValue(item))
      .filter((part) => part.length > 0)
      .join(", ");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nested]) => {
        const rendered = stringifyValue(nested);
        return rendered ? `${labelForKey(key)}: ${rendered}` : "";
      })
      .filter((part) => part.length > 0)
      .join(", ");
  }
  return String(value);
}

export function toReadableJson(raw: unknown): ReadableJson {
  if (isBlankJson(raw)) return { kind: "empty" };

  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return { kind: "raw", text: raw.trim() };
    }
  }

  if (value === null || value === undefined) return { kind: "empty" };

  if (Array.isArray(value)) {
    const items = value.map((item) => stringifyValue(item)).filter((item) => item.length > 0);
    return items.length > 0 ? { kind: "list", items } : { kind: "empty" };
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, nested]) => ({ label: labelForKey(key), value: stringifyValue(nested) }))
      .filter((entry) => entry.value.length > 0);
    return entries.length > 0 ? { kind: "object", entries } : { kind: "empty" };
  }

  const scalar = stringifyValue(value);
  return scalar.length > 0 ? { kind: "scalar", value: scalar } : { kind: "empty" };
}

export function formatRawJson(raw: unknown): string {
  if (typeof raw === "string") {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }
  try {
    return JSON.stringify(raw, null, 2);
  } catch {
    return String(raw);
  }
}
