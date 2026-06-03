package com.init.payment.application;

import com.init.payment.domain.model.BillingKey;

/** billingKey 응답 요약. 암호화된 billingKey 원문은 절대 포함하지 않는다 (U-012). */
public record BillingKeySummary(
    Long id, String cardCompany, String cardNumberMasked, String status) {

  public static BillingKeySummary from(BillingKey billingKey) {
    return new BillingKeySummary(
        billingKey.getId(),
        billingKey.getCardCompany(),
        billingKey.getCardNumberMasked(),
        billingKey.getStatus().name());
  }
}
