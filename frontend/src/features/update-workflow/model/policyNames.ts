import type { PolicySummary } from "@/entities/policy";

/**
 * 워크플로우 ACTION 노드의 policyRef(내부 실행 식별자)를 운영자용 표시 이름으로 해석하기 위한
 * policyCode → name 맵을 만든다.
 */
export function buildPolicyNameMap(policies: readonly PolicySummary[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const policy of policies) {
    const code = policy.policyCode?.trim();
    const name = policy.name?.trim();
    if (code && name) {
      map.set(code, name);
    }
  }
  return map;
}

export type PolicyRefResolution =
  | { status: "unset" }
  | { status: "resolved"; name: string }
  | { status: "unknown" };

/** policyRef 코드를 표시 이름으로 해석한다. 빈 코드는 unset, 미등록 코드는 unknown. */
export function resolvePolicyName(
  map: ReadonlyMap<string, string>,
  code: string,
): PolicyRefResolution {
  const trimmed = code.trim();
  if (!trimmed) return { status: "unset" };
  const name = map.get(trimmed);
  return name ? { status: "resolved", name } : { status: "unknown" };
}
