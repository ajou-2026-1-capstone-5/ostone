package com.init.payment.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 정기결제 인앱 스케줄러 (U-001: Spring @Scheduled). 만기/재시도/기간말 해지 대상을 주기 스캔한다. 다중 인스턴스 배포 시 중복 실행 방지는 배포
 * 형상(단일 인스턴스 또는 분산 락)에 따르며, DB unique 제약(U-011)이 최종 중복청구 안전망이다.
 */
@Component
public class RecurringBillingScheduler {

  private static final Logger log = LoggerFactory.getLogger(RecurringBillingScheduler.class);

  private final RecurringBillingService recurringBillingService;

  public RecurringBillingScheduler(RecurringBillingService recurringBillingService) {
    this.recurringBillingService = recurringBillingService;
  }

  @Scheduled(cron = "${toss.scheduler.recurring-billing-cron:0 */30 * * * *}")
  public void runRecurringBilling() {
    try {
      recurringBillingService.run();
    } catch (RuntimeException ex) {
      log.error("정기결제 스케줄러 실행 중 오류", ex);
    }
  }
}
