package com.init.payment.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("BillingKey 도메인")
class BillingKeyTest {

  @Test
  @DisplayName("정상 파라미터로 생성 시 ACTIVE 상태이다")
  void create_success() {
    BillingKey billingKey =
        BillingKey.create(1L, "wsk_1_abc", new byte[] {1, 2, 3}, "신한", "1234-****");

    assertThat(billingKey.isActive()).isTrue();
    assertThat(billingKey.getWorkspaceId()).isEqualTo(1L);
    assertThat(billingKey.getCustomerKey()).isEqualTo("wsk_1_abc");
    assertThat(billingKey.getCardCompany()).isEqualTo("신한");
    assertThat(billingKey.getCardNumberMasked()).isEqualTo("1234-****");
    assertThat(billingKey.getBillingKeyEncrypted()).containsExactly(1, 2, 3);
  }

  @Test
  @DisplayName("workspaceId null이면 생성을 거부한다")
  void create_nullWorkspaceId_throws() {
    assertThatThrownBy(() -> BillingKey.create(null, "wsk_1_abc", new byte[] {1}, "신한", "1234"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("customerKey blank이면 생성을 거부한다")
  void create_blankCustomerKey_throws() {
    assertThatThrownBy(() -> BillingKey.create(1L, "", new byte[] {1}, "신한", "1234"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("billingKeyEncrypted가 null이거나 비어 있으면 생성을 거부한다")
  void create_emptyEncryptedKey_throws() {
    assertThatThrownBy(() -> BillingKey.create(1L, "wsk_1_abc", null, "신한", "1234"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> BillingKey.create(1L, "wsk_1_abc", new byte[0], "신한", "1234"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("revoke() 호출 시 DELETED 상태로 전이한다")
  void revoke_setsDeleted() {
    BillingKey billingKey = BillingKey.create(1L, "wsk_1_abc", new byte[] {1}, "신한", "1234");

    billingKey.revoke();

    assertThat(billingKey.isActive()).isFalse();
    assertThat(billingKey.getStatus()).isEqualTo(BillingKeyStatus.DELETED);
  }
}
