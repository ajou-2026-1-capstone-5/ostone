package com.init.payment.application;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("RecurringBillingScheduler")
class RecurringBillingSchedulerTest {

  @Mock private RecurringBillingService recurringBillingService;

  private RecurringBillingScheduler scheduler;

  @BeforeEach
  void setUp() {
    scheduler = new RecurringBillingScheduler(recurringBillingService);
  }

  @Test
  @DisplayName("runRecurringBilling은 RecurringBillingService.run()에 위임한다")
  void runRecurringBilling_delegates() {
    scheduler.runRecurringBilling();

    verify(recurringBillingService).run();
  }

  @Test
  @DisplayName("RecurringBillingService.run()이 RuntimeException을 던져도 스케줄러가 삼킨다")
  void runRecurringBilling_catchesRuntimeException() {
    doThrow(new RuntimeException("service error")).when(recurringBillingService).run();

    assertThatCode(() -> scheduler.runRecurringBilling()).doesNotThrowAnyException();
    verify(recurringBillingService).run();
  }
}
