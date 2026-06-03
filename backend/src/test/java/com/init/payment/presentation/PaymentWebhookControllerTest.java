package com.init.payment.presentation;

import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.payment.application.HandleTossWebhookCommand;
import com.init.payment.application.PaymentWebhookService;
import com.init.payment.application.exception.PaymentWebhookUnauthorizedException;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.SecurityFilterAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 무인증·무CSRF: Toss 서버가 직접 발송하는 실제 조건을 미러링한다.
 *
 * <p>보안 Auto-Configuration을 제외하여 인증/CSRF 없이 컨트롤러 동작만 검증한다.
 */
@WebMvcTest(
    value = PaymentWebhookController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class),
    excludeAutoConfiguration = {
      SecurityAutoConfiguration.class,
      SecurityFilterAutoConfiguration.class
    })
@DisplayName("PaymentWebhookController")
class PaymentWebhookControllerTest {

  private static final String URL = "/api/v1/payments/webhooks/toss";

  private final MockMvc mockMvc;

  @Autowired
  PaymentWebhookControllerTest(MockMvc mockMvc) {
    this.mockMvc = mockMvc;
  }

  @MockitoBean private PaymentWebhookService paymentWebhookService;

  @Test
  @DisplayName("유효한 웹훅은 시크릿 헤더/paymentKey를 추출해 200을 반환한다")
  void receive_returns200AndExtractsFields() throws Exception {
    mockMvc
        .perform(
            post(URL)
                .header("X-Toss-Webhook-Secret", "secret-value")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"eventType\":\"PAYMENT_STATUS_CHANGED\","
                        + "\"data\":{\"paymentKey\":\"pay_1\",\"status\":\"DONE\"}}"))
        .andExpect(status().isOk());

    ArgumentCaptor<HandleTossWebhookCommand> captor =
        ArgumentCaptor.forClass(HandleTossWebhookCommand.class);
    then(paymentWebhookService).should().handle(captor.capture());
    HandleTossWebhookCommand command = captor.getValue();
    org.assertj.core.api.Assertions.assertThat(command.secretHeader()).isEqualTo("secret-value");
    org.assertj.core.api.Assertions.assertThat(command.paymentKey()).isEqualTo("pay_1");
    org.assertj.core.api.Assertions.assertThat(command.eventType())
        .isEqualTo("PAYMENT_STATUS_CHANGED");
  }

  @Test
  @DisplayName("시크릿 불일치 시 403을 반환한다 (application 계층 검증)")
  void receive_invalidSecret_returns403() throws Exception {
    doThrow(new PaymentWebhookUnauthorizedException())
        .when(paymentWebhookService)
        .handle(org.mockito.ArgumentMatchers.any());

    mockMvc
        .perform(
            post(URL)
                .header("X-Toss-Webhook-Secret", "wrong")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"data\":{\"paymentKey\":\"pay_1\",\"status\":\"DONE\"}}"))
        .andExpect(status().isForbidden());
  }

  @Test
  @DisplayName("본문이 유효한 JSON이 아니면 400을 반환한다")
  void receive_invalidJson_returns400() throws Exception {
    mockMvc
        .perform(
            post(URL)
                .header("X-Toss-Webhook-Secret", "secret-value")
                .contentType(MediaType.APPLICATION_JSON)
                .content("not-json"))
        .andExpect(status().isBadRequest());
  }
}
