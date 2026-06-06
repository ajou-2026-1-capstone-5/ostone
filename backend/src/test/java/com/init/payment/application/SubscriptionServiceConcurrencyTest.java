package com.init.payment.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;

import com.init.payment.application.exception.ActiveSubscriptionExistsException;
import com.init.payment.application.port.BillingKeyCipher;
import com.init.payment.application.port.TossBillingKeyResult;
import com.init.payment.application.port.TossPaymentPort;
import com.init.payment.application.port.TossPaymentResult;
import com.init.payment.domain.model.BillingInterval;
import com.init.payment.domain.model.Plan;
import com.init.payment.domain.model.Subscription;
import com.init.payment.domain.repository.PlanRepository;
import com.init.payment.domain.repository.SubscriptionRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Import({SubscriptionService.class, SubscriptionServiceConcurrencyTest.ClockTestConfig.class})
@DisplayName("SubscriptionService billing authorization concurrency")
class SubscriptionServiceConcurrencyTest {

  @Container static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

  static {
    postgres.start();
  }

  @DynamicPropertySource
  static void configureDataSource(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", postgres::getJdbcUrl);
    registry.add("spring.datasource.username", postgres::getUsername);
    registry.add("spring.datasource.password", postgres::getPassword);
    registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "create");
    registry.add(
        "spring.jpa.properties.hibernate.dialect", () -> "org.hibernate.dialect.PostgreSQLDialect");
    registry.add("spring.jpa.properties.hibernate.hbm2ddl.create_namespaces", () -> "true");
    registry.add("spring.liquibase.enabled", () -> "false");
  }

  @Autowired private SubscriptionService subscriptionService;
  @Autowired private PlanRepository planRepository;
  @Autowired private SubscriptionRepository subscriptionRepository;

  @MockitoBean private PaymentAccessGuard accessGuard;
  @MockitoBean private TossPaymentPort tossPaymentPort;
  @MockitoBean private BillingKeyCipher billingKeyCipher;
  @MockitoBean private WorkspaceQuotaUsagePort usagePort;

  @Test
  @Transactional(propagation = Propagation.NOT_SUPPORTED)
  @DisplayName("billingKey 동시 발급 요청은 첫 과금을 한 번만 실행한다")
  void shouldExecuteFirstChargeOnlyOnceWhenBillingKeyIssuedConcurrently() throws Exception {
    // given
    Plan plan = planRepository.save(plan());
    Subscription subscription = Subscription.create(1L, plan.getId());
    subscription.assignCustomerKey("wsk_1_abc");
    subscriptionRepository.save(subscription);

    AtomicInteger issueBillingKeyCalls = new AtomicInteger();
    AtomicInteger executeBillingCalls = new AtomicInteger();
    given(tossPaymentPort.issueBillingKey(eq("auth_xxx"), eq("wsk_1_abc")))
        .willAnswer(
            invocation -> {
              issueBillingKeyCalls.incrementAndGet();
              return new TossBillingKeyResult(
                  "bk_PLAINTEXT_SECRET",
                  "wsk_1_abc",
                  "신한",
                  "1234-****-****-5678",
                  "{\"billingKey\":\"***\"}");
            });
    given(billingKeyCipher.encrypt("bk_PLAINTEXT_SECRET")).willReturn(new byte[] {1, 2, 3});
    given(tossPaymentPort.executeBilling(any()))
        .willAnswer(
            invocation -> {
              executeBillingCalls.incrementAndGet();
              return new TossPaymentResult(
                  "pay_1",
                  "ord_1",
                  29000,
                  "DONE",
                  "카드",
                  OffsetDateTime.parse("2026-06-01T00:00:00Z"),
                  "https://receipt",
                  null,
                  "{\"status\":\"DONE\"}");
            });

    IssueBillingKeyCommand command = new IssueBillingKeyCommand(1L, 99L, "auth_xxx", "wsk_1_abc");
    CountDownLatch ready = new CountDownLatch(2);
    CountDownLatch start = new CountDownLatch(1);
    ExecutorService executor = Executors.newFixedThreadPool(2);

    try {
      List<Future<BillingAuthorizationAttempt>> futures =
          List.of(
              executor.submit(issueBillingKeyAttempt(command, ready, start)),
              executor.submit(issueBillingKeyAttempt(command, ready, start)));

      assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
      start.countDown();

      List<BillingAuthorizationAttempt> attempts =
          futures.stream()
              .map(SubscriptionServiceConcurrencyTest::getBillingAuthorizationAttempt)
              .toList();

      assertThat(attempts.stream().filter(BillingAuthorizationAttempt::succeeded).count())
          .describedAs("attempts=%s", attempts)
          .isEqualTo(1);
      assertThat(
              attempts.stream()
                  .filter(BillingAuthorizationAttempt::failedWithActiveSubscriptionExists)
                  .count())
          .describedAs("attempts=%s", attempts)
          .isEqualTo(1);
      assertThat(issueBillingKeyCalls).hasValue(1);
      assertThat(executeBillingCalls).hasValue(1);
    } finally {
      executor.shutdownNow();
    }
  }

  private Callable<BillingAuthorizationAttempt> issueBillingKeyAttempt(
      IssueBillingKeyCommand command, CountDownLatch ready, CountDownLatch start) {
    return () -> {
      ready.countDown();
      if (!start.await(5, TimeUnit.SECONDS)) {
        throw new IllegalStateException("billing authorization attempts were not released");
      }

      try {
        return BillingAuthorizationAttempt.success(subscriptionService.issueBillingKey(command));
      } catch (RuntimeException ex) {
        return BillingAuthorizationAttempt.failure(ex);
      }
    };
  }

  private static BillingAuthorizationAttempt getBillingAuthorizationAttempt(
      Future<BillingAuthorizationAttempt> future) {
    try {
      return future.get(10, TimeUnit.SECONDS);
    } catch (Exception ex) {
      throw new IllegalStateException("billing authorization attempt did not finish", ex);
    }
  }

  private Plan plan() {
    return Plan.create("pro_monthly", "Pro", 29000, "KRW", BillingInterval.MONTH);
  }

  private record BillingAuthorizationAttempt(BillingAuthorizationResult result, Throwable failure) {
    static BillingAuthorizationAttempt success(BillingAuthorizationResult result) {
      return new BillingAuthorizationAttempt(result, null);
    }

    static BillingAuthorizationAttempt failure(Throwable failure) {
      return new BillingAuthorizationAttempt(null, failure);
    }

    boolean succeeded() {
      return result != null && failure == null;
    }

    boolean failedWithActiveSubscriptionExists() {
      return failure instanceof ActiveSubscriptionExistsException;
    }
  }

  @TestConfiguration
  static class ClockTestConfig {

    @Bean
    Clock clock() {
      return Clock.fixed(Instant.parse("2026-06-01T00:00:00Z"), ZoneOffset.UTC);
    }
  }
}
