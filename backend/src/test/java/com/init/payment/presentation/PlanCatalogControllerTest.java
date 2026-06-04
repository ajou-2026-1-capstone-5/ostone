package com.init.payment.presentation;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.fixtures.WithLongPrincipal;
import com.init.payment.application.PlanCatalogResult;
import com.init.payment.application.PlanCatalogService;
import com.init.payment.domain.model.BillingInterval;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    value = PlanCatalogController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@DisplayName("PlanCatalogController")
class PlanCatalogControllerTest {

  private final MockMvc mockMvc;

  @Autowired
  PlanCatalogControllerTest(MockMvc mockMvc) {
    this.mockMvc = mockMvc;
  }

  @MockitoBean private PlanCatalogService planCatalogService;

  @Test
  @DisplayName("활성 요금제 목록을 200으로 반환한다")
  @WithLongPrincipal(55L)
  void listPlans_returns200() throws Exception {
    given(planCatalogService.listActivePlans())
        .willReturn(
            List.of(
                new PlanCatalogResult(
                    "pro_monthly",
                    "Pro (Monthly)",
                    29000,
                    "KRW",
                    BillingInterval.MONTH,
                    3,
                    10,
                    1,
                    false,
                    false),
                new PlanCatalogResult(
                    "enterprise",
                    "Enterprise",
                    0,
                    "KRW",
                    BillingInterval.MONTH,
                    -1,
                    -1,
                    -1,
                    true,
                    true)));

    mockMvc
        .perform(get("/api/v1/plans"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].planKey").value("pro_monthly"))
        .andExpect(jsonPath("$[0].pipelineRunHourlyLimit").value(1))
        .andExpect(jsonPath("$[0].contactOnly").value(false))
        .andExpect(jsonPath("$[1].planKey").value("enterprise"))
        .andExpect(jsonPath("$[1].contactOnly").value(true))
        .andExpect(jsonPath("$[1].unlimited").value(true));
  }
}
