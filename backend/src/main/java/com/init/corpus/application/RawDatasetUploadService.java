package com.init.corpus.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.corpus.application.DatasetUploadCommand.TurnData;
import com.init.corpus.application.RawDatasetUploadCommand.RawConversationInput;
import com.init.corpus.application.exception.DatasetKeyConflictException;
import com.init.corpus.application.exception.DuplicateTurnIndexException;
import com.init.corpus.application.exception.UnauthorizedWorkspaceAccessException;
import com.init.corpus.application.exception.WorkspaceNotFoundException;
import com.init.corpus.domain.model.Conversation;
import com.init.corpus.domain.model.ConversationTurn;
import com.init.corpus.domain.model.Dataset;
import com.init.corpus.domain.repository.ConversationRepository;
import com.init.corpus.domain.repository.ConversationTurnRepository;
import com.init.corpus.domain.repository.DatasetRepository;
import com.init.corpus.domain.repository.WorkspaceExistenceRepository;
import com.init.corpus.domain.repository.WorkspaceMembershipRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import org.hibernate.exception.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class RawDatasetUploadService {

  private static final Logger log = LoggerFactory.getLogger(RawDatasetUploadService.class);
  private static final int BATCH_SIZE = 500;

  private final DatasetRepository datasetRepository;
  private final ConversationRepository conversationRepository;
  private final ConversationTurnRepository conversationTurnRepository;
  private final WorkspaceExistenceRepository workspaceExistenceRepository;
  private final WorkspaceMembershipRepository workspaceMembershipRepository;
  private final ObjectMapper objectMapper;
  private final TransactionTemplate transactionTemplate;

  public RawDatasetUploadService(
      DatasetRepository datasetRepository,
      ConversationRepository conversationRepository,
      ConversationTurnRepository conversationTurnRepository,
      WorkspaceExistenceRepository workspaceExistenceRepository,
      WorkspaceMembershipRepository workspaceMembershipRepository,
      ObjectMapper objectMapper,
      PlatformTransactionManager transactionManager) {
    this.datasetRepository = datasetRepository;
    this.conversationRepository = conversationRepository;
    this.conversationTurnRepository = conversationTurnRepository;
    this.workspaceExistenceRepository = workspaceExistenceRepository;
    this.workspaceMembershipRepository = workspaceMembershipRepository;
    this.objectMapper = objectMapper;
    this.transactionTemplate = new TransactionTemplate(transactionManager);
  }

  public DatasetUploadResult upload(RawDatasetUploadCommand command) {
    if (!workspaceExistenceRepository.existsById(command.workspaceId())) {
      throw new WorkspaceNotFoundException("워크스페이스를 찾을 수 없습니다. id=" + command.workspaceId());
    }
    if (!workspaceMembershipRepository.existsByWorkspaceIdAndUserId(
        command.workspaceId(), command.createdBy())) {
      throw new UnauthorizedWorkspaceAccessException(
          "워크스페이스에 접근 권한이 없습니다. workspaceId=" + command.workspaceId());
    }
    if (datasetRepository.existsByWorkspaceIdAndDatasetKey(
        command.workspaceId(), command.datasetKey())) {
      throw new DatasetKeyConflictException("이미 사용 중인 데이터셋 키입니다: " + command.datasetKey());
    }

    // 1. Parse all conversations upfront — any ConsultingContentParseException
    //    propagates here before any DB write occurs.
    List<ParsedConversation> allParsed = new ArrayList<>(command.conversations().size());
    for (RawConversationInput input : command.conversations()) {
      List<TurnData> turns = ConsultingContentParser.parse(input.consultingContent());
      allParsed.add(new ParsedConversation(input, turns));
    }

    // 2. Persist the Dataset in its own transaction.
    Dataset savedDataset;
    try {
      savedDataset =
          Objects.requireNonNull(
              transactionTemplate.execute(
                  status -> {
                    Dataset dataset =
                        Dataset.create(
                            command.workspaceId(),
                            command.datasetKey(),
                            command.name(),
                            command.sourceType(),
                            command.createdBy());
                    dataset.updateMetaJson(buildDatasetMetaJson(command.conversations()));
                    return datasetRepository.save(dataset);
                  }));
    } catch (DataIntegrityViolationException e) {
      throw new DatasetKeyConflictException("이미 사용 중인 데이터셋 키입니다: " + command.datasetKey());
    }

    // 3. Flush parsed conversations in batches. On any failure, compensate by
    //    removing already-persisted conversations and the Dataset itself.
    Long datasetId = savedDataset.getId();
    try {
      List<ParsedConversation> batch = new ArrayList<>(BATCH_SIZE);
      for (ParsedConversation pc : allParsed) {
        batch.add(pc);
        if (batch.size() >= BATCH_SIZE) {
          flushBatch(datasetId, batch);
          batch.clear();
        }
      }
      if (!batch.isEmpty()) {
        flushBatch(datasetId, batch);
      }
    } catch (RuntimeException e) {
      try {
        transactionTemplate.executeWithoutResult(
            status -> {
              conversationRepository.deleteAllByDatasetId(datasetId);
              datasetRepository.deleteById(datasetId);
            });
      } catch (Exception compensationEx) {
        log.warn(
            "[upload] Compensation failed for datasetId={}: {}",
            datasetId,
            compensationEx.getMessage(),
            compensationEx);
      }
      throw e;
    }

    return new DatasetUploadResult(
        savedDataset.getId(),
        savedDataset.getDatasetKey(),
        command.workspaceId(),
        savedDataset.getStatus(),
        savedDataset.getPiiRedactionStatus(),
        command.conversations().size());
  }

  private void flushBatch(Long datasetId, List<ParsedConversation> batch) {
    transactionTemplate.executeWithoutResult(
        status -> {
          for (ParsedConversation pc : batch) {
            saveConversationWithTurns(datasetId, pc);
          }
        });
  }

  private void saveConversationWithTurns(Long datasetId, ParsedConversation pc) {
    List<TurnData> turns = pc.turns();
    RawConversationInput input = pc.input();

    String customerText =
        turns.stream()
            .filter(t -> "CUSTOMER".equalsIgnoreCase(t.speakerRole()))
            .map(TurnData::messageText)
            .collect(Collectors.joining("\n"));
    String resolvedCustomerText = customerText.isEmpty() ? null : customerText;

    String fullText = turns.stream().map(TurnData::messageText).collect(Collectors.joining("\n"));

    Conversation conversation =
        Conversation.create(
            datasetId,
            input.sourceId(), // D-10: source_id → externalCaseId
            null, // D-7: channel = null (원본 데이터에 없음)
            "ko", // D-3: languageCode 기본값 "ko"
            null, // D-5: consulting_date "" → startedAt = null
            null, // D-5: consulting_date "" → endedAt = null
            resolvedCustomerText,
            fullText,
            turns.size());
    // D-8: consulting_category, client_gender, client_age → conversation.meta_json
    conversation.updateMetaJson(
        buildConversationMetaJson(
            input.consultingCategory(), input.clientGender(), input.clientAge()));
    conversation = conversationRepository.save(conversation);

    List<ConversationTurn> turnEntities = new ArrayList<>(turns.size());
    for (TurnData turnData : turns) {
      turnEntities.add(
          ConversationTurn.create(
              conversation.getId(),
              turnData.turnIndex(),
              turnData.speakerRole(),
              turnData.messageText(),
              null)); // D-7: eventTime = null (원본 데이터에 없음)
    }
    try {
      conversationTurnRepository.saveAll(turnEntities);
    } catch (DataIntegrityViolationException e) {
      if (e.getCause() instanceof ConstraintViolationException constraintEx) {
        String constraintName = constraintEx.getConstraintName();
        if (constraintName != null && constraintName.contains("turn_index")) {
          throw new DuplicateTurnIndexException(
              "중복된 턴 인덱스가 감지되었습니다: conversationId=" + conversation.getId());
        }
      }
      throw e;
    }
  }

  private String buildDatasetMetaJson(List<RawConversationInput> conversations) {
    List<String> distinctSources =
        conversations.stream()
            .map(RawConversationInput::source)
            .filter(s -> s != null && !s.isBlank())
            .distinct()
            .collect(Collectors.toList());

    ObjectNode node = objectMapper.createObjectNode();
    if (distinctSources.size() == 1) {
      node.put("source", distinctSources.get(0));
    } else if (distinctSources.size() > 1) {
      var sourceArray = node.putArray("source");
      distinctSources.forEach(sourceArray::add);
    }
    try {
      return objectMapper.writeValueAsString(node);
    } catch (JsonProcessingException e) {
      log.warn(
          "[buildDatasetMetaJson] Failed to serialize dataset meta JSON: {}", e.getMessage(), e);
      throw new IllegalStateException("Failed to serialize dataset meta JSON", e);
    }
  }

  private String buildConversationMetaJson(
      String consultingCategory, String clientGender, String clientAge) {
    ObjectNode node = objectMapper.createObjectNode();
    if (consultingCategory != null && !consultingCategory.isBlank()) {
      node.put("category", consultingCategory);
    }
    if (clientGender != null && !clientGender.isBlank()) {
      node.put("clientGender", clientGender);
    }
    if (clientAge != null && !clientAge.isBlank()) {
      node.put("clientAge", clientAge);
    }
    try {
      return objectMapper.writeValueAsString(node);
    } catch (JsonProcessingException e) {
      log.warn(
          "[buildConversationMetaJson] Failed to serialize conversation meta JSON: {}",
          e.getMessage(),
          e);
      throw new IllegalStateException("Failed to serialize conversation meta JSON", e);
    }
  }

  private record ParsedConversation(RawConversationInput input, List<TurnData> turns) {}
}
