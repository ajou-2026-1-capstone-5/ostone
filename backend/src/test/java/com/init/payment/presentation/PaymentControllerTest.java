package com.init.payment.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.fixtures.WithLongPrincipal;
import com.init.payment.application.PaymentResult;
import com.init.payment.application.PaymentService;
import com.init.payment.application.exception.PaymentAmountMismatchException;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import java.time.OffsetDateTime;
import java.util.List;
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
    value = PaymentController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@DisplayName("PaymentController")
class PaymentControllerTest {

  private static final String BASE_URL = "/api/v1/workspaces/1/payments";

  private final MockMvc mockMvc;

  @Autowired
  PaymentControllerTest(MockMvc mockMvc) {
    this.mockMvc = mockMvc;
  }

  @MockitoBean private PaymentService paymentService;

  @Test
  @DisplayName("결제 confirm 성공 시 200과 DONE 상태를 반환한다")
  @WithLongPrincipal(55L)
  void confirm_returns200() throws Exception {
    given(paymentService.confirmPayment(any())).willReturn(paymentResult("DONE"));

    mockMvc
        .perform(
            post(BASE_URL + "/confirm")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"paymentKey\":\"pay_1\",\"orderId\":\"ord_1\",\"amount\":29000}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("DONE"));
  }

  @Test
  @DisplayName("금액 불일치 시 400과 PAYMENT_AMOUNT_MISMATCH 코드를 반환한다")
  @WithLongPrincipal(55L)
  void confirm_amountMismatch_returns400() throws Exception {
    given(paymentService.confirmPayment(any()))
        .willThrow(new PaymentAmountMismatchException(29000, 10000));

    mockMvc
        .perform(
            post(BASE_URL + "/confirm")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"paymentKey\":\"pay_1\",\"orderId\":\"ord_1\",\"amount\":10000}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("PAYMENT_AMOUNT_MISMATCH"));
  }

  @Test
  @DisplayName("amount가 누락되면 400을 반환한다")
  @WithLongPrincipal(55L)
  void confirm_missingAmount_returns400() throws Exception {
    mockMvc
        .perform(
            post(BASE_URL + "/confirm")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"paymentKey\":\"pay_1\",\"orderId\":\"ord_1\"}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  @DisplayName("결제 내역 조회 시 200과 목록을 반환한다")
  @WithLongPrincipal(55L)
  void getPayments_returns200() throws Exception {
    given(paymentService.getPayments(1L, 55L)).willReturn(List.of(paymentResult("DONE")));

    mockMvc
        .perform(get(BASE_URL))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].status").value("DONE"));
  }

  @Test
  @DisplayName("결제 취소 성공 시 200을 반환한다")
  @WithLongPrincipal(55L)
  void cancel_returns200() throws Exception {
    given(paymentService.cancelPayment(any())).willReturn(paymentResult("CANCELED"));

    mockMvc
        .perform(
            post(BASE_URL + "/pay_1/cancel")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"cancelReason\":\"고객 요청\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("CANCELED"));
  }

  @Test
  @DisplayName("인증 principal이 없으면 401을 반환한다")
  void getPayments_noAuth_returns401() throws Exception {
    mockMvc.perform(get(BASE_URL)).andExpect(status().isUnauthorized());
  }

  private PaymentResult paymentResult(String status) {
    return new PaymentResult(
        7L,
        "ord_1",
        "pay_1",
        29000,
        "KRW",
        status,
        "카드",
        OffsetDateTime.parse("2026-06-01T00:00:00Z"),
        "https://receipt",
        OffsetDateTime.parse("2026-06-01T00:00:00Z"));
  }
}
