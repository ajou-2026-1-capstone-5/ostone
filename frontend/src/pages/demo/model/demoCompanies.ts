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
 * company↔workspace mapping is curated here. Workspace 1 is the real
 * "컴플레인 테스트 워크스페이스" with a published pack; 2/3 are themed previews.
 */
export const DEMO_COMPANIES: DemoCompany[] = [
  {
    workspaceId: 1,
    name: "컴플레인 테스트 워크스페이스",
    industry: "리테일 · CS 운영",
    blurb:
      "환불 · 배송 상담 도메인 팩이 운영 중인 워크스페이스입니다. 컴플레인을 거는 고객 시나리오를 바로 체험할 수 있습니다.",
    focusChips: ["환불 요청", "배송 조회", "고액 환불 리스크"],
    enabled: true,
  },
  {
    workspaceId: 2,
    name: "카드 이용내역 조회 상담",
    industry: "카드 · 금융",
    blurb:
      "카드 이용내역 및 승인 내역 확인 상담 도메인 팩 데모입니다. 라이브 상담은 곧 준비됩니다.",
    focusChips: ["이용내역 조회", "본인 확인"],
    enabled: false,
  },
  {
    workspaceId: 3,
    name: "여행 숙소 예약 상담",
    industry: "여행 · 예약",
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
