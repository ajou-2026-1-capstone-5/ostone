import { ApiRequestError } from "@/shared/api";

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
