package com.init.corpus.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.corpus.application.RawDatasetUploadCommand.RawConversationInput;
import com.init.corpus.application.exception.ConsultingContentParseException;
import com.init.corpus.application.exception.DatasetKeyConflictException;
import com.init.corpus.application.exception.DuplicateTurnIndexException;
import com.init.corpus.application.exception.UnauthorizedWorkspaceAccessException;
import com.init.corpus.application.exception.WorkspaceNotFoundException;
import com.init.corpus.domain.model.Conversation;
import com.init.corpus.domain.model.Dataset;
import com.init.corpus.domain.model.DatasetStatus;
import com.init.corpus.domain.model.PiiRedactionStatus;
import com.init.corpus.domain.repository.ConversationRepository;
import com.init.corpus.domain.repository.ConversationTurnRepository;
import com.init.corpus.domain.repository.DatasetRepository;
import com.init.corpus.domain.repository.WorkspaceExistenceRepository;
import com.init.corpus.domain.repository.WorkspaceMembershipRepository;
import com.init.fixtures.Fixtures;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;

@ExtendWith(MockitoExtension.class)
class RawDatasetUploadServiceTest {

  @Mock private DatasetRepository datasetRepository;
  @Mock private ConversationRepository conversationRepository;
  @Mock private ConversationTurnRepository conversationTurnRepository;
  @Mock private WorkspaceExistenceRepository workspaceExistenceRepository;
  @Mock private WorkspaceMembershipRepository workspaceMembershipRepository;
  @Mock private PlatformTransactionManager transactionManager;

  private RawDatasetUploadService service;

  @BeforeEach
  void setUp() {
    TransactionStatus txStatus = mock(TransactionStatus.class);
    // lenient: 일부 테스트는 트랜잭션에 도달하지 않으므로 불필요한 stubbing 오류 억제
    lenient().when(transactionManager.getTransaction(any())).thenReturn(txStatus);

    service =
        new RawDatasetUploadService(
            datasetRepository,
            conversationRepository,
            conversationTurnRepository,
            workspaceExistenceRepository,
            workspaceMembershipRepository,
            new ObjectMapper(),
            transactionManager);
  }

  @Test
  @DisplayName("워크스페이스 없음 → WorkspaceNotFoundException, DB write 없음")
  void should_WorkspaceNotFoundException발생_when_워크스페이스없음() {
    // given
    given(workspaceExistenceRepository.existsById(1L)).willReturn(false);

    // when & then
    assertThatThrownBy(() -> service.upload(Fixtures.rawDatasetUploadCommand(1L, 1L)))
        .isInstanceOf(WorkspaceNotFoundException.class);

    verify(datasetRepository, never()).save(any());
  }

  @Test
  @DisplayName("멤버십 없음 → UnauthorizedWorkspaceAccessException, DB write 없음")
  void should_UnauthorizedWorkspaceAccessException발생_when_멤버십없음() {
    // given
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(false);

    // when & then
    assertThatThrownBy(() -> service.upload(Fixtures.rawDatasetUploadCommand(1L, 1L)))
        .isInstanceOf(UnauthorizedWorkspaceAccessException.class);

    verify(datasetRepository, never()).save(any());
  }

