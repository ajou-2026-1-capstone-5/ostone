/**
 * 구독/결제 status 표시 메타데이터. DESIGN.md 에 따라 색상이 아니라 weight/보더(흑백)로 위계를 표현한다.
 * 모든 매핑은 unknown 값을 방어적으로 흡수한다(U-007) — 미정의 status 가 와도 크래시 없이 원문을 노출한다.
 */
export type StatusVariant = "solid" | "outline" | "muted";

export interface StatusMeta {
  label: string;
  variant: StatusVariant;
}

const SUBSCRIPTION_STATUS_META: Record<string, StatusMeta> = {
  ACTIVE: { label: "구독 중", variant: "solid" },
  INCOMPLETE: { label: "등록 미완료", variant: "outline" },
  PAST_DUE: { label: "결제 지연", variant: "outline" },
  CANCELED: { label: "해지됨", variant: "muted" },
};

const PAYMENT_STATUS_META: Record<string, StatusMeta> = {
  DONE: { label: "완료", variant: "solid" },
  READY: { label: "대기", variant: "outline" },
  IN_PROGRESS: { label: "진행 중", variant: "outline" },
  CANCELED: { label: "취소됨", variant: "muted" },
  PARTIAL_CANCELED: { label: "부분 취소", variant: "muted" },
  ABORTED: { label: "실패", variant: "muted" },
  EXPIRED: { label: "만료", variant: "muted" },
};

export function getSubscriptionStatusMeta(status: string | undefined): StatusMeta {
  if (status && SUBSCRIPTION_STATUS_META[status]) {
    return SUBSCRIPTION_STATUS_META[status];
  }
  return { label: status ?? "알 수 없음", variant: "outline" };
}

export function getPaymentStatusMeta(status: string | undefined): StatusMeta {
  if (status && PAYMENT_STATUS_META[status]) {
    return PAYMENT_STATUS_META[status];
  }
  return { label: status ?? "알 수 없음", variant: "outline" };
}

/** 구독이 "활성으로 간주"되는 status (활성 화면을 보여줄지 판단). */
export function isSubscriptionEngaged(status: string | undefined): boolean {
  return status === "ACTIVE" || status === "PAST_DUE";
}
