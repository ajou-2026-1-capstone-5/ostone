import { ApiRequestError } from "@/shared/api";

export const RISK_READ_ERROR_MESSAGES = {
  UNAUTHORIZED: "로그인이 만료되었거나 인증이 필요합니다. 다시 로그인 후 시도해 주세요.",
  FORBIDDEN: "이 워크스페이스의 주의 사항을 볼 권한이 없습니다.",
  BAD_REQUEST: "주의 사항 조회 요청값을 확인할 수 없습니다.",
  NOT_FOUND: "주의 사항을 찾을 수 없습니다.",
  LOAD_LIST_FAILED: "주의 사항 목록을 불러오지 못했습니다.",
  LOAD_DETAIL_FAILED: "주의 사항 상세 정보를 불러오지 못했습니다.",
  SERVER_ERROR: "서버에서 주의 사항 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  RESPONSE_CONTRACT_ERROR: "주의 사항 응답 형식이 예상과 다릅니다. 관리자에게 문의해 주세요.",
  NETWORK_ERROR: "네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
  UNKNOWN: "알 수 없는 오류가 발생했습니다.",
} as const;

const RISK_ERROR_MESSAGE_BY_CODE: Record<string, string> = {
  RISK_DEFINITION_NOT_FOUND: RISK_READ_ERROR_MESSAGES.NOT_FOUND,
  RISK_NOT_FOUND: RISK_READ_ERROR_MESSAGES.NOT_FOUND,
  WORKSPACE_ACCESS_DENIED: RISK_READ_ERROR_MESSAGES.FORBIDDEN,
  FORBIDDEN: RISK_READ_ERROR_MESSAGES.FORBIDDEN,
  UNAUTHORIZED: RISK_READ_ERROR_MESSAGES.UNAUTHORIZED,
  BAD_REQUEST: RISK_READ_ERROR_MESSAGES.BAD_REQUEST,
  VALIDATION_ERROR: RISK_READ_ERROR_MESSAGES.BAD_REQUEST,
};

function mapHttpStatusToMessage(status: number): string {
  if (status === 401) return RISK_READ_ERROR_MESSAGES.UNAUTHORIZED;
  if (status === 403) return RISK_READ_ERROR_MESSAGES.FORBIDDEN;
  if (status === 404) return RISK_READ_ERROR_MESSAGES.NOT_FOUND;
  if (status === 400 || status === 422) return RISK_READ_ERROR_MESSAGES.BAD_REQUEST;
  if (status >= 500) return RISK_READ_ERROR_MESSAGES.SERVER_ERROR;
  return RISK_READ_ERROR_MESSAGES.LOAD_DETAIL_FAILED;
}

function isResponseContractError(e: Error): boolean {
  return (
    e instanceof SyntaxError ||
    e.message.includes("Risk 상세 응답") ||
    e.message.includes("JSON") ||
    e.message.includes("Unexpected token")
  );
}

function isNetworkError(e: Error): boolean {
  const message = e.message.toLowerCase();
  return e instanceof TypeError || message.includes("network") || message.includes("fetch");
}

export function mapApiError(e: unknown): {
  status: "error";
  code: string;
  message: string;
  httpStatus?: number;
} {
  if (e instanceof ApiRequestError) {
    return {
      status: "error",
      code: e.code,
      message: RISK_ERROR_MESSAGE_BY_CODE[e.code] ?? mapHttpStatusToMessage(e.status),
      httpStatus: e.status,
    };
  }

  if (e instanceof Error) {
    if (isResponseContractError(e)) {
      return {
        status: "error",
        code: "RISK_DETAIL_RESPONSE_INVALID",
        message: RISK_READ_ERROR_MESSAGES.RESPONSE_CONTRACT_ERROR,
      };
    }

    if (isNetworkError(e)) {
      return {
        status: "error",
        code: "NETWORK_ERROR",
        message: RISK_READ_ERROR_MESSAGES.NETWORK_ERROR,
      };
    }

    return { status: "error", code: "UNKNOWN_ERROR", message: RISK_READ_ERROR_MESSAGES.UNKNOWN };
  }

  return { status: "error", code: "UNKNOWN_ERROR", message: RISK_READ_ERROR_MESSAGES.UNKNOWN };
}
