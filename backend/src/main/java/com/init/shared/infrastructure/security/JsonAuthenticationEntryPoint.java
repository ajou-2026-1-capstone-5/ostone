package com.init.shared.infrastructure.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.shared.presentation.dto.ErrorResponse;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;

/**
 * Custom AuthenticationEntryPoint that returns spec-compliant JSON error responses for
 * authentication failures (e.g., missing/invalid JWT at filter level).
 */
public class JsonAuthenticationEntryPoint implements AuthenticationEntryPoint {

  private final ObjectMapper objectMapper;

  public JsonAuthenticationEntryPoint(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  @Override
  public void commence(
      HttpServletRequest request,
      HttpServletResponse response,
      AuthenticationException authException)
      throws IOException, ServletException {
    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);

    ErrorResponse errorResponse =
        new ErrorResponse("UNAUTHORIZED", "인증이 필요합니다.");
    response.getWriter().write(objectMapper.writeValueAsString(errorResponse));
  }
}
