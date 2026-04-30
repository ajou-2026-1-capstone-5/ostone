export type ParsedSummary =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; raw: string };

export function parseSummaryJson(json: string): ParsedSummary {
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ok: true, data: parsed as Record<string, unknown> };
    }
    return { ok: false, raw: json };
  } catch {
    return { ok: false, raw: json };
  }
}
