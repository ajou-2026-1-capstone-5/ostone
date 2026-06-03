package com.init.corpus.presentation;

import com.init.corpus.application.CompleteRawFileUploadCommand;
import com.init.corpus.application.CompleteRawFileUploadResult;
import com.init.corpus.application.CompleteRawFileUploadService;
import com.init.corpus.application.DatasetUploadCommand;
import com.init.corpus.application.DatasetUploadResult;
import com.init.corpus.application.DatasetUploadService;
import com.init.corpus.application.InitRawFileUploadCommand;
import com.init.corpus.application.InitRawFileUploadResult;
import com.init.corpus.application.InitRawFileUploadService;
import com.init.corpus.application.RawDatasetUploadCommand;
import com.init.corpus.application.RawDatasetUploadService;
import com.init.corpus.presentation.dto.CompleteRawFileUploadResponse;
import com.init.corpus.presentation.dto.DatasetUploadRequest;
import com.init.corpus.presentation.dto.DatasetUploadResponse;
import com.init.corpus.presentation.dto.InitRawFileUploadRequest;
import com.init.corpus.presentation.dto.InitRawFileUploadResponse;
import com.init.corpus.presentation.dto.RawDatasetUploadRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
  private final InitRawFileUploadService initRawFileUploadService;
  private final CompleteRawFileUploadService completeRawFileUploadService;

  public DatasetController(
      DatasetUploadService datasetUploadService,
      RawDatasetUploadService rawDatasetUploadService,
      InitRawFileUploadService initRawFileUploadService,
      CompleteRawFileUploadService completeRawFileUploadService) {
    this.datasetUploadService = datasetUploadService;
    this.rawDatasetUploadService = rawDatasetUploadService;
    this.initRawFileUploadService = initRawFileUploadService;
    this.completeRawFileUploadService = completeRawFileUploadService;
  }

  @PostMapping
  public ResponseEntity<DatasetUploadResponse> uploadDataset(
      @PathVariable Long workspaceId,
      @Valid @RequestBody DatasetUploadRequest request,
      @AuthenticationPrincipal Long userId) {

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
    return buildDatasetUploadResponse(result);
  }

  @PostMapping("/raw")
  public ResponseEntity<DatasetUploadResponse> uploadRawDataset(
      @PathVariable Long workspaceId,
      @Valid @RequestBody RawDatasetUploadRequest request,
      @AuthenticationPrincipal Long userId) {

    List<RawDatasetUploadCommand.RawConversationInput> conversations =
        request.conversations().stream()
            .map(
                c ->
                    new RawDatasetUploadCommand.RawConversationInput(
                        c.sourceId(),
                        c.source(),
                        c.consultingCategory(),
                        c.clientGender(),
                        c.clientAge(),
                        c.consultingContent()))
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
    return buildDatasetUploadResponse(result);
  }

  @PostMapping("/uploads:init")
  public ResponseEntity<InitRawFileUploadResponse> initRawFileUpload(
      @PathVariable Long workspaceId,
      @Valid @RequestBody InitRawFileUploadRequest request,
      @AuthenticationPrincipal Long userId) {

    InitRawFileUploadCommand command =
        new InitRawFileUploadCommand(
            workspaceId,
            request.datasetKey(),
            request.name(),
            request.sourceType(),
            userId,
            request.filename(),
            request.contentType(),
            request.sizeBytes());

    InitRawFileUploadResult result = initRawFileUploadService.init(command);

    return ResponseEntity.status(HttpStatus.CREATED)
        .body(
            new InitRawFileUploadResponse(
                result.datasetId(),
                result.datasetKey(),
                result.workspaceId(),
                result.uploadUrl(),
                result.objectKey(),
                result.contentType(),
                result.expiresInSeconds(),
                result.serverSideEncryptionRequired()));
  }

  @PostMapping("/uploads/{datasetId}:complete")
  public ResponseEntity<CompleteRawFileUploadResponse> completeRawFileUpload(
      @PathVariable Long workspaceId,
      @PathVariable Long datasetId,
      @AuthenticationPrincipal Long userId) {

    CompleteRawFileUploadResult result =
        completeRawFileUploadService.complete(
            new CompleteRawFileUploadCommand(workspaceId, datasetId, userId));

    return ResponseEntity.ok(
        new CompleteRawFileUploadResponse(
            result.datasetId(),
            result.datasetKey(),
            result.workspaceId(),
            result.objectKey(),
            result.sizeBytes(),
            result.status()));
  }

  private ResponseEntity<DatasetUploadResponse> buildDatasetUploadResponse(
      DatasetUploadResult result) {
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
