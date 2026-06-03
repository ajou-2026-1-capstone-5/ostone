/**
 * 단일 Pro 플랜 상수 (U-001=A). 백엔드 seed(`pro_monthly`, 29000 KRW/월)와 일치한다.
 * plan 목록 조회 API는 백엔드에 없으므로 FE는 이 상수만 사용한다(다중 플랜 UI 금지 — YAGNI).
 */
export interface BillingPlan {
  planKey: string;
  name: string;
  amount: number;
  currency: string;
  interval: "MONTH";
}

export const PRO_PLAN: BillingPlan = {
  planKey: "pro_monthly",
  name: "Pro",
  amount: 29000,
  currency: "KRW",
  interval: "MONTH",
};
