package com.init.payment.presentation.dto;

import com.init.payment.application.PlanCatalogResult;
import com.init.payment.domain.model.BillingInterval;

public record PlanCatalogResponse(
    String planKey,
    String name,
    long amount,
    String currency,
    BillingInterval interval,
    int memberLimit,
    int datasetUploadLimit,
    int pipelineRunHourlyLimit,
    boolean contactOnly,
    boolean unlimited) {

  public static PlanCatalogResponse from(PlanCatalogResult result) {
    return new PlanCatalogResponse(
        result.planKey(),
        result.name(),
        result.amount(),
        result.currency(),
        result.interval(),
        result.memberLimit(),
        result.datasetUploadLimit(),
        result.pipelineRunHourlyLimit(),
        result.contactOnly(),
        result.unlimited());
  }
}
