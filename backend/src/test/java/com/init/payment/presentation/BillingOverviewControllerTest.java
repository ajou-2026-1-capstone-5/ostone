package com.init.payment.presentation;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.fixtures.WithLongPrincipal;
import com.init.payment.application.BillingKeySummary;
import com.init.payment.application.BillingOverviewResult;
import com.init.payment.application.BillingOverviewService;
import com.init.payment.application.PaymentResult;
import com.init.payment.application.QuotaUsageResult;
import com.init.payment.application.SubscriptionResult;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import java.time.OffsetDateTime;
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
    value = BillingOverviewController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@DisplayName("BillingOverviewController")
class BillingOverviewControllerTest {

  private static final String URL = "/api/v1/workspaces/1/billing/overview";

  private final MockMvc mockMvc;

  @Autowired
  BillingOverviewControllerTest(MockMvc mockMvc) {
    this.mockMvc = mockMvc;
  }

  @MockitoBean private BillingOverviewService billingOverviewService;

  @Test
  @DisplayName("billing overview 조회 성공 시 200과 masked card, quota, receipt를 반환한다")
  @WithLongPrincipal(55L)
  void getBillingOverview_returns200() throws Exception {
    given(billingOverviewService.getOverview(1L, 55L)).willReturn(overview());

    mockMvc
        .perform(get(URL))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.subscription.status").value("ACTIVE"))
        .andExpect(jsonPath("$.billingKey.cardCompany").value("신한"))
        .andExpect(jsonPath("$.billingKey.cardNumberMasked").value("1234-****-****-5678"))
        .andExpect(jsonPath("$.billingKey.secretKey").doesNotExist())
        .andExpect(jsonPath("$.billingKey.billingKey").doesNotExist())
        .andExpect(jsonPath("$.billingKey.rawCardNumber").doesNotExist())
        .andExpect(jsonPath("$.payments[0].receiptUrl").value("https://receipt.example"))
        .andExpect(jsonPath("$.quotaUsages[1].resource").value("DATASET_UPLOAD"))
        .andExpect(jsonPath("$.quotaUsages[1].warning").value(true));
  }

  @Test
  @DisplayName("구독이 없으면 null subscription과 빈 목록을 반환한다")
  @WithLongPrincipal(55L)
  void getBillingOverview_empty_returns200() throws Exception {
    given(billingOverviewService.getOverview(1L, 55L)).willReturn(BillingOverviewResult.empty());

    mockMvc
        .perform(get(URL))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.subscription").isEmpty())
        .andExpect(jsonPath("$.billingKey").isEmpty())
        .andExpect(jsonPath("$.payments").isEmpty())
        .andExpect(jsonPath("$.quotaUsages").isEmpty());
  }

  @Test
  @DisplayName("인증 principal이 없으면 401을 반환한다")
  void getBillingOverview_noAuth_returns401() throws Exception {
    mockMvc.perform(get(URL)).andExpect(status().isUnauthorized());
  }

  private BillingOverviewResult overview() {
    OffsetDateTime approvedAt = OffsetDateTime.parse("2026-06-01T00:00:00Z");
    return new BillingOverviewResult(
        new SubscriptionResult(
            10L,
            1L,
            "pro_monthly",
            "ACTIVE",
            approvedAt,
            OffsetDateTime.parse("2026-07-01T00:00:00Z"),
            false,
            "ws_1",
            10,
            10,
            10),
        new BillingKeySummary(5L, "신한", "1234-****-****-5678", "ACTIVE"),
        List.of(
            new PaymentResult(
                7L,
                "ord_1",
                "pay_1",
                29000,
                "KRW",
                "DONE",
                "카드",
                approvedAt,
                "https://receipt.example",
                approvedAt)),
        List.of(
            QuotaUsageResult.of("MEMBER", 8, 10),
            QuotaUsageResult.of("DATASET_UPLOAD", 10, 10),
            QuotaUsageResult.of("PIPELINE_RUN", 11, 10)));
  }
}
