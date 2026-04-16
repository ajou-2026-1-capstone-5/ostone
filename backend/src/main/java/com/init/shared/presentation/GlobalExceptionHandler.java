package com.init.shared.presentation;

import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.BusinessException;
import com.init.shared.application.exception.DuplicateException;
import com.init.shared.application.exception.InternalException;
import com.init.shared.application.exception.InvalidCredentialsException;
import com.init.shared.application.exception.InvalidTokenException;
import com.init.shared.application.exception.NotFoundException;
import com.init.shared.application.exception.UnauthorizedException;
import com.init.shared.presentation.dto.ErrorResponse;
import com.init.shared.presentation.dto.ValidationErrorResponse;
import java.util.List;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

@RestControllerAdvice
public class GlobalExceptionHandler {

  private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

  @ExceptionHandler(AuthenticationCredentialsNotFoundException.class)
  public ResponseEntity<ErrorResponse> handleAuthenticationCredentialsNotFound(
      AuthenticationCredentialsNotFoundException ex) {
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
        .body(new ErrorResponse("UNAUTHORIZED", ex.getMessage()));
  }

  @ExceptionHandler(AccessDeniedException.class)
  public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex) {
    return ResponseEntity.status(HttpStatus.FORBIDDEN)
        .body(new ErrorResponse("FORBIDDEN", ex.getMessage()));
  }

  @ExceptionHandler(InvalidCredentialsException.class)
  public ResponseEntity<ErrorResponse> handleInvalidCredentials(InvalidCredentialsException ex) {
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
        .body(new ErrorResponse(ex.getCode(), ex.getMessage()));
  }

  @ExceptionHandler(InvalidTokenException.class)
  public ResponseEntity<ErrorResponse> handleInvalidToken(InvalidTokenException ex) {
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
        .body(new ErrorResponse(ex.getCode(), ex.getMessage()));
  }

  @ExceptionHandler(UnauthorizedException.class)
  public ResponseEntity<ErrorResponse> handleUnauthorized(UnauthorizedException ex) {
    return ResponseEntity.status(HttpStatus.FORBIDDEN)
        .body(new ErrorResponse(ex.getCode(), ex.getMessage()));
  }

  @ExceptionHandler(NotFoundException.class)
  public ResponseEntity<ErrorResponse> handleNotFound(NotFoundException ex) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(new ErrorResponse(ex.getCode(), ex.getMessage()));
  }

  @ExceptionHandler(DuplicateException.class)
  public ResponseEntity<ErrorResponse> handleDuplicate(DuplicateException ex) {
    return ResponseEntity.status(HttpStatus.CONFLICT)
        .body(new ErrorResponse(ex.getCode(), ex.getMessage()));
  }

  @ExceptionHandler(BadRequestException.class)
  public ResponseEntity<ErrorResponse> handleBadRequest(BadRequestException ex) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(new ErrorResponse(ex.getCode(), ex.getMessage()));
  }

  @ExceptionHandler(InternalException.class)
  public ResponseEntity<ErrorResponse> handleInternal(InternalException ex) {
    log.error("Internal exception: {}, message={}", ex.getCode(), ex.getMessage(), ex);
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(new ErrorResponse(ex.getCode(), "Internal server error"));
  }

  @ExceptionHandler(BusinessException.class)
  public ResponseEntity<ErrorResponse> handleBusiness(BusinessException ex) {
    log.warn("Unhandled business exception: {}", ex.getCode(), ex);
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(new ErrorResponse(ex.getCode(), ex.getMessage()));
  }

  @ExceptionHandler(MaxUploadSizeExceededException.class)
  public ResponseEntity<ErrorResponse> handleMaxUploadSizeExceeded(
      MaxUploadSizeExceededException ex) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(new ErrorResponse("VALIDATION_ERROR", "파일 크기가 허용 한도를 초과했습니다."));
  }

  @ExceptionHandler(MissingServletRequestPartException.class)
  public ResponseEntity<ErrorResponse> handleMissingRequestPart(
      MissingServletRequestPartException ex) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(new ErrorResponse("VALIDATION_ERROR", "파일 파트가 누락되었습니다."));
  }

  @ExceptionHandler(MissingServletRequestParameterException.class)
  public ResponseEntity<ErrorResponse> handleMissingRequestParameter(
      MissingServletRequestParameterException ex) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(new ErrorResponse("VALIDATION_ERROR", "필수 파라미터가 누락되었습니다: " + ex.getParameterName()));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ValidationErrorResponse> handleValidation(
      MethodArgumentNotValidException ex) {
    List<String> errors =
        ex.getBindingResult().getFieldErrors().stream()
            .map(FieldError::getDefaultMessage)
            .filter(Objects::nonNull)
            .toList();
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(new ValidationErrorResponse("VALIDATION_ERROR", errors));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ErrorResponse> handleGeneric(Exception ex) {
    log.error("Unhandled exception", ex);
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(new ErrorResponse("INTERNAL_SERVER_ERROR", "서버 오류가 발생했습니다."));
  }
}
