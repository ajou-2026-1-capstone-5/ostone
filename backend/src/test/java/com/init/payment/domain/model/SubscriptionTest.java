package com.init.payment.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("Subscription 도메인")
class SubscriptionTest {

  private static final OffsetDateTime START = OffsetDateTime.parse("2026-06-01T00:00:00Z");
  private static final OffsetDateTime END = OffsetDateTime.parse("2026-07-01T00:00:00Z");

  @Test
  @DisplayName("생성 시 INCOMPLETE 상태로 시작한다")
  void create_startsIncomplete() {
    Subscription subscription = Subscription.create(1L, 10L);

    assertThat(subscription.getStatus()).isEqualTo(SubscriptionStatus.INCOMPLETE);
    assertThat(subscription.getFailedAttemptCount()).isZero();
    assertThat(subscription.isCancelAtPeriodEnd()).isFalse();
  }

  @Test
  @DisplayName("첫 결제 성공 시 ACTIVE로 활성화되고 주기/customerKey가 설정된다")
  void activate_setsActive() {
    Subscription subscription = Subscription.create(1L, 10L);

    subscription.activate(START, END, "wsk_1_abc");

    assertThat(subscription.getStatus()).isEqualTo(SubscriptionStatus.ACTIVE);
    assertThat(subscription.getCurrentPeriodStart()).isEqualTo(START);
    assertThat(subscription.getCurrentPeriodEnd()).isEqualTo(END);
    assertThat(subscription.getCustomerKey()).isEqualTo("wsk_1_abc");
  }

  @Test
  @DisplayName("billing authorization 시작과 실패 재시도 전이는 INCOMPLETE와 AUTHORIZING 사이에서만 허용한다")
  void billingAuthorization_transitions() {
    Subscription subscription = Subscription.create(1L, 10L);

    subscription.beginAuthorization();
    assertThat(subscription.getStatus()).isEqualTo(SubscriptionStatus.AUTHORIZING);

    subscription.resetAuthorization();
    assertThat(subscription.getStatus()).isEqualTo(SubscriptionStatus.INCOMPLETE);

    subscription.activate(START, END, "wsk_1_abc");
    assertThatThrownBy(subscription::beginAuthorization).isInstanceOf(IllegalStateException.class);
    assertThatThrownBy(subscription::resetAuthorization).isInstanceOf(IllegalStateException.class);
  }

  @Test
  @DisplayName("정기결제 실패 4회차에 재시도가 소진되어 해지된다 (U-004)")
  void recurringFailure_exhaustsRetryAndCancels() {
    Subscription subscription = activeSubscription();

    OffsetDateTime retryAt = END.plusDays(1);
    subscription.markPastDue(retryAt);
    assertThat(subscription.getStatus()).isEqualTo(SubscriptionStatus.PAST_DUE);
    assertThat(subscription.getFailedAttemptCount()).isEqualTo(1);
    assertThat(subscription.isRetryExhausted()).isFalse();

    subscription.markPastDue(retryAt.plusDays(1));
    subscription.markPastDue(retryAt.plusDays(2));
    assertThat(subscription.getFailedAttemptCount()).isEqualTo(3);
    assertThat(subscription.isRetryExhausted()).isFalse();

    subscription.markPastDue(retryAt.plusDays(3));
    assertThat(subscription.getFailedAttemptCount()).isEqualTo(4);
    assertThat(subscription.isRetryExhausted()).isTrue();

    subscription.cancel();
    assertThat(subscription.getStatus()).isEqualTo(SubscriptionStatus.CANCELED);
  }

  @Test
  @DisplayName("재시도 성공 시 ACTIVE로 복구되고 실패 카운트가 초기화된다")
  void recover_resetsFailureCount() {
    Subscription subscription = activeSubscription();
    subscription.markPastDue(END.plusDays(1));
    subscription.markPastDue(END.plusDays(2));

    subscription.recover(END, END.plusMonths(1));

    assertThat(subscription.getStatus()).isEqualTo(SubscriptionStatus.ACTIVE);
    assertThat(subscription.getFailedAttemptCount()).isZero();
    assertThat(subscription.getNextRetryAt()).isNull();
  }

  @Test
  @DisplayName("기간말 해지 예약 시 ACTIVE를 유지하고 cancelAtPeriodEnd만 true가 된다 (U-005)")
  void scheduleCancelAtPeriodEnd_keepsActive() {
    Subscription subscription = activeSubscription();

    subscription.scheduleCancelAtPeriodEnd();

    assertThat(subscription.getStatus()).isEqualTo(SubscriptionStatus.ACTIVE);
    assertThat(subscription.isCancelAtPeriodEnd()).isTrue();
  }

  @Test
  @DisplayName("취소된 구독은 활성화할 수 없다")
  void activate_onCanceled_throws() {
    Subscription subscription = activeSubscription();
    subscription.cancel();

    assertThatThrownBy(() -> subscription.activate(START, END, "ck"))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  @DisplayName("activate/renew에서 기간이 null이거나 순서가 잘못되면 거부한다 (V-NEW-007)")
  void activate_invalidPeriod_throws() {
    Subscription subscription = Subscription.create(1L, 10L);

    assertThatThrownBy(() -> subscription.activate(null, END, "ck"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> subscription.activate(START, null, "ck"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> subscription.activate(END, START, "ck"))
        .isInstanceOf(IllegalArgumentException.class);

    Subscription active = activeSubscription();
    assertThatThrownBy(() -> active.renew(null, END)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> active.renew(END, START)).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("customerKey를 다른 값으로 재설정하면 거부한다 (V-NEW-006)")
  void assignCustomerKey_reassign_throws() {
    Subscription subscription = Subscription.create(1L, 10L);
    subscription.assignCustomerKey("wsk_1_abc");

    assertThatThrownBy(() -> subscription.assignCustomerKey("wsk_2_different"))
        .isInstanceOf(IllegalStateException.class);

    subscription.assignCustomerKey("wsk_1_abc");
  }

  @Test
  @DisplayName("ACTIVE가 아닌 구독에 scheduleCancelAtPeriodEnd()를 호출하면 거부한다 (V-NEW-008)")
  void scheduleCancelAtPeriodEnd_nonActive_throws() {
    Subscription incomplete = Subscription.create(1L, 10L);
    assertThatThrownBy(incomplete::scheduleCancelAtPeriodEnd)
        .isInstanceOf(IllegalStateException.class);

    Subscription canceled = activeSubscription();
    canceled.cancel();
    assertThatThrownBy(canceled::scheduleCancelAtPeriodEnd)
        .isInstanceOf(IllegalStateException.class);
  }

  private Subscription activeSubscription() {
    Subscription subscription = Subscription.create(1L, 10L);
    subscription.activate(START, END, "wsk_1_abc");
    return subscription;
  }
}
