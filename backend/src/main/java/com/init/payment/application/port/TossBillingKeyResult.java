package com.init.payment.application.port;

/**
 * billingKey 발급 결과. {@code billingKey}는 평문이며 호출부에서 즉시 암호화 저장 후 폐기한다. {@code maskedRawJson}은
 * billingKey가 제거된 마스킹 응답이다 (U-012).
 */
public record TossBillingKeyResult(
    String billingKey,
    String customerKey,
    String cardCompany,
    String cardNumberMasked,
    String maskedRawJson) {}
