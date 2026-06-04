package com.init.payment.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.auth.application.JwtService;
import com.init.payment.application.AdminBillingCustomerSummary;
import com.init.payment.application.AdminBillingRefundResult;
import com.init.payment.application.AdminBillingUseCase;
import com.init.payment.domain.model.PaymentStatus;
import com.init.shared.infrastructure.security.ApiAuthenticationEntryPoint;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import com.init.shared.infrastructure.security.SecurityConfig;
import com.init.shared.presentation.GlobalExceptionHandler;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import java.time.OffsetDateTime;
import java.util.Date;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(AdminBillingController.class)
@Import({
  SecurityConfig.class,
  JwtAuthenticationFilter.class,
  ApiAuthenticationEntryPoint.class,
  GlobalExceptionHandler.class
})
@TestPropertySource(properties = "cors.allowed-origins=http://localhost:5173")
@DisplayName("AdminBillingController")
class AdminBillingControllerTest {

  @Autowired private MockMvc mockMvc;

  @MockitoBean private AdminBillingUseCase adminBillingUseCase;
  @MockitoBean private JwtService jwtService;

  @Test
  @DisplayName("GET /api/v1/admin/billing/customers: SUPER_ADMIN JWT → 200 OK")
  void should_200반환_when_SUPER_ADMIN조회요청() throws Exception {
    // given
    givenSuperAdminBearerToken("super-admin-token");
    given(adminBillingUseCase.findCustomerSummaries())
        .willReturn(
            List.of(
                new AdminBillingCustomerSummary(
                    1L,
                    "acme",
                    "Acme",
                    "ACTIVE",
                    OffsetDateTime.parse("2026-06-01T00:00:00Z"),
                    OffsetDateTime.parse("2026-07-01T00:00:00Z"),
                    OffsetDateTime.parse("2026-07-01T00:00:00Z"),
                    "Pro",
                    29_000L,
                    10L,
                    29_000L,
                    "DONE",
                    OffsetDateTime.parse("2026-06-01T00:00:00Z"),
                    null)));

    // when & then
    mockMvc
        .perform(
            get("/api/v1/admin/billing/customers")
                .header("Authorization", "Bearer super-admin-token"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].workspaceName").value("Acme"))
        .andExpect(jsonPath("$[0].subscription.status").value("ACTIVE"))
        .andExpect(jsonPath("$[0].recentPayment.id").value(10))
        .andExpect(jsonPath("$[0].recentPayment.status").value("DONE"))
        .andExpect(jsonPath("$[0].recentPayment.paymentKey").doesNotExist())
        .andExpect(jsonPath("$[0].recentPayment.billingKey").doesNotExist())
        .andExpect(jsonPath("$[0].recentPayment.secretKey").doesNotExist())
        .andExpect(jsonPath("$[0].recentPayment.cardNumber").doesNotExist())
        .andExpect(jsonPath("$[0].recentPayment.pan").doesNotExist());
  }

  @Test
  @DisplayName("POST /api/v1/admin/billing/payments/{paymentId}/refunds: SUPER_ADMIN JWT → 200 OK")
  void should_200반환_when_SUPER_ADMIN전체환불요청() throws Exception {
    // given
    givenSuperAdminBearerToken("super-admin-token");
    given(adminBillingUseCase.refundFull(any()))
        .willReturn(
            new AdminBillingRefundResult(
                10L,
                1L,
                29_000L,
                PaymentStatus.CANCELED,
                "tx_cancel_1",
                OffsetDateTime.parse("2026-06-03T12:00:00Z"),
                "고객 요청"));

    // when & then
    mockMvc
        .perform(
            post("/api/v1/admin/billing/payments/10/refunds")
                .header("Authorization", "Bearer super-admin-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"고객 요청\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.paymentId").value(10))
        .andExpect(jsonPath("$.paymentStatus").value("CANCELED"))
        .andExpect(jsonPath("$.refundAmount").value(29000))
        .andExpect(jsonPath("$.reason").value("고객 요청"));
  }

  @Test
  @DisplayName("GET /api/v1/admin/billing/customers: OPERATOR JWT → 403 Forbidden")
  void should_403반환_when_OPERATOR조회요청() throws Exception {
    // given
    givenBearerToken("operator-token", "OPERATOR");

    // when & then
    mockMvc
        .perform(
            get("/api/v1/admin/billing/customers").header("Authorization", "Bearer operator-token"))
        .andExpect(status().isForbidden());
  }

  @Test
  @DisplayName("GET /api/v1/admin/billing/customers: WORKSPACE_ADMIN JWT → 403 Forbidden")
  void should_403반환_when_WORKSPACE_ADMIN조회요청() throws Exception {
    // given
    givenBearerToken("workspace-admin-token", "WORKSPACE_ADMIN");

    // when & then
    mockMvc
        .perform(
            get("/api/v1/admin/billing/customers")
                .header("Authorization", "Bearer workspace-admin-token"))
        .andExpect(status().isForbidden());
  }

  @Test
  @DisplayName("POST /api/v1/admin/billing/payments/{paymentId}/refunds: 빈 사유 → 400 Bad Request")
  void should_400반환_when_환불사유없음() throws Exception {
    // given
    givenSuperAdminBearerToken("super-admin-token");

    // when & then
    mockMvc
        .perform(
            post("/api/v1/admin/billing/payments/10/refunds")
                .header("Authorization", "Bearer super-admin-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
  }

  private void givenSuperAdminBearerToken(String token) {
    givenBearerToken(token, "SUPER_ADMIN");
  }

  private void givenBearerToken(String token, String role) {
    Claims claims =
        Jwts.claims()
            .subject("1")
            .add("type", "access")
            .add("role", role)
            .expiration(new Date(System.currentTimeMillis() + 60_000))
            .build();
    given(jwtService.parseClaims(token)).willReturn(claims);
    given(jwtService.isTokenValid(claims)).willReturn(true);
    given(jwtService.isAccessToken(claims)).willReturn(true);
  }
}
