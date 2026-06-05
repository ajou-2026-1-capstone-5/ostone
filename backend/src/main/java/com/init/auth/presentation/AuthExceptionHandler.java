package com.init.auth.presentation;

import com.init.auth.application.exception.PasswordResetRequiredException;
import com.init.shared.presentation.dto.ErrorResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackages = "com.init.auth.presentation")
public class AuthExceptionHandler {

  @ExceptionHandler(PasswordResetRequiredException.class)
  public ResponseEntity<ErrorResponse> handlePasswordResetRequired(
      PasswordResetRequiredException ex) {
    return ResponseEntity.status(HttpStatus.FORBIDDEN)
        .body(new ErrorResponse(ex.getCode(), ex.getMessage()));
  }
}
