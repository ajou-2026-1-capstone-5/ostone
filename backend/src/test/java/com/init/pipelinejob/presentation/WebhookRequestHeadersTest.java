package com.init.pipelinejob.presentation;

import static org.assertj.core.api.Assertions.assertThat;

import com.init.shared.infrastructure.web.WebhookHeaderNames;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

@DisplayName("WebhookRequestHeaders")
class WebhookRequestHeadersTest {

  @Test
  @DisplayName("민감한 webhook request header 값을 마스킹한다")
  void extractMasked_sensitiveHeaders_masksValues() {
    MockHttpServletRequest request = new MockHttpServletRequest();
    request.addHeader(WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, "secret-123");
    request.addHeader("authorization", "Bearer token");
    request.addHeader("Cookie", "sid=abc");
    request.addHeader("Set-Cookie", "sid=def");
    request.addHeader("X-API-Key", "api-key");
    request.addHeader("X-Trace-Id", "trace-1");

    Map<String, String> headers = WebhookRequestHeaders.extractMasked(request);

    assertThat(headers)
        .containsEntry(WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, "***")
        .containsEntry("authorization", "***")
        .containsEntry("Cookie", "***")
        .containsEntry("Set-Cookie", "***")
        .containsEntry("X-API-Key", "***")
        .containsEntry("X-Trace-Id", "trace-1");
  }
}
