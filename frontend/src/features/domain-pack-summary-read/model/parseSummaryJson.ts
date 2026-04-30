export type ParsedSummary =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; raw: string };

export function parseSummaryJson(json: string): ParsedSummary {
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ok: true, data: parsed as Record<string, unknown> };
    }
    console.warn('[parseSummaryJson] object가 아님. raw fallback:', json);
    return { ok: false, raw: json };
  } catch (e) {
    console.warn('[parseSummaryJson] 파싱 실패. raw fallback:', json, e);
    return { ok: false, raw: json };
  }
}
