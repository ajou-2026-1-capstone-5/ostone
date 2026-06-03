export const BILLING_REGISTER_ERROR_MESSAGES = {
  SUBSCRIPTION_ALREADY_EXISTS: "이미 진행 중인 구독이 있습니다.",
  PLAN_NOT_FOUND: "요금제 정보를 찾을 수 없습니다.",
  WORKSPACE_ACCESS_DENIED: "이 워크스페이스의 구독을 관리할 권한이 없습니다.",
  CLIENT_KEY_MISSING: "결제 모듈이 설정되지 않았습니다. 관리자에게 문의해주세요.",
  REGISTER_FAILED: "자동결제 카드 등록을 시작하지 못했습니다.",
} as const;

export const BILLING_CONFIRM_ERROR_MESSAGES = {
  SUBSCRIPTION_ALREADY_EXISTS: "이미 활성화된 구독입니다.",
  SUBSCRIPTION_NOT_FOUND: "구독 정보를 찾을 수 없습니다. 다시 시도해주세요.",
  BILLING_KEY_NOT_FOUND: "등록된 결제수단을 찾을 수 없습니다.",
  PAYMENT_GATEWAY_ERROR: "결제 대행사 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
  PAYMENT_REJECTED: "카드 결제가 거절되었습니다. 다른 카드로 시도해주세요.",
  CONFIRM_FAILED: "구독 활성화에 실패했습니다.",
} as const;
