package com.init.pipelinejob.presentation;

import com.init.pipelinejob.application.exception.AirflowTriggerFailedException;
import com.init.pipelinejob.application.exception.PipelineJobAlreadyRunningException;
import com.init.pipelinejob.presentation.dto.PipelineJobErrorResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackages = "com.init.pipelinejob.presentation")
public class PipelineJobExceptionHandler {

  private static final Logger log = LoggerFactory.getLogger(PipelineJobExceptionHandler.class);

  @ExceptionHandler(PipelineJobAlreadyRunningException.class)
  public ResponseEntity<PipelineJobErrorResponse> handleAlreadyRunning(
      PipelineJobAlreadyRunningException ex) {
    log.info(
        "Pipeline job already running: pipelineJobId={}, message={}",
        ex.getPipelineJobId(),
        ex.getMessage());
    return ResponseEntity.status(HttpStatus.CONFLICT)
        .body(
            new PipelineJobErrorResponse(
                ex.getCode(), ex.getMessage(), ex.getPipelineJobId(), ex.getStatus()));
  }

  @ExceptionHandler(AirflowTriggerFailedException.class)
  public ResponseEntity<PipelineJobErrorResponse> handleAirflowTriggerFailed(
      AirflowTriggerFailedException ex) {
    log.error(
        "Airflow trigger failed: pipelineJobId={}, message={}",
        ex.getPipelineJobId(),
        ex.getMessage(),
        ex);
    return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
        .body(
            new PipelineJobErrorResponse(
                ex.getCode(), ex.getMessage(), ex.getPipelineJobId(), "FAILED"));
  }
}
