export const SUBSCRIPTION_CANCEL_ERROR_MESSAGES = {
  SUBSCRIPTION_NOT_FOUND: "구독 정보를 찾을 수 없습니다.",
  WORKSPACE_ACCESS_DENIED: "이 워크스페이스의 구독을 관리할 권한이 없습니다.",
  CANCEL_FAILED: "구독 취소에 실패했습니다.",
} as const;

export const REFUND_ERROR_MESSAGES = {
  PAYMENT_CANCEL_NOT_ALLOWED: "이 결제는 환불할 수 없는 상태입니다.",
  PAYMENT_NOT_FOUND: "결제 정보를 찾을 수 없습니다.",
  PAYMENT_GATEWAY_ERROR: "결제 대행사 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
  REFUND_FAILED: "환불 처리에 실패했습니다.",
} as const;
