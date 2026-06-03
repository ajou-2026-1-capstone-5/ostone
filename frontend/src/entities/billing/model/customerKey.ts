/**
 * 워크스페이스 기반 customerKey 파생 (U-002=A, engineering-bound).
 *
 * 규칙: 서버 값(GET /subscription.customerKey 또는 POST /subscription 응답)이 있으면 **그 값을 우선** 사용하고,
 * 없을 때만 결정적 평문 `ws_{workspaceId}` 로 생성한다. FE는 절대 매 호출마다 무작위로 생성하지 않으며 서버 값을
 * 무시하지 않는다 — 워크스페이스당 customerKey 안정성을 보호하기 위함이다.
 */
export function deriveCustomerKey(workspaceId: number | string, existing?: string | null): string {
  return existing && existing.length > 0 ? existing : `ws_${workspaceId}`;
}
