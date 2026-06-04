package com.init.payment.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;

import com.init.payment.domain.model.BillingInterval;
import com.init.payment.domain.model.Plan;
import com.init.payment.domain.repository.PlanRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("PlanCatalogService")
class PlanCatalogServiceTest {

  @Mock private PlanRepository planRepository;
  private PlanCatalogService service;

  @BeforeEach
  void setUp() {
    service = new PlanCatalogService(planRepository);
  }

  @Test
  @DisplayName("활성 플랜을 amount 오름차순(repository 위임)으로 매핑하여 반환한다")
  void listActivePlans_mapsLimitsAndFlags() {
    Plan pro =
        Plan.create(
            "pro_monthly",
            "Pro (Monthly)",
            29000,
            "KRW",
            BillingInterval.MONTH,
            3,
            10,
            10,
            1,
            false);
    Plan enterprise =
        Plan.create(
            "enterprise", "Enterprise", 0, "KRW", BillingInterval.MONTH, -1, -1, -1, -1, true);
    given(planRepository.findAllByStatusOrderByAmountAsc(Plan.STATUS_ACTIVE))
        .willReturn(List.of(enterprise, pro));

    List<PlanCatalogResult> result = service.listActivePlans();

    assertThat(result).hasSize(2);

    PlanCatalogResult enterpriseResult = result.get(0);
    assertThat(enterpriseResult.planKey()).isEqualTo("enterprise");
    assertThat(enterpriseResult.contactOnly()).isTrue();
    assertThat(enterpriseResult.unlimited()).isTrue();
    assertThat(enterpriseResult.memberLimit()).isEqualTo(-1);

    PlanCatalogResult proResult = result.get(1);
    assertThat(proResult.planKey()).isEqualTo("pro_monthly");
    assertThat(proResult.memberLimit()).isEqualTo(3);
    assertThat(proResult.pipelineRunHourlyLimit()).isEqualTo(1);
    assertThat(proResult.contactOnly()).isFalse();
    assertThat(proResult.unlimited()).isFalse();
    assertThat(proResult.interval()).isEqualTo(BillingInterval.MONTH);
  }
}
