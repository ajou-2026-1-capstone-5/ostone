package com.init.corpus.presentation;

import com.init.corpus.application.DatasetUploadCommand;
import com.init.corpus.application.DatasetUploadResult;
import com.init.corpus.application.DatasetUploadService;
import com.init.corpus.application.RawDatasetUploadCommand;
import com.init.corpus.application.RawDatasetUploadService;
import com.init.corpus.application.RawFileUploadCommand;
import com.init.corpus.application.RawFileUploadResult;
import com.init.corpus.application.RawFileUploadService;
import com.init.corpus.presentation.dto.DatasetUploadRequest;
import com.init.corpus.presentation.dto.DatasetUploadResponse;
import com.init.corpus.presentation.dto.RawDatasetUploadRequest;
import com.init.corpus.presentation.dto.RawFileUploadResponse;
import com.init.shared.application.exception.BadRequestException;
import jakarta.validation.Valid;
import java.io.IOException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/datasets")
public class DatasetController {

  private final DatasetUploadService datasetUploadService;
  private final RawDatasetUploadService rawDatasetUploadService;
  private final RawFileUploadService rawFileUploadService;

  public DatasetController(
      DatasetUploadService datasetUploadService,
      RawDatasetUploadService rawDatasetUploadService,
      RawFileUploadService rawFileUploadService) {
    this.datasetUploadService = datasetUploadService;
    this.rawDatasetUploadService = rawDatasetUploadService;
    this.rawFileUploadService = rawFileUploadService;
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

  @PostMapping(value = "/raw-file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ResponseEntity<RawFileUploadResponse> uploadRawFile(
      @PathVariable Long workspaceId,
      @RequestPart("file") MultipartFile file,
      @RequestParam("datasetKey") String datasetKey,
      @RequestParam("name") String name,
      @RequestParam("sourceType") String sourceType,
      @AuthenticationPrincipal Long userId) {

    if (file.isEmpty()) {
      throw new BadRequestException("VALIDATION_ERROR", "파일이 없거나 비어 있습니다.");
    }

    byte[] fileBytes;
    try {
      fileBytes = file.getBytes();
    } catch (IOException e) {
      throw new BadRequestException("VALIDATION_ERROR", "파일을 읽을 수 없습니다.");
    }
    RawFileUploadCommand command =
        new RawFileUploadCommand(
            workspaceId,
            datasetKey,
            name,
            sourceType,
            userId,
            fileBytes,
            file.getOriginalFilename() != null ? file.getOriginalFilename() : file.getName(),
            file.getContentType() != null ? file.getContentType() : "application/octet-stream",
            file.getSize());

    RawFileUploadResult result = rawFileUploadService.upload(command);

    return ResponseEntity.status(HttpStatus.CREATED)
        .body(
            new RawFileUploadResponse(
                result.datasetId(),
                result.datasetKey(),
                result.workspaceId(),
                result.objectKey(),
                result.originalFilename(),
                result.sizeBytes(),
                result.status(),
                result.piiRedactionStatus(),
                result.conversationCount()));
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
