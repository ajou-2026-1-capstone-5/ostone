export interface DemoCompany {
  /** Maps 1:1 to a backend workspace id (company name === workspace name). */
  workspaceId: number;
  name: string;
  industry: string;
  blurb: string;
  focusChips: string[];
  /**
   * Only enabled companies route into a live chat. A company is enabled when its
   * workspace has a DB-backed PUBLISHED domain pack; others are preview-only.
   */
  enabled: boolean;
}

/**
 * Static demo roster. There is no JWT-free endpoint to list workspaces, so the
 * company↔workspace mapping is curated here. Workspace 1 and 2 are backed by
 * local/dev seed runners; workspace 3 remains a fixture-only preview.
 */
export const DEMO_COMPANIES: DemoCompany[] = [
  {
    workspaceId: 1,
    name: "액티벤처 여행 상담",
    industry: "여행 · 예약",
    blurb:
      "항공권, 예약 취소·환불, 픽업 차량 상담 도메인팩이 운영 중인 워크스페이스입니다. 액티벤처 고객 시나리오를 바로 체험할 수 있습니다.",
    focusChips: ["항공권 문의", "예약 취소·환불", "픽업 차량"],
    enabled: true,
  },
  {
    workspaceId: 2,
    name: "하나카드 카드 상담",
    industry: "카드 · 금융",
    blurb:
      "하나카드 상담 로그 100건에서 추출한 카드 상담 도메인팩입니다. 분실 신고, 이용내역, 선결제, 카드론 상담을 체험할 수 있습니다.",
    focusChips: ["분실 신고", "이용내역 확인", "선결제·카드론"],
    enabled: true,
  },
  {
    workspaceId: 3,
    name: "인디고발리 숙소 예약",
    industry: "숙소 · 예약",
    blurb:
      "리조트 객실 예약 가능 여부 및 예약 진행 상담 도메인 팩 데모입니다. 라이브 상담은 곧 준비됩니다.",
    focusChips: ["객실 예약", "프로모션 확인"],
    enabled: false,
  },
];

export function findDemoCompany(workspaceId: number): DemoCompany | undefined {
  return DEMO_COMPANIES.find((company) => company.workspaceId === workspaceId);
}

/** First selectable company, used as the initially focused entry. */
export function getDefaultDemoCompany(): DemoCompany {
  return DEMO_COMPANIES.find((company) => company.enabled) ?? DEMO_COMPANIES[0];
}
