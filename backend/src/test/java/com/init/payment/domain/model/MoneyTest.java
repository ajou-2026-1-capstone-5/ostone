package com.init.payment.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("Money 밸류 오브젝트")
class MoneyTest {

  @Test
  @DisplayName("of()로 생성 시 amount와 currency를 반환한다")
  void of_success() {
    Money money = Money.of(29000, "KRW");

    assertThat(money.amount()).isEqualTo(29000);
    assertThat(money.currency()).isEqualTo("KRW");
  }

  @Test
  @DisplayName("krw() 팩토리는 KRW 통화로 생성한다")
  void krw_factory() {
    Money money = Money.krw(5000);

    assertThat(money.amount()).isEqualTo(5000);
    assertThat(money.currency()).isEqualTo("KRW");
  }

  @Test
  @DisplayName("isSameAmount()는 같은 금액에 true를 반환한다")
  void isSameAmount_match() {
    Money money = Money.of(29000, "KRW");

    assertThat(money.isSameAmount(29000)).isTrue();
    assertThat(money.isSameAmount(10000)).isFalse();
  }

  @Test
  @DisplayName("음수 금액이면 생성을 거부한다")
  void negativeAmount_throws() {
    assertThatThrownBy(() -> Money.of(-1, "KRW")).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("빈 통화 코드이면 생성을 거부한다")
  void blankCurrency_throws() {
    assertThatThrownBy(() -> Money.of(1000, "")).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> Money.of(1000, null)).isInstanceOf(IllegalArgumentException.class);
  }
}
