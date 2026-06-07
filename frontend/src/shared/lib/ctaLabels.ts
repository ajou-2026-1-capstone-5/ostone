/**
 * 다음 행동 CTA 라벨 단일 출처 (#636).
 *
 * 같은 목적지로 가는 CTA는 화면이 달라도 항상 같은 문구를 쓴다. 과거에는
 * 도메인팩 관리 화면을 "도메인팩 보기" / "도메인팩 목록 보기" / "도메인팩 관리로 이동"
 * 세 가지로 불러 라벨이 도착 화면과 어긋났다. 여기서 한 번만 정의한다.
 */

/** 파이프라인 검토(체크포인트) 화면으로 이동 */
export const CTA_GO_REVIEW = "검토 화면으로 이동";

/** 도메인팩 관리(목록) 화면으로 이동 */
export const CTA_GO_DOMAIN_PACK = "도메인팩 관리로 이동";

/** 상담 로그 업로드 화면으로 이동 */
export const CTA_UPLOAD_LOGS = "상담 로그 업로드";

/** 업로드된 상담 로그로 도메인팩 생성을 시작 */
export const CTA_START_GENERATION = "지식팩 생성 시작";

/** 실패한 도메인팩 생성 요청을 재시도 */
export const CTA_RETRY_GENERATION = "지식팩 생성 재시도";

/** 현재 업로드 흐름을 초기화하고 다른 파일을 올린다 */
export const CTA_UPLOAD_AGAIN = "다른 파일 업로드";

/** 실패한 생성 흐름을 업로드부터 다시 시작한다 */
export const CTA_RETRY_FROM_UPLOAD = "업로드 다시 시작";
