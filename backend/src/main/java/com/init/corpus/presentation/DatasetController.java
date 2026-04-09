package com.init.corpus.presentation;

import com.init.corpus.application.DatasetUploadCommand;
import com.init.corpus.application.DatasetUploadResult;
import com.init.corpus.application.DatasetUploadService;
import com.init.corpus.application.RawDatasetUploadCommand;
import com.init.corpus.application.RawDatasetUploadService;
import com.init.corpus.presentation.dto.DatasetUploadRequest;
import com.init.corpus.presentation.dto.DatasetUploadResponse;
import com.init.corpus.presentation.dto.RawDatasetUploadRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/datasets")
public class DatasetController {

  private final DatasetUploadService datasetUploadService;
  private final RawDatasetUploadService rawDatasetUploadService;

  public DatasetController(
      DatasetUploadService datasetUploadService, RawDatasetUploadService rawDatasetUploadService) {
    this.datasetUploadService = datasetUploadService;
    this.rawDatasetUploadService = rawDatasetUploadService;
  }

  @PostMapping
  public ResponseEntity<DatasetUploadResponse> uploadDataset(
      @PathVariable Long workspaceId,
      @Valid @RequestBody DatasetUploadRequest request,
      Authentication authentication) {
    Long userId = (Long) authentication.getPrincipal();

    List<DatasetUploadCommand.ConversationData> conversations =
        request.conversations().stream()
            .map(
                c ->
                    new DatasetUploadCommand.ConversationData(
                        c.externalCaseId(),
                        c.channel(),
                        c.languageCode(),
                        c.startedAt(),
                        c.endedAt(),
                        c.turns().stream()
                            .map(
                                t ->
                                    new DatasetUploadCommand.TurnData(
                                        t.turnIndex(),
                                        t.speakerRole(),
                                        t.messageText(),
                                        t.eventTime()))
                            .toList()))
            .toList();

    DatasetUploadCommand command =
        new DatasetUploadCommand(
            workspaceId,
            request.datasetKey(),
            request.name(),
            request.sourceType(),
            userId,
            conversations);

    DatasetUploadResult result = datasetUploadService.upload(command);
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(
            new DatasetUploadResponse(
                result.datasetId(),
                result.datasetKey(),
                result.workspaceId(),
                result.status(),
                result.piiRedactionStatus(),
                result.conversationCount()));
  }

  @PostMapping("/raw")
  public ResponseEntity<DatasetUploadResponse> uploadRawDataset(
      @PathVariable Long workspaceId,
      @Valid @RequestBody RawDatasetUploadRequest request,
      Authentication authentication) {
    Long userId = (Long) authentication.getPrincipal();

    List<RawDatasetUploadCommand.RawConversationInput> conversations =
        request.conversations().stream()
            .map(
                c ->
                    new RawDatasetUploadCommand.RawConversationInput(
                        c.source_id(),
                        c.source(),
                        c.consulting_category(),
                        c.client_gender(),
                        c.client_age(),
                        c.consulting_content()))
            .toList();

    RawDatasetUploadCommand command =
        new RawDatasetUploadCommand(
            workspaceId,
            request.datasetKey(),
            request.name(),
            request.sourceType(),
            userId,
            conversations);

    DatasetUploadResult result = rawDatasetUploadService.upload(command);
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(
            new DatasetUploadResponse(
                result.datasetId(),
                result.datasetKey(),
                result.workspaceId(),
                result.status(),
                result.piiRedactionStatus(),
                result.conversationCount()));
  }
}
