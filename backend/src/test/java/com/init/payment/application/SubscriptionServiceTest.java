package com.init.payment.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.payment.application.exception.ActiveSubscriptionExistsException;
import com.init.payment.application.exception.PaymentGatewayException;
import com.init.payment.application.exception.SubscriptionNotFoundException;
import com.init.payment.application.port.BillingKeyCipher;
import com.init.payment.application.port.TossBillingKeyResult;
import com.init.payment.application.port.TossPaymentPort;
import com.init.payment.application.port.TossPaymentResult;
import com.init.payment.domain.model.BillingInterval;
import com.init.payment.domain.model.BillingKey;
import com.init.payment.domain.model.Plan;
import com.init.payment.domain.model.Subscription;
import com.init.payment.domain.model.SubscriptionStatus;
import com.init.payment.domain.repository.BillingKeyRepository;
import com.init.payment.domain.repository.PaymentRepository;
import com.init.payment.domain.repository.PlanRepository;
import com.init.payment.domain.repository.SubscriptionRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.testsupport.PersistenceTestFixtures;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

@ExtendWith(MockitoExtension.class)
@DisplayName("SubscriptionService")
class SubscriptionServiceTest {

  @Mock private SubscriptionRepository subscriptionRepository;
  @Mock private PlanRepository planRepository;
  @Mock private BillingKeyRepository billingKeyRepository;
  @Mock private PaymentRepository paymentRepository;
  @Mock private WorkspaceQuotaUsagePort usagePort;
  @Mock private TossPaymentPort tossPaymentPort;
  @Mock private BillingKeyCipher billingKeyCipher;
  @Mock private PaymentAccessGuard accessGuard;
  @Mock private PlatformTransactionManager transactionManager;

  private SubscriptionService subscriptionService;

  private final Clock clock = Clock.fixed(Instant.parse("2026-06-01T00:00:00Z"), ZoneOffset.UTC);

  @BeforeEach
  void setUp() {
    subscriptionService =
        new SubscriptionService(
            subscriptionRepository,
            planRepository,
            billingKeyRepository,
            paymentRepository,
            usagePort,
            tossPaymentPort,
            billingKeyCipher,
            accessGuard,
            clock,
            transactionManager);
  }

  @Test
  @DisplayName("구독 생성 시 INCOMPLETE 상태와 workspace 스코프 customerKey를 부여한다")
  void createSubscription_success() {
    given(planRepository.findByPlanKey("pro_monthly")).willReturn(Optional.of(plan(10L)));
    given(subscriptionRepository.findCurrentByWorkspaceId(1L)).willReturn(Optional.empty());
    given(subscriptionRepository.save(any())).willAnswer(inv -> inv.getArgument(0));

    SubscriptionResult result =
        subscriptionService.createSubscription(
            new CreateSubscriptionCommand(1L, 99L, "pro_monthly"));

    assertThat(result.status()).isEqualTo("INCOMPLETE");
    assertThat(result.planKey()).isEqualTo("pro_monthly");
    assertThat(result.customerKey()).startsWith("wsk_1_");
  }

  @Test
  @DisplayName("contact-only(Enterprise) 플랜은 구독 생성을 거부한다")
  void createSubscription_contactOnlyPlan_throws() {
    Plan enterprise =
        Plan.create(
            "enterprise", "Enterprise", 0, "KRW", BillingInterval.MONTH, -1, -1, -1, -1, true);
    PersistenceTestFixtures.assignGeneratedId(enterprise, 20L);
    given(planRepository.findByPlanKey("enterprise")).willReturn(Optional.of(enterprise));

    assertThatThrownBy(
            () ->
                subscriptionService.createSubscription(
                    new CreateSubscriptionCommand(1L, 99L, "enterprise")))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("도입 문의");
  }

