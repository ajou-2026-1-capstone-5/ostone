package com.init.shared.presentation;

import static org.assertj.core.api.Assertions.assertThat;

import com.init.shared.application.exception.BadGatewayException;
import com.init.shared.presentation.dto.ErrorResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

@DisplayName("GlobalExceptionHandler")
class GlobalExceptionHandlerTest {

  private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

  @Test
  @DisplayName("BadGatewayException 응답에는 내부 메시지를 노출하지 않는다")
  void handleBadGatewayReturnsSafeMessage() {
    BadGatewayException exception =
        new BadGatewayException("UPSTREAM_FAILED", "http://airflow-apiserver:8080 failed");

    ResponseEntity<ErrorResponse> response = handler.handleBadGateway(exception);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
    assertThat(response.getBody())
        .isEqualTo(new ErrorResponse("UPSTREAM_FAILED", "Upstream service error"));
  }
}