  @Test
  @DisplayName("데이터셋 키 중복 (사전 검증) → DatasetKeyConflictException, DB write 없음")
  void should_DatasetKeyConflictException발생_when_데이터셋키중복사전검증() {
    // given
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "test-dataset-key"))
        .willReturn(true);

    // when & then
    assertThatThrownBy(() -> service.upload(Fixtures.rawDatasetUploadCommand(1L, 1L)))
        .isInstanceOf(DatasetKeyConflictException.class);

    verify(datasetRepository, never()).save(any());
  }

  @Test
  @DisplayName("파싱 실패 시 DB write 없음 → ConsultingContentParseException")
  void should_ConsultingContentParseException발생_when_파싱실패() {
    // given
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(any(), any())).willReturn(false);

    RawDatasetUploadCommand command =
        new RawDatasetUploadCommand(
            1L,
            "test-key",
            "Test",
            "csv",
            1L,
            List.of(
                new RawConversationInput(
                    "id-1", null, null, null, null, Fixtures.invalidPrefixConsultingContent())));

    // when & then
    assertThatThrownBy(() -> service.upload(command))
        .isInstanceOf(ConsultingContentParseException.class);

    verify(datasetRepository, never()).save(any());
  }

  @Test
  @DisplayName("정상 업로드 → DatasetUploadResult 반환, conversation/turn 저장 확인")
  void should_DatasetUploadResult반환_when_정상업로드() {
    // given
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "test-dataset-key"))
        .willReturn(false);

    Dataset savedDataset = mock(Dataset.class);
    given(savedDataset.getId()).willReturn(1L);
    given(savedDataset.getDatasetKey()).willReturn("test-dataset-key");
    given(savedDataset.getStatus()).willReturn(DatasetStatus.READY);
    given(savedDataset.getPiiRedactionStatus()).willReturn(PiiRedactionStatus.PENDING);
    given(datasetRepository.save(any())).willReturn(savedDataset);

    Conversation savedConversation = mock(Conversation.class);
    given(savedConversation.getId()).willReturn(100L);
    given(conversationRepository.save(any())).willReturn(savedConversation);

    // when
    DatasetUploadResult result = service.upload(Fixtures.rawDatasetUploadCommand(1L, 1L));

    // then
    assertThat(result.datasetId()).isEqualTo(1L);
    assertThat(result.datasetKey()).isEqualTo("test-dataset-key");
    assertThat(result.conversationCount()).isEqualTo(1);
    verify(conversationRepository).save(any());
    verify(conversationTurnRepository).saveAll(anyList());
  }

  @Test
  @DisplayName("Dataset 저장 시 DataIntegrityViolationException → DatasetKeyConflictException")
  void should_DatasetKeyConflictException발생_when_Dataset저장DataIntegrityViolation() {
    // given
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(any(), any())).willReturn(false);
    given(datasetRepository.save(any()))
        .willThrow(new DataIntegrityViolationException("duplicate key"));

    // when & then
    assertThatThrownBy(() -> service.upload(Fixtures.rawDatasetUploadCommand(1L, 1L)))
        .isInstanceOf(DatasetKeyConflictException.class);
  }

  @Test
  @DisplayName("conversationRepository.save() 실패 시 dataset/conversation 보상 삭제 실행")
  void should_보상삭제실행_when_conversationSave실패() {
    // given
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(any(), any())).willReturn(false);

    Dataset savedDataset = mock(Dataset.class);
    given(savedDataset.getId()).willReturn(1L);
    given(datasetRepository.save(any())).willReturn(savedDataset);

    given(conversationRepository.save(any())).willThrow(new RuntimeException("flush failed"));

    // when & then
    assertThatThrownBy(() -> service.upload(Fixtures.rawDatasetUploadCommand(1L, 1L)))
        .isInstanceOf(RuntimeException.class)
        .hasMessage("flush failed");

    verify(conversationRepository).deleteAllByDatasetId(1L);
    verify(datasetRepository).deleteById(1L);
  }

  @Test
  @DisplayName(
      "conversationTurnRepository.saveAll() DataIntegrityViolationException → DuplicateTurnIndexException, 보상 삭제 실행")
  void should_DuplicateTurnIndexException발생_when_saveAllDataIntegrityViolation() {
    // given
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(any(), any())).willReturn(false);

    Dataset savedDataset = mock(Dataset.class);
    given(savedDataset.getId()).willReturn(1L);
    given(datasetRepository.save(any())).willReturn(savedDataset);

    Conversation savedConversation = mock(Conversation.class);
    given(savedConversation.getId()).willReturn(100L);
    given(conversationRepository.save(any())).willReturn(savedConversation);

    ConstraintViolationException constraintEx =
        new ConstraintViolationException("duplicate", new SQLException(), "uq_turn_index");
    given(conversationTurnRepository.saveAll(anyList()))
        .willThrow(new DataIntegrityViolationException("duplicate key: turn_index", constraintEx));

    // when & then
    assertThatThrownBy(() -> service.upload(Fixtures.rawDatasetUploadCommand(1L, 1L)))
        .isInstanceOf(DuplicateTurnIndexException.class);

    verify(conversationRepository).deleteAllByDatasetId(1L);
    verify(datasetRepository).deleteById(1L);
  }

  @Test
  @DisplayName(
      "conversationTurnRepository.saveAll() 비turn_index 제약 위반 → DataIntegrityViolationException 전파, 보상 삭제 실행")
  void should_DataIntegrityViolationException전파_when_saveAll비turnIndex제약위반() {
    // given
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(any(), any())).willReturn(false);

    Dataset savedDataset = mock(Dataset.class);
    given(savedDataset.getId()).willReturn(1L);
    given(datasetRepository.save(any())).willReturn(savedDataset);

    Conversation savedConversation = mock(Conversation.class);
    given(savedConversation.getId()).willReturn(100L);
    given(conversationRepository.save(any())).willReturn(savedConversation);

    ConstraintViolationException constraintEx =
        new ConstraintViolationException("duplicate", new SQLException(), "uq_other_constraint");
    given(conversationTurnRepository.saveAll(anyList()))
        .willThrow(new DataIntegrityViolationException("duplicate key: other", constraintEx));

    // when & then
    assertThatThrownBy(() -> service.upload(Fixtures.rawDatasetUploadCommand(1L, 1L)))
        .isInstanceOf(DataIntegrityViolationException.class);

    verify(conversationRepository).deleteAllByDatasetId(1L);
    verify(datasetRepository).deleteById(1L);
  }

  /**
   * Assumption adopted from Recommended Default (NI-3, Option A): Mockito 기반으로
   * conversationRepository.save() 호출 횟수를 1000번 검증.
   */
  @Test
  @DisplayName("1000건 업로드 시 conversationRepository.save() 1000회 호출 [Assumption: NI-3 Default A]")
  void should_1000회저장호출_when_1000건업로드() {
    // given
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(any(), any())).willReturn(false);

    Dataset savedDataset = mock(Dataset.class);
    given(savedDataset.getId()).willReturn(1L);
    given(savedDataset.getDatasetKey()).willReturn("batch-key");
    given(savedDataset.getStatus()).willReturn(DatasetStatus.READY);
    given(savedDataset.getPiiRedactionStatus()).willReturn(PiiRedactionStatus.PENDING);
    given(datasetRepository.save(any())).willReturn(savedDataset);

    Conversation savedConversation = mock(Conversation.class);
    given(savedConversation.getId()).willReturn(100L);
    given(conversationRepository.save(any())).willReturn(savedConversation);

    List<RawConversationInput> conversations = new ArrayList<>(1000);
    for (int i = 0; i < 1000; i++) {
      conversations.add(
          new RawConversationInput(
              "case-" + i, null, null, null, null, Fixtures.validConsultingContent()));
    }
    RawDatasetUploadCommand command =
        new RawDatasetUploadCommand(1L, "batch-key", "Batch Dataset", "csv", 1L, conversations);

    // when
    service.upload(command);

    // then
    verify(conversationRepository, times(1000)).save(any());
  }
}
