package com.init.payment.presentation.dto;

import com.init.payment.application.BillingKeySummary;

public record BillingKeyResponse(
    Long id, String cardCompany, String cardNumberMasked, String status) {

  public static BillingKeyResponse from(BillingKeySummary summary) {
    return new BillingKeyResponse(
        summary.id(), summary.cardCompany(), summary.cardNumberMasked(), summary.status());
  }
}
