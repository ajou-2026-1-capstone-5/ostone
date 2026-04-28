package com.init.pipelinejob.presentation;

import com.init.shared.infrastructure.web.WebhookHeaderNames;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

final class WebhookRequestHeaders {

  private static final String MASKED_SECRET = "***";
  private static final Set<String> SENSITIVE_HEADERS =
      Set.of(
          WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET.toLowerCase(Locale.ROOT),
          "authorization",
          "cookie",
          "set-cookie",
          "x-api-key",
          "x-auth-token");

  private WebhookRequestHeaders() {}

  static Map<String, String> extractMasked(HttpServletRequest request) {
    Map<String, String> headers = new LinkedHashMap<>();
    for (String headerName : Collections.list(request.getHeaderNames())) {
      if (isSensitiveHeader(headerName)) {
        headers.put(headerName, MASKED_SECRET);
        continue;
      }
      headers.put(headerName, request.getHeader(headerName));
    }
    return headers;
  }

  private static boolean isSensitiveHeader(String headerName) {
    return headerName != null && SENSITIVE_HEADERS.contains(headerName.toLowerCase(Locale.ROOT));
  }
}
