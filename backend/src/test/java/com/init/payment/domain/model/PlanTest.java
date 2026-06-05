package com.init.payment.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("Plan 도메인")
class PlanTest {

  @Test
  @DisplayName("정상 파라미터로 생성 시 ACTIVE 상태이다")
  void create_success() {
    Plan plan = Plan.create("pro_monthly", "Pro (Monthly)", 29000, "KRW", BillingInterval.MONTH);

    assertThat(plan.getPlanKey()).isEqualTo("pro_monthly");
    assertThat(plan.getName()).isEqualTo("Pro (Monthly)");
    assertThat(plan.getAmount()).isEqualTo(29000);
    assertThat(plan.getCurrency()).isEqualTo("KRW");
    assertThat(plan.getBillingInterval()).isEqualTo(BillingInterval.MONTH);
    assertThat(plan.getStatus()).isEqualTo(Plan.STATUS_ACTIVE);
  }

  @Test
  @DisplayName("planKey blank이면 생성을 거부한다")
  void create_blankPlanKey_throws() {
    assertThatThrownBy(() -> Plan.create("", "Pro", 29000, "KRW", BillingInterval.MONTH))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> Plan.create(null, "Pro", 29000, "KRW", BillingInterval.MONTH))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("name blank이면 생성을 거부한다")
  void create_blankName_throws() {
    assertThatThrownBy(() -> Plan.create("pro_monthly", "", 29000, "KRW", BillingInterval.MONTH))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("billingInterval null이면 생성을 거부한다")
  void create_nullBillingInterval_throws() {
    assertThatThrownBy(() -> Plan.create("pro_monthly", "Pro", 29000, "KRW", null))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("price()는 Money 객체를 반환한다")
  void price_returnsMoney() {
    Plan plan = Plan.create("pro_monthly", "Pro", 29000, "KRW", BillingInterval.MONTH);

    Money price = plan.price();

    assertThat(price.amount()).isEqualTo(29000);
    assertThat(price.currency()).isEqualTo("KRW");
  }

  @Test
  @DisplayName("기본 팩토리는 한도 기본값(멤버10/시간당1)과 비-contact를 적용한다")
  void create_defaults() {
    Plan plan = Plan.create("pro_monthly", "Pro", 29000, "KRW", BillingInterval.MONTH);

    assertThat(plan.getMemberLimit()).isEqualTo(10);
    assertThat(plan.getDatasetUploadLimit()).isEqualTo(10);
    assertThat(plan.getPipelineRunLimit()).isEqualTo(10);
    assertThat(plan.getPipelineRunHourlyLimit()).isEqualTo(1);
    assertThat(plan.isContactOnly()).isFalse();
  }

  @Test
  @DisplayName("명시 팩토리는 전달된 한도/contact-only를 그대로 적용한다")
  void create_withExplicitLimits() {
    Plan plan =
        Plan.create(
            "max_monthly", "Max", 49000, "KRW", BillingInterval.MONTH, 10, 10, 10, 5, false);

    assertThat(plan.getMemberLimit()).isEqualTo(10);
    assertThat(plan.getPipelineRunHourlyLimit()).isEqualTo(5);
    assertThat(plan.isContactOnly()).isFalse();
  }

  @Test
  @DisplayName("Enterprise는 무제한(-1) 한도와 contact-only로 생성된다")
  void create_enterpriseUnlimitedContactOnly() {
    Plan plan =
        Plan.create(
            "enterprise", "Enterprise", 0, "KRW", BillingInterval.MONTH, -1, -1, -1, -1, true);

    assertThat(plan.getMemberLimit()).isEqualTo(-1);
    assertThat(plan.getPipelineRunHourlyLimit()).isEqualTo(-1);
    assertThat(plan.isContactOnly()).isTrue();
  }
}
