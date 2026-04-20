export type ParseTerminalStatesResult = { ok: true; value: string[] } | { ok: false; raw: string };

export function parseTerminalStates(json: string): ParseTerminalStatesResult {
  try {
    const parsed: unknown = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
      return { ok: true, value: parsed as string[] };
    }
    console.warn("[parseTerminalStates] 파싱 결과가 string[]가 아닙니다. raw 반환:", json);
    return { ok: false, raw: json };
  } catch (e) {
    console.warn("[parseTerminalStates] JSON 파싱 실패. raw 반환:", json, e);
    return { ok: false, raw: json };
  }
}
