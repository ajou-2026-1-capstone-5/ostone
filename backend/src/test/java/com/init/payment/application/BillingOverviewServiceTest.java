package com.init.payment.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

import com.init.payment.domain.model.BillingInterval;
import com.init.payment.domain.model.BillingKey;
import com.init.payment.domain.model.Payment;
import com.init.payment.domain.model.Plan;
import com.init.payment.domain.model.Subscription;
import com.init.payment.domain.repository.BillingKeyRepository;
import com.init.payment.domain.repository.PaymentRepository;
import com.init.payment.domain.repository.PlanRepository;
import com.init.payment.domain.repository.SubscriptionRepository;
import com.init.testsupport.PersistenceTestFixtures;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("BillingOverviewService")
class BillingOverviewServiceTest {

  @Mock private SubscriptionRepository subscriptionRepository;
  @Mock private PlanRepository planRepository;
  @Mock private BillingKeyRepository billingKeyRepository;
  @Mock private PaymentRepository paymentRepository;
  @Mock private WorkspaceQuotaUsagePort usagePort;
  @Mock private PaymentAccessGuard accessGuard;

  private BillingOverviewService service;

  private final Clock clock = Clock.fixed(Instant.parse("2026-06-01T00:00:00Z"), ZoneOffset.UTC);
  private final OffsetDateTime periodStart = OffsetDateTime.parse("2026-06-01T00:00:00Z");
  private final OffsetDateTime periodEnd = OffsetDateTime.parse("2026-07-01T00:00:00Z");
  private final OffsetDateTime hourFrom = OffsetDateTime.parse("2026-05-31T23:00:00Z");
  private final OffsetDateTime hourTo = OffsetDateTime.parse("2026-06-01T00:00:00Z");

  @BeforeEach
  void setUp() {
    service =
        new BillingOverviewService(
            subscriptionRepository,
            planRepository,
            billingKeyRepository,
            paymentRepository,
            usagePort,
            accessGuard,
            clock);
  }

  @Test
  @DisplayName("현재 구독, 결제수단, 결제내역, quota 사용량을 조합한다")
  void getOverview_activeSubscription_returnsAggregate() {
    Subscription subscription = activeSubscription();
    Plan plan = plan();
    BillingKey billingKey = billingKey();
    Payment payment = donePayment();

    given(subscriptionRepository.findCurrentByWorkspaceId(1L))
        .willReturn(Optional.of(subscription));
    given(planRepository.findById(2L)).willReturn(Optional.of(plan));
    given(billingKeyRepository.findActiveByWorkspaceId(1L)).willReturn(Optional.of(billingKey));
    given(paymentRepository.findByWorkspaceIdOrderByCreatedAtDesc(1L)).willReturn(List.of(payment));
    given(usagePort.countMembers(1L)).willReturn(8L);
    given(usagePort.countDatasetUploads(1L, periodStart, periodEnd)).willReturn(10L);
    given(usagePort.countPipelineRuns(1L, periodStart, periodEnd)).willReturn(11L);
    given(usagePort.countDomainPackOperations(1L, hourFrom, hourTo)).willReturn(1L);
    given(usagePort.findOldestDomainPackOperationAt(1L, hourFrom, hourTo))
        .willReturn(Optional.of(OffsetDateTime.parse("2026-05-31T23:30:00Z")));

    BillingOverviewResult result = service.getOverview(1L, 55L);

    then(accessGuard).should().requireBillingManager(1L, 55L);
    assertThat(result.subscription()).isNotNull();
    assertThat(result.billingKey().cardNumberMasked()).isEqualTo("1234-****-****-5678");
    assertThat(result.payments()).hasSize(1);
    assertThat(result.quotaUsages())
        .extracting(QuotaUsageResult::resource, QuotaUsageResult::used, QuotaUsageResult::warning)
        .containsExactly(
            org.assertj.core.groups.Tuple.tuple("MEMBER", 8L, false),
            org.assertj.core.groups.Tuple.tuple("DATASET_UPLOAD", 10L, true),
            org.assertj.core.groups.Tuple.tuple("PIPELINE_RUN", 11L, true),
            org.assertj.core.groups.Tuple.tuple("DOMAIN_PACK_OPERATION", 1L, true));
    assertThat(result.quotaUsages().get(3).nextAvailableAt())
        .isEqualTo(OffsetDateTime.parse("2026-06-01T00:30:00Z"));
  }

  @Test
  @DisplayName("현재 구독이 없으면 empty overview를 반환한다")
  void getOverview_noSubscription_returnsEmpty() {
    given(subscriptionRepository.findCurrentByWorkspaceId(1L)).willReturn(Optional.empty());

    BillingOverviewResult result = service.getOverview(1L, 55L);

    then(accessGuard).should().requireBillingManager(1L, 55L);
    assertThat(result.subscription()).isNull();
    assertThat(result.billingKey()).isNull();
    assertThat(result.payments()).isEmpty();
    assertThat(result.quotaUsages()).isEmpty();
  }

  private Subscription activeSubscription() {
    Subscription subscription = Subscription.create(1L, 2L);
    PersistenceTestFixtures.assignGeneratedId(subscription, 10L);
    subscription.assignCustomerKey("ws_1");
    subscription.activate(periodStart, periodEnd, "ws_1");
    return subscription;
  }

  private Plan plan() {
    Plan plan = Plan.create("pro_monthly", "Pro (Monthly)", 29000, "KRW", BillingInterval.MONTH);
    PersistenceTestFixtures.assignGeneratedId(plan, 2L);
    return plan;
  }

  private BillingKey billingKey() {
    BillingKey billingKey =
        BillingKey.create(1L, "ws_1", new byte[] {1, 2, 3}, "신한", "1234-****-****-5678");
    PersistenceTestFixtures.assignGeneratedId(billingKey, 5L);
    return billingKey;
  }

  private Payment donePayment() {
    Payment payment = Payment.createOrder(1L, 10L, "ord_1", 29000, "KRW", "Pro (Monthly)");
    PersistenceTestFixtures.assignGeneratedId(payment, 7L);
    payment.complete(
        "pay_1", "카드", periodStart, "https://receipt.example", "{\"status\":\"DONE\"}");
    return payment;
  }
}
