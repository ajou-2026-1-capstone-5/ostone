package com.init.payment.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.fixtures.WithLongPrincipal;
import com.init.payment.application.BillingAuthorizationResult;
import com.init.payment.application.BillingKeySummary;
import com.init.payment.application.SubscriptionResult;
import com.init.payment.application.SubscriptionService;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    value = SubscriptionController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@DisplayName("SubscriptionController")
class SubscriptionControllerTest {

  private static final String BASE_URL = "/api/v1/workspaces/1";

  private final MockMvc mockMvc;

  @Autowired
  SubscriptionControllerTest(MockMvc mockMvc) {
    this.mockMvc = mockMvc;
  }

  @MockitoBean private SubscriptionService subscriptionService;

  @Test
  @DisplayName("구독 조회 성공 시 200을 반환한다")
  @WithLongPrincipal(55L)
  void getSubscription_returns200() throws Exception {
    given(subscriptionService.getSubscription(1L, 55L)).willReturn(subscriptionResult("ACTIVE"));

    mockMvc
        .perform(get(BASE_URL + "/subscription"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("ACTIVE"))
        .andExpect(jsonPath("$.planKey").value("pro_monthly"));
  }

  @Test
  @DisplayName("구독 생성 성공 시 201을 반환한다")
  @WithLongPrincipal(55L)
  void createSubscription_returns201() throws Exception {
    given(subscriptionService.createSubscription(any()))
        .willReturn(subscriptionResult("INCOMPLETE"));

    mockMvc
        .perform(
            post(BASE_URL + "/subscription")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"planKey\":\"pro_monthly\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.status").value("INCOMPLETE"));
  }

  @Test
  @DisplayName("planKey가 비어 있으면 400을 반환한다")
  @WithLongPrincipal(55L)
  void createSubscription_blankPlanKey_returns400() throws Exception {
    mockMvc
        .perform(
            post(BASE_URL + "/subscription")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  @DisplayName("구독 취소 성공 시 200을 반환한다")
  @WithLongPrincipal(55L)
  void cancelSubscription_returns200() throws Exception {
    given(subscriptionService.cancelSubscription(1L, 55L)).willReturn(subscriptionResult("ACTIVE"));

    mockMvc.perform(delete(BASE_URL + "/subscription").with(csrf())).andExpect(status().isOk());
  }

  @Test
  @DisplayName("billingKey 발급 성공 시 200과 마스킹 카드정보를 반환한다")
  @WithLongPrincipal(55L)
  void issueBillingKey_returns200() throws Exception {
    given(subscriptionService.issueBillingKey(any()))
        .willReturn(
            new BillingAuthorizationResult(
                subscriptionResult("ACTIVE"),
                new BillingKeySummary(5L, "신한", "1234-****-****-5678", "ACTIVE")));

    mockMvc
        .perform(
            post(BASE_URL + "/billing/authorizations")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"authKey\":\"auth_xxx\",\"customerKey\":\"wsk_1_abc\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.subscription.status").value("ACTIVE"))
        .andExpect(jsonPath("$.billingKey.cardNumberMasked").value("1234-****-****-5678"));
  }

  @Test
  @DisplayName("authKey가 비어 있으면 400을 반환한다")
  @WithLongPrincipal(55L)
  void issueBillingKey_blankAuthKey_returns400() throws Exception {
    mockMvc
        .perform(
            post(BASE_URL + "/billing/authorizations")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"authKey\":\"\"}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  @DisplayName("인증 principal이 없으면 401을 반환한다")
  void getSubscription_noAuth_returns401() throws Exception {
    mockMvc.perform(get(BASE_URL + "/subscription")).andExpect(status().isUnauthorized());
  }

  private SubscriptionResult subscriptionResult(String status) {
    return new SubscriptionResult(
        10L,
        1L,
        "pro_monthly",
        status,
        OffsetDateTime.parse("2026-06-01T00:00:00Z"),
        OffsetDateTime.parse("2026-07-01T00:00:00Z"),
        false,
        "wsk_1_abc");
  }
}
