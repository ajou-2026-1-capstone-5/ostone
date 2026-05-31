import { ApiRequestError } from "@/shared/api";

const ERROR_MESSAGE_BY_CODE: Record<string, string> = {
  DOMAIN_PACK_VERSION_NOT_LATEST: "최신 버전만 승인할 수 있습니다.",
  DOMAIN_PACK_INVALID_STATE: "현재 상태에서는 승인할 수 없습니다.",
  DOMAIN_PACK_CONFLICT: "다른 요청으로 버전 상태가 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
  FORBIDDEN: "도메인팩을 승인할 권한이 없습니다.",
  DOMAIN_PACK_VERSION_NOT_FOUND: "도메인팩 버전을 찾을 수 없습니다.",
  DOMAIN_PACK_NOT_FOUND: "도메인팩을 찾을 수 없습니다.",
  WORKSPACE_NOT_FOUND: "워크스페이스를 찾을 수 없습니다.",
  NOT_FOUND: "도메인팩 또는 버전을 찾을 수 없습니다.",
  UNAUTHORIZED: "로그인이 필요합니다.",
};

export function resolveDomainPackApprovalErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    const message = ERROR_MESSAGE_BY_CODE[error.code];
    if (message) return message;

    if (error.status === 404) {
      return "도메인팩 또는 버전을 찾을 수 없습니다.";
    }
  }

  return "도메인팩 승인에 실패했습니다.";
}
