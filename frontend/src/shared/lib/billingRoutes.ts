/** 빌링(자동결제 등록)과 위젯(일회성 결제) 흐름을 success/fail 랜딩에서 구분하기 위한 식별자. */
export const BILLING_FLOW = {
  billing: "billing",
  widget: "widget",
} as const;

export type BillingFlow = (typeof BILLING_FLOW)[keyof typeof BILLING_FLOW];

export function buildWorkspaceBillingPath(workspaceId: number | string): string {
  return `/workspaces/${workspaceId}/billing`;
}

/**
 * 외부 리다이렉트 복귀 URL은 절대 URL(window.location.origin 기반)로 구성한다 — 로컬/운영 분기 없이 동작(U-005).
 * workspaceId 는 success/fail 랜딩이 워크스페이스 컨텍스트를 복원하도록 쿼리로 전달한다.
 */
export function buildBillingSuccessUrl(workspaceId: number | string, flow: BillingFlow): string {
  return `${window.location.origin}/billing/success?workspaceId=${workspaceId}&flow=${flow}`;
}

export function buildBillingFailUrl(workspaceId: number | string, flow: BillingFlow): string {
  return `${window.location.origin}/billing/fail?workspaceId=${workspaceId}&flow=${flow}`;
}
