package com.init.pipelinejob.presentation;

import com.init.shared.infrastructure.web.WebhookHeaderNames;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

final class WebhookRequestHeaders {

  private static final String MASKED_SECRET = "***";

  private WebhookRequestHeaders() {}

  static Map<String, String> extractMasked(HttpServletRequest request) {
    Map<String, String> headers = new LinkedHashMap<>();
    for (String headerName : Collections.list(request.getHeaderNames())) {
      if (WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET.equalsIgnoreCase(headerName)) {
        headers.put(headerName, MASKED_SECRET);
        continue;
      }
      headers.put(headerName, request.getHeader(headerName));
    }
    return headers;
  }
}