  @Test
  @DisplayName("이미 진행 중인 구독이 있으면 ActiveSubscriptionExistsException을 던진다")
  void createSubscription_duplicate() {
    given(planRepository.findByPlanKey("pro_monthly")).willReturn(Optional.of(plan(10L)));
    given(subscriptionRepository.findCurrentByWorkspaceId(1L))
        .willReturn(Optional.of(subscription(5L)));

    assertThatThrownBy(
            () ->
                subscriptionService.createSubscription(
                    new CreateSubscriptionCommand(1L, 99L, "pro_monthly")))
        .isInstanceOf(ActiveSubscriptionExistsException.class);
  }

  @Test
  @DisplayName("구독 저장 중 open subscription partial unique index 충돌 시 409 예외로 변환한다")
  void createSubscription_openSubscriptionUniqueViolation_throwsActiveSubscriptionExists() {
    given(planRepository.findByPlanKey("pro_monthly")).willReturn(Optional.of(plan(10L)));
    given(subscriptionRepository.findCurrentByWorkspaceId(1L)).willReturn(Optional.empty());
    given(subscriptionRepository.save(any()))
        .willThrow(
            new DataIntegrityViolationException(
                "duplicate key value violates unique constraint "
                    + "\"uq_payment_subscription_workspace_open\""));
    CreateSubscriptionCommand command = new CreateSubscriptionCommand(1L, 99L, "pro_monthly");

    assertThatThrownBy(() -> subscriptionService.createSubscription(command))
        .isInstanceOf(ActiveSubscriptionExistsException.class)
        .hasCauseInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  @DisplayName("구독 저장 중 Hibernate constraintName으로 open subscription index가 전달되면 409 예외로 변환한다")
  void createSubscription_openSubscriptionConstraintName_throwsActiveSubscriptionExists() {
    given(planRepository.findByPlanKey("pro_monthly")).willReturn(Optional.of(plan(10L)));
    given(subscriptionRepository.findCurrentByWorkspaceId(1L)).willReturn(Optional.empty());
    given(subscriptionRepository.save(any()))
        .willThrow(
            new DataIntegrityViolationException(
                "duplicate",
                new org.hibernate.exception.ConstraintViolationException(
                    "duplicate",
                    new SQLException("duplicate"),
                    "uq_payment_subscription_workspace_open")));
    CreateSubscriptionCommand command = new CreateSubscriptionCommand(1L, 99L, "pro_monthly");

    assertThatThrownBy(() -> subscriptionService.createSubscription(command))
        .isInstanceOf(ActiveSubscriptionExistsException.class)
        .hasCauseInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  @DisplayName("구독 저장 중 open subscription partial unique index 외 무결성 오류는 그대로 전파한다")
  void createSubscription_otherIntegrityViolation_rethrowsOriginalException() {
    given(planRepository.findByPlanKey("pro_monthly")).willReturn(Optional.of(plan(10L)));
    given(subscriptionRepository.findCurrentByWorkspaceId(1L)).willReturn(Optional.empty());
    given(subscriptionRepository.save(any()))
        .willThrow(new DataIntegrityViolationException("foreign key violation"));
    CreateSubscriptionCommand command = new CreateSubscriptionCommand(1L, 99L, "pro_monthly");

    assertThatThrownBy(() -> subscriptionService.createSubscription(command))
        .isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  @DisplayName("구독 조회 성공 시 SubscriptionResult를 반환한다")
  void getSubscription_success() {
    Subscription subscription = subscription(5L);
    given(subscriptionRepository.findCurrentByWorkspaceId(1L))
        .willReturn(Optional.of(subscription));
    given(planRepository.findById(10L)).willReturn(Optional.of(plan(10L)));
    given(
            usagePort.countDomainPackOperations(
                1L,
                OffsetDateTime.parse("2026-05-31T23:00:00Z"),
                OffsetDateTime.parse("2026-06-01T00:00:00Z")))
        .willReturn(1L);
    given(
            usagePort.findOldestDomainPackOperationAt(
                1L,
                OffsetDateTime.parse("2026-05-31T23:00:00Z"),
                OffsetDateTime.parse("2026-06-01T00:00:00Z")))
        .willReturn(Optional.of(OffsetDateTime.parse("2026-05-31T23:15:00Z")));

    SubscriptionResult result = subscriptionService.getSubscription(1L, 99L);

    assertThat(result.planKey()).isEqualTo("pro_monthly");
    assertThat(result.quotaUsages())
        .extracting(QuotaUsageResult::resource, QuotaUsageResult::used, QuotaUsageResult::warning)
        .containsExactly(org.assertj.core.groups.Tuple.tuple("DOMAIN_PACK_OPERATION", 1L, true));
    assertThat(result.quotaUsages().get(0).nextAvailableAt())
        .isEqualTo(OffsetDateTime.parse("2026-06-01T00:15:00Z"));
    verify(accessGuard).requireMember(1L, 99L);
  }

  @Test
  @DisplayName("구독이 없으면 조회 시 SubscriptionNotFoundException을 던진다")
  void getSubscription_notFound() {
    given(subscriptionRepository.findCurrentByWorkspaceId(1L)).willReturn(Optional.empty());

    assertThatThrownBy(() -> subscriptionService.getSubscription(1L, 99L))
        .isInstanceOf(SubscriptionNotFoundException.class);
    verify(accessGuard).requireMember(1L, 99L);
  }

  @Test
  @DisplayName("INCOMPLETE 구독 취소 시 즉시 CANCELED로 전이한다")
  void cancelSubscription_incomplete_immediateCancel() {
    Subscription subscription = subscription(5L);
    given(subscriptionRepository.findCurrentByWorkspaceId(1L))
        .willReturn(Optional.of(subscription));
    given(subscriptionRepository.save(any())).willAnswer(inv -> inv.getArgument(0));
    given(planRepository.findById(10L)).willReturn(Optional.of(plan(10L)));

    SubscriptionResult result = subscriptionService.cancelSubscription(1L, 99L);

    assertThat(result.status()).isEqualTo("CANCELED");
    verify(accessGuard).requireMember(1L, 99L);
  }

  @Test
  @DisplayName("ACTIVE 구독 취소 시 기간말 해지 예약으로 ACTIVE 유지한다 (U-005)")
  void cancelSubscription_active_scheduleAtPeriodEnd() {
    Subscription subscription = subscription(5L);
    subscription.activate(
        java.time.OffsetDateTime.parse("2026-06-01T00:00:00Z"),
        java.time.OffsetDateTime.parse("2026-07-01T00:00:00Z"),
        "wsk_1_abc");
    given(subscriptionRepository.findCurrentByWorkspaceId(1L))
        .willReturn(Optional.of(subscription));
    given(subscriptionRepository.save(any())).willAnswer(inv -> inv.getArgument(0));
    given(planRepository.findById(10L)).willReturn(Optional.of(plan(10L)));

    SubscriptionResult result = subscriptionService.cancelSubscription(1L, 99L);

    assertThat(result.status()).isEqualTo("ACTIVE");
    assertThat(subscription.isCancelAtPeriodEnd()).isTrue();
    verify(accessGuard).requireMember(1L, 99L);
  }

  @Test
  @DisplayName(
      "INCOMPLETE가 아닌 구독에 billingKey 발급 시 ActiveSubscriptionExistsException을 던진다 (V-NEW-003)")
  void issueBillingKey_nonIncomplete_throws() {
    given(transactionManager.getTransaction(any())).willReturn(new SimpleTransactionStatus());
    Subscription activeSubscription = Subscription.create(1L, 10L);
    activeSubscription.assignCustomerKey("wsk_1_abc");
    activeSubscription.activate(
        java.time.OffsetDateTime.parse("2026-05-01T00:00:00Z"),
        java.time.OffsetDateTime.parse("2026-06-01T00:00:00Z"),
        "wsk_1_abc");
    PersistenceTestFixtures.assignGeneratedId(activeSubscription, 5L);
    given(subscriptionRepository.findCurrentByWorkspaceIdForUpdate(1L))
        .willReturn(Optional.of(activeSubscription));

    assertThatThrownBy(
            () ->
                subscriptionService.issueBillingKey(
                    new IssueBillingKeyCommand(1L, 99L, "auth_xxx", "wsk_1_abc")))
        .isInstanceOf(ActiveSubscriptionExistsException.class);
    verify(accessGuard).requireMember(1L, 99L);
    verify(tossPaymentPort, never()).issueBillingKey(any(), any());
    verify(tossPaymentPort, never()).executeBilling(any());
  }

  @Test
  @DisplayName("AUTHORIZING 구독에 billingKey 발급 시 외부 호출 전에 409 예외를 던진다")
  void issueBillingKey_authorizing_throwsBeforeExternalCall() {
    given(transactionManager.getTransaction(any())).willReturn(new SimpleTransactionStatus());
    Subscription subscription = subscription(5L);
    subscription.beginAuthorization();
    given(subscriptionRepository.findCurrentByWorkspaceIdForUpdate(1L))
        .willReturn(Optional.of(subscription));

    assertThatThrownBy(
            () ->
                subscriptionService.issueBillingKey(
                    new IssueBillingKeyCommand(1L, 99L, "auth_xxx", "wsk_1_abc")))
        .isInstanceOf(ActiveSubscriptionExistsException.class);

    verify(tossPaymentPort, never()).issueBillingKey(any(), any());
    verify(tossPaymentPort, never()).executeBilling(any());
  }

  @Test
  @DisplayName("billingKey 발급 시 평문은 암호화되어 저장되고 응답에는 마스킹 카드정보만 포함된다 (U-002, U-012)")
  void issueBillingKey_encryptsAndDoesNotExposePlaintext() {
    Subscription subscription = subscription(5L);
    given(transactionManager.getTransaction(any())).willReturn(new SimpleTransactionStatus());
    given(subscriptionRepository.findCurrentByWorkspaceIdForUpdate(1L))
        .willReturn(Optional.of(subscription));
    given(subscriptionRepository.findByIdForUpdate(5L)).willReturn(Optional.of(subscription));
    given(subscriptionRepository.save(any())).willAnswer(inv -> inv.getArgument(0));
    given(planRepository.findById(10L)).willReturn(Optional.of(plan(10L)));
    given(tossPaymentPort.issueBillingKey("auth_xxx", "wsk_1_abc"))
        .willReturn(
            new TossBillingKeyResult(
                "bk_PLAINTEXT_SECRET",
                "wsk_1_abc",
                "신한",
                "1234-****-****-5678",
                "{\"billingKey\":\"***\"}"));
    given(billingKeyCipher.encrypt("bk_PLAINTEXT_SECRET")).willReturn(new byte[] {1, 2, 3});
    given(billingKeyRepository.save(any())).willAnswer(inv -> inv.getArgument(0));
    given(paymentRepository.save(any())).willAnswer(inv -> inv.getArgument(0));
    given(tossPaymentPort.executeBilling(any()))
        .willReturn(
            new TossPaymentResult(
                "pay_1",
                "ord_1",
                29000,
                "DONE",
                "카드",
                OffsetDateTime.now(clock),
                "https://receipt",
                null,
                "{\"status\":\"DONE\"}"));

    BillingAuthorizationResult result =
        subscriptionService.issueBillingKey(
            new IssueBillingKeyCommand(1L, 99L, "auth_xxx", "wsk_1_abc"));

    verify(billingKeyCipher).encrypt("bk_PLAINTEXT_SECRET");
    ArgumentCaptor<BillingKey> captor = ArgumentCaptor.forClass(BillingKey.class);
    verify(billingKeyRepository).save(captor.capture());
    assertThat(captor.getValue().getBillingKeyEncrypted()).containsExactly(1, 2, 3);

    assertThat(result.billingKey().cardNumberMasked()).isEqualTo("1234-****-****-5678");
    assertThat(result.subscription().status()).isEqualTo("ACTIVE");
    assertThat(result.toString()).doesNotContain("bk_PLAINTEXT_SECRET");
  }

  @Test
  @DisplayName("billingKey 발급 중 게이트웨이 오류가 발생하면 AUTHORIZING을 INCOMPLETE로 되돌린다")
  void issueBillingKey_gatewayFailure_resetsAuthorization() {
    Subscription subscription = subscription(5L);
    given(transactionManager.getTransaction(any())).willReturn(new SimpleTransactionStatus());
    given(subscriptionRepository.findCurrentByWorkspaceIdForUpdate(1L))
        .willReturn(Optional.of(subscription));
    given(subscriptionRepository.findByIdForUpdate(5L)).willReturn(Optional.of(subscription));
    given(subscriptionRepository.save(any())).willAnswer(inv -> inv.getArgument(0));
    given(planRepository.findById(10L)).willReturn(Optional.of(plan(10L)));
    given(tossPaymentPort.issueBillingKey("auth_xxx", "wsk_1_abc"))
        .willThrow(new PaymentGatewayException("gateway down"));

    assertThatThrownBy(
            () ->
                subscriptionService.issueBillingKey(
                    new IssueBillingKeyCommand(1L, 99L, "auth_xxx", "wsk_1_abc")))
        .isInstanceOf(PaymentGatewayException.class);

    assertThat(subscription.getStatus()).isEqualTo(SubscriptionStatus.INCOMPLETE);
    verify(tossPaymentPort, never()).executeBilling(any());
  }

  @Test
  @DisplayName("첫 과금이 DONE이 아니면 결제를 중단 기록하고 AUTHORIZING을 INCOMPLETE로 되돌린다")
  void issueBillingKey_chargeNotDone_resetsAuthorization() {
    Subscription subscription = subscription(5L);
    given(transactionManager.getTransaction(any())).willReturn(new SimpleTransactionStatus());
    given(subscriptionRepository.findCurrentByWorkspaceIdForUpdate(1L))
        .willReturn(Optional.of(subscription));
    given(subscriptionRepository.findByIdForUpdate(5L)).willReturn(Optional.of(subscription));
    given(subscriptionRepository.save(any())).willAnswer(inv -> inv.getArgument(0));
    given(planRepository.findById(10L)).willReturn(Optional.of(plan(10L)));
    given(tossPaymentPort.issueBillingKey("auth_xxx", "wsk_1_abc"))
        .willReturn(
            new TossBillingKeyResult(
                "bk_PLAINTEXT_SECRET",
                "wsk_1_abc",
                "신한",
                "1234-****-****-5678",
                "{\"billingKey\":\"***\"}"));
    given(billingKeyCipher.encrypt("bk_PLAINTEXT_SECRET")).willReturn(new byte[] {1, 2, 3});
    given(billingKeyRepository.save(any())).willAnswer(inv -> inv.getArgument(0));
    given(paymentRepository.save(any())).willAnswer(inv -> inv.getArgument(0));
    given(tossPaymentPort.executeBilling(any()))
        .willReturn(
            new TossPaymentResult(
                null,
                "ord_1",
                29000,
                "ABORTED",
                null,
                null,
                null,
                null,
                "{\"status\":\"ABORTED\"}"));

    BillingAuthorizationResult result =
        subscriptionService.issueBillingKey(
            new IssueBillingKeyCommand(1L, 99L, "auth_xxx", "wsk_1_abc"));

    assertThat(result.subscription().status()).isEqualTo("INCOMPLETE");
    assertThat(subscription.getStatus()).isEqualTo(SubscriptionStatus.INCOMPLETE);
  }

  private Subscription subscription(Long id) {
    Subscription subscription = Subscription.create(1L, 10L);
    subscription.assignCustomerKey("wsk_1_abc");
    PersistenceTestFixtures.assignGeneratedId(subscription, id);
    return subscription;
  }

  private Plan plan(Long id) {
    Plan plan = Plan.create("pro_monthly", "Pro", 29000, "KRW", BillingInterval.MONTH);
    PersistenceTestFixtures.assignGeneratedId(plan, id);
    return plan;
  }
}
