import { ApiRequestError } from "@/shared/api";

export const RISK_READ_ERROR_MESSAGES = {
  NOT_FOUND: "위험요소를 찾을 수 없습니다.",
  LOAD_LIST_FAILED: "위험요소 목록을 불러오지 못했습니다.",
  LOAD_DETAIL_FAILED: "위험요소 상세 정보를 불러오지 못했습니다.",
} as const;

export function mapApiError(e: unknown): {
  status: "error";
  code: string;
  message: string;
  httpStatus?: number;
} {
  if (e instanceof ApiRequestError) {
    return { status: "error", code: e.code, message: e.message, httpStatus: e.status };
  }
  return { status: "error", code: "UNKNOWN_ERROR", message: "알 수 없는 오류가 발생했습니다." };
}
