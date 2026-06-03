package com.init.payment.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;

import com.init.payment.domain.model.Subscription;
import com.init.payment.domain.repository.SubscriptionRepository;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("PaymentWorkspaceSubscriptionStatusAdapter")
class PaymentWorkspaceSubscriptionStatusAdapterTest {

  @Mock private SubscriptionRepository subscriptionRepository;

  private PaymentWorkspaceSubscriptionStatusAdapter adapter;

  @BeforeEach
  void setUp() {
    adapter = new PaymentWorkspaceSubscriptionStatusAdapter(subscriptionRepository);
  }

  @Test
  @DisplayName("현재 구독이 ACTIVE이면 true를 반환한다")
  void hasActiveSubscription_active_returnsTrue() {
    Subscription subscription = Subscription.create(1L, 10L);
    subscription.activate(now(), now().plusMonths(1), "customer-key");
    given(subscriptionRepository.findCurrentByWorkspaceId(1L))
        .willReturn(Optional.of(subscription));

    assertThat(adapter.hasActiveSubscription(1L)).isTrue();
  }

  @Test
  @DisplayName("현재 구독이 없으면 false를 반환한다")
  void hasActiveSubscription_missing_returnsFalse() {
    given(subscriptionRepository.findCurrentByWorkspaceId(1L)).willReturn(Optional.empty());

    assertThat(adapter.hasActiveSubscription(1L)).isFalse();
  }

  @Test
  @DisplayName("현재 구독이 ACTIVE가 아니면 false를 반환한다")
  void hasActiveSubscription_incomplete_returnsFalse() {
    Subscription subscription = Subscription.create(1L, 10L);
    given(subscriptionRepository.findCurrentByWorkspaceId(1L))
        .willReturn(Optional.of(subscription));

    assertThat(adapter.hasActiveSubscription(1L)).isFalse();
  }

  private OffsetDateTime now() {
    return OffsetDateTime.parse("2026-06-04T00:00:00Z");
  }
}
