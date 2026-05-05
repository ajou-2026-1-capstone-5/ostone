package com.init.pipelinejob.presentation;

import com.init.pipelinejob.application.exception.AirflowTriggerFailedException;
import com.init.pipelinejob.application.exception.PipelineJobAlreadyRunningException;
import com.init.pipelinejob.presentation.dto.PipelineJobErrorResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackages = "com.init.pipelinejob.presentation")
public class PipelineJobExceptionHandler {

  @ExceptionHandler(PipelineJobAlreadyRunningException.class)
  public ResponseEntity<PipelineJobErrorResponse> handleAlreadyRunning(
      PipelineJobAlreadyRunningException ex) {
    return ResponseEntity.status(HttpStatus.CONFLICT)
        .body(
            new PipelineJobErrorResponse(
                ex.getCode(), ex.getMessage(), ex.getPipelineJobId(), ex.getStatus()));
  }

  @ExceptionHandler(AirflowTriggerFailedException.class)
  public ResponseEntity<PipelineJobErrorResponse> handleAirflowTriggerFailed(
      AirflowTriggerFailedException ex) {
    return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
        .body(
            new PipelineJobErrorResponse(
                ex.getCode(), ex.getMessage(), ex.getPipelineJobId(), "FAILED"));
  }
}
