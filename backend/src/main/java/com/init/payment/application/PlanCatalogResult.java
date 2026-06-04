package com.init.payment.application;

import com.init.payment.domain.model.BillingInterval;
import com.init.payment.domain.model.Plan;

/**
 * 플랜 카탈로그(요금제 비교) 단일 항목. {@code -1} 한도는 무제한(Enterprise)이며 {@code unlimited=true}로 노출한다. 마케팅 문구는 DB가
 * 아닌 FE 카피로 관리하므로 여기에는 포함하지 않는다.
 */
public record PlanCatalogResult(
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

  public static PlanCatalogResult from(Plan plan) {
    boolean unlimited =
        plan.getMemberLimit() < 0
            || plan.getDatasetUploadLimit() < 0
            || plan.getPipelineRunHourlyLimit() < 0;
    return new PlanCatalogResult(
        plan.getPlanKey(),
        plan.getName(),
        plan.getAmount(),
        plan.getCurrency(),
        plan.getBillingInterval(),
        plan.getMemberLimit(),
        plan.getDatasetUploadLimit(),
        plan.getPipelineRunHourlyLimit(),
        plan.isContactOnly(),
        unlimited);
  }
}
