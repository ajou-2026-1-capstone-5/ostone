/**
 * 구독 요금제 상수와 카탈로그 정규화 타입.
 *
 * 가격·한도는 백엔드 카탈로그(`GET /api/v1/plans`)가 단일 출처이며, 카드에 노출하는 마케팅 문구와
 * Enterprise 연락처는 FE 카피(`PLAN_COPY`, `ENTERPRISE_CONTACT`)로 관리한다. Free는 백엔드 plan 행이
 * 아니라 미구독 상태를 나타내는 합성 항목이다.
 */
export interface BillingPlan {
  planKey: string;
  name: string;
  amount: number;
  currency: string;
  interval: "MONTH";
}

/** 자동결제 등록 기본 플랜(planKey 미지정 시 fallback). */
export const PRO_PLAN: BillingPlan = {
  planKey: "pro_monthly",
  name: "Pro",
  amount: 29000,
  currency: "KRW",
  interval: "MONTH",
};

/** 미구독(Free) 상태를 나타내는 합성 플랜 키. 백엔드 카탈로그에는 존재하지 않는다. */
export const FREE_PLAN_KEY = "free";

/** Enterprise 도입 문의 연락처(가격 미표시 · 카드결제 미연결). */
export const ENTERPRISE_CONTACT = {
  phone: "02-XXX-XXXX",
} as const;

/** 백엔드 카탈로그 응답을 화면에서 다루기 쉬운 형태로 정규화한 항목. */
export interface PlanCatalogEntry {
  planKey: string;
  name: string;
  amount: number;
  currency: string;
  interval: string;
  memberLimit: number;
  datasetUploadLimit: number;
  pipelineRunHourlyLimit: number;
  contactOnly: boolean;
  unlimited: boolean;
}

export interface PlanCopy {
  /** 카드에 표시할 플랜 이름(카탈로그의 내부 라벨 대신 사용). */
  name: string;
  tagline: string;
  features: string[];
  popular?: boolean;
}

/** planKey별 카드 표시 문구. 카탈로그에 없는 Free 포함. */
export const PLAN_COPY: Record<string, PlanCopy> = {
  [FREE_PLAN_KEY]: {
    name: "Free",
    tagline: "핵심 기능을 가볍게 체험",
    features: ["워크스페이스 멤버 1명", "도메인팩 생성·검토 최초 1회 무료", "코어 모델 체험"],
  },
  pro_monthly: {
    name: "Pro",
    tagline: "소규모 팀의 정기 운영에 적합",
    features: [
      "워크스페이스 멤버 3명",
      "도메인팩 생성·검토 시간당 1회",
      "월 단위 자동결제 · 언제든 해지",
    ],
    popular: true,
  },
  max_monthly: {
    name: "Max",
    tagline: "활발하게 운영하는 팀을 위한 확장",
    features: [
      "워크스페이스 멤버 10명",
      "도메인팩 생성·검토 시간당 5회",
      "Airflow 서버 우선 액세스권",
    ],
  },
  enterprise: {
    name: "Enterprise",
    tagline: "조직 규모 도입과 맞춤 지원",
    features: [
      "하위 요금제의 모든 기능 포함",
      "워크스페이스 · 도메인팩 생성·검토 무제한",
      "전담 기술 지원",
      "온보딩 지원",
    ],
  },
};
