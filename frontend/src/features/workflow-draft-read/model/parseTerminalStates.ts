export function parseTerminalStates(json: string): string[] | string {
  try {
    const parsed: unknown = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) return parsed as string[];
    console.warn('[parseTerminalStates] 파싱 결과가 배열이 아닙니다. raw 반환:', json);
    return json;
  } catch (e) {
    console.warn('[parseTerminalStates] JSON 파싱 실패. raw 반환:', json, e);
    return json;
  }
}
