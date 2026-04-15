package com.init.pipelinejob.presentation;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.application.CreateDomainPackDraftCommand;
import com.init.pipelinejob.application.ReceiveDomainPackDraftCallbackCommand;
import com.init.pipelinejob.application.ReceiveDomainPackDraftCallbackResult;
import com.init.pipelinejob.application.ReceiveDomainPackDraftCallbackUseCase;
import com.init.pipelinejob.application.ReceiveIntentDraftCallbackCommand;
import com.init.pipelinejob.application.ReceiveIntentDraftCallbackResult;
import com.init.pipelinejob.application.ReceiveIntentDraftCallbackUseCase;
import com.init.pipelinejob.presentation.dto.PipelineDomainPackDraftCallbackRequest;
import com.init.pipelinejob.presentation.dto.PipelineDomainPackDraftCallbackResponse;
import com.init.pipelinejob.presentation.dto.PipelineIntentDraftCallbackRequest;
import com.init.pipelinejob.presentation.dto.PipelineIntentDraftCallbackResponse;
import com.init.shared.infrastructure.web.WebhookHeaderNames;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/pipeline-jobs")
public class PipelineIntentDraftCallbackController {

  private static final String MASKED_SECRET = "***";

  private final ReceiveDomainPackDraftCallbackUseCase domainPackDraftCallbackUseCase;
  private final ReceiveIntentDraftCallbackUseCase intentDraftCallbackUseCase;
  private final ObjectMapper objectMapper;

  public PipelineIntentDraftCallbackController(
      ReceiveDomainPackDraftCallbackUseCase domainPackDraftCallbackUseCase,
      ReceiveIntentDraftCallbackUseCase intentDraftCallbackUseCase,
      ObjectMapper objectMapper) {
    this.domainPackDraftCallbackUseCase = domainPackDraftCallbackUseCase;
    this.intentDraftCallbackUseCase = intentDraftCallbackUseCase;
    this.objectMapper = objectMapper;
  }

  @PostMapping("/{jobId}/callbacks/domain-pack-drafts")
  public ResponseEntity<PipelineDomainPackDraftCallbackResponse> receiveDomainPackDraftCallback(
      @PathVariable Long jobId,
      @RequestHeader(value = WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, required = false)
          String webhookSecret,
      @Valid @RequestBody PipelineDomainPackDraftCallbackRequest request,
      HttpServletRequest httpServletRequest) {
    ReceiveDomainPackDraftCallbackResult result =
        domainPackDraftCallbackUseCase.execute(
            new ReceiveDomainPackDraftCallbackCommand(
                jobId,
                webhookSecret,
                request.externalEventId(),
                request.packKey(),
                request.packName(),
                request.summaryJson(),
                objectMapper.valueToTree(extractHeaders(httpServletRequest)).toString(),
                objectMapper.valueToTree(request).toString()));

    HttpStatus status =
        "DUPLICATE_IGNORED".equals(result.status()) ? HttpStatus.OK : HttpStatus.CREATED;
    return ResponseEntity.status(status)
        .body(
            new PipelineDomainPackDraftCallbackResponse(
                result.status(),
                result.externalEventId(),
                result.domainPackId(),
                result.domainPackVersionId(),
                result.versionNo(),
                result.packKey(),
                result.createdPack(),
                result.sourcePipelineJobId()));
  }

  @PostMapping("/{jobId}/callbacks/intent-drafts")
  public ResponseEntity<PipelineIntentDraftCallbackResponse> receiveIntentDraftCallback(
      @PathVariable Long jobId,
      @RequestHeader(value = WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, required = false)
          String webhookSecret,
      @Valid @RequestBody PipelineIntentDraftCallbackRequest request,
      HttpServletRequest httpServletRequest) {
    ReceiveIntentDraftCallbackResult result =
        intentDraftCallbackUseCase.execute(
            new ReceiveIntentDraftCallbackCommand(
                jobId,
                webhookSecret,
                request.externalEventId(),
                request.domainPackVersionId(),
                request.intents().stream()
                    .map(
                        intent ->
                            new CreateDomainPackDraftCommand.IntentDraft(
                                intent.intentCode(),
                                intent.name(),
                                intent.description(),
                                intent.taxonomyLevel(),
                                intent.parentIntentCode(),
                                intent.sourceClusterRef(),
                                intent.entryConditionJson(),
                                intent.evidenceJson(),
                                intent.metaJson()))
                    .toList(),
                objectMapper.valueToTree(extractHeaders(httpServletRequest)).toString(),
                objectMapper.valueToTree(request).toString()));

    HttpStatus status =
        "DUPLICATE_IGNORED".equals(result.status()) ? HttpStatus.OK : HttpStatus.CREATED;
    return ResponseEntity.status(status)
        .body(
            new PipelineIntentDraftCallbackResponse(
                result.status(),
                result.externalEventId(),
                result.domainPackVersionId(),
                result.addedIntentCount(),
                result.skippedIntentCount(),
                result.totalIntentCount(),
                result.sourcePipelineJobId()));
  }

  private Map<String, String> extractHeaders(HttpServletRequest request) {
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
