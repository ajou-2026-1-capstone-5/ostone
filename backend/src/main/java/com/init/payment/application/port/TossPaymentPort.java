package com.init.payment.application.port;

/**
 * 토스페이먼츠 v2 서버 API port. 운영 구현(TossPaymentClient)은 Basic auth + Idempotency-Key 헤더로 호출하며
 * secretKey/billingKey를 로그·응답에 노출하지 않는다. 게이트웨이 오류는 PaymentGatewayException으로 변환한다 (U-008).
 */
public interface TossPaymentPort {

  /** authKey -> billingKey 발급. */
  TossBillingKeyResult issueBillingKey(String authKey, String customerKey);

  /** 일회성 결제 승인. */
  TossPaymentResult confirmPayment(String paymentKey, String orderId, long amount);

  /** billingKey 기반 정기결제 실행. */
  TossPaymentResult executeBilling(TossBillingExecuteCommand command);

  /** 결제 취소/부분환불. cancelAmount가 null이면 전액 취소. */
  TossPaymentResult cancelPayment(String paymentKey, String cancelReason, Long cancelAmount);

  /** 웹훅 권위 상태 확정을 위한 결제 재조회 (U-003). */
  TossPaymentResult getPayment(String paymentKey);
}
