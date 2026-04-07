package com.init.corpus.application;

import com.init.corpus.application.DatasetUploadCommand.ConversationData;
import com.init.corpus.application.DatasetUploadCommand.TurnData;
import com.init.corpus.application.exception.DatasetKeyConflictException;
import com.init.corpus.application.exception.WorkspaceNotFoundException;
import com.init.corpus.domain.model.Conversation;
import com.init.corpus.domain.model.ConversationTurn;
import com.init.corpus.domain.model.Dataset;
import com.init.corpus.domain.repository.ConversationRepository;
import com.init.corpus.domain.repository.ConversationTurnRepository;
import com.init.corpus.domain.repository.DatasetRepository;
import com.init.corpus.domain.repository.WorkspaceExistenceRepository;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class DatasetUploadService {

  private final DatasetRepository datasetRepository;
  private final ConversationRepository conversationRepository;
  private final ConversationTurnRepository conversationTurnRepository;
  private final WorkspaceExistenceRepository workspaceExistenceRepository;

  public DatasetUploadService(
      DatasetRepository datasetRepository,
      ConversationRepository conversationRepository,
      ConversationTurnRepository conversationTurnRepository,
      WorkspaceExistenceRepository workspaceExistenceRepository) {
    this.datasetRepository = datasetRepository;
    this.conversationRepository = conversationRepository;
    this.conversationTurnRepository = conversationTurnRepository;
    this.workspaceExistenceRepository = workspaceExistenceRepository;
  }

  public DatasetUploadResult upload(DatasetUploadCommand command) {
    if (!workspaceExistenceRepository.existsById(command.workspaceId())) {
      throw new WorkspaceNotFoundException("워크스페이스를 찾을 수 없습니다. id=" + command.workspaceId());
    }
    if (datasetRepository.existsByWorkspaceIdAndDatasetKey(
        command.workspaceId(), command.datasetKey())) {
      throw new DatasetKeyConflictException("이미 사용 중인 데이터셋 키입니다: " + command.datasetKey());
    }

    Dataset dataset =
        Dataset.create(
            command.workspaceId(),
            command.datasetKey(),
            command.name(),
            command.sourceType(),
            command.createdBy());
    dataset = datasetRepository.save(dataset);

    for (ConversationData convData : command.conversations()) {
      saveConversationWithTurns(dataset.getId(), convData);
    }

    return new DatasetUploadResult(
        dataset.getId(),
        dataset.getDatasetKey(),
        command.workspaceId(),
        command.conversations().size());
  }

  private void saveConversationWithTurns(Long datasetId, ConversationData convData) {
    List<TurnData> turns = convData.turns();

    String rawCustomerText =
        turns.stream()
            .filter(t -> "CUSTOMER".equalsIgnoreCase(t.speakerRole()))
            .map(TurnData::messageText)
            .collect(Collectors.joining("\n"));
    String customerText = rawCustomerText.isEmpty() ? null : rawCustomerText;

    String fullText = turns.stream().map(TurnData::messageText).collect(Collectors.joining("\n"));

    Conversation conversation =
        Conversation.create(
            datasetId,
            convData.externalCaseId(),
            convData.channel(),
            convData.languageCode(),
            convData.startedAt(),
            convData.endedAt(),
            customerText,
            fullText,
            turns.size());
    conversation = conversationRepository.save(conversation);

    for (TurnData turnData : turns) {
      ConversationTurn turn =
          ConversationTurn.create(
              conversation.getId(),
              turnData.turnIndex(),
              turnData.speakerRole(),
              turnData.messageText(),
              turnData.eventTime());
      conversationTurnRepository.save(turn);
    }
  }
}
