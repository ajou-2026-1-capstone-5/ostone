export const PAY_ONCE_ERROR_MESSAGES = {
  PAYMENT_AMOUNT_MISMATCH: "결제 금액이 일치하지 않습니다. 다시 시도해주세요.",
  PAYMENT_REJECTED: "결제가 거절되었습니다. 다른 카드로 시도해주세요.",
  PAYMENT_GATEWAY_ERROR: "결제 대행사 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
  PAYMENT_NOT_FOUND: "결제 정보를 찾을 수 없습니다.",
  CLIENT_KEY_MISSING: "결제 모듈이 설정되지 않았습니다. 관리자에게 문의해주세요.",
  WIDGET_FAILED: "결제 위젯을 불러오지 못했습니다.",
  CONFIRM_FAILED: "결제 승인에 실패했습니다.",
} as const;
