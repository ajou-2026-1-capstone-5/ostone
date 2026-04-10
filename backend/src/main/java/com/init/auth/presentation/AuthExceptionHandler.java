package com.init.auth.presentation;

import com.init.auth.application.exception.PasswordResetRequiredException;
import com.init.auth.presentation.dto.PasswordResetRequiredResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackages = "com.init.auth.presentation")
public class AuthExceptionHandler {

  @ExceptionHandler(PasswordResetRequiredException.class)
  public ResponseEntity<PasswordResetRequiredResponse> handlePasswordResetRequired(
      PasswordResetRequiredException ex) {
    return ResponseEntity.status(HttpStatus.FORBIDDEN)
        .body(new PasswordResetRequiredResponse(ex.getCode(), ex.getMessage(), ex.getResetToken()));
  }
}
