package com.init.corpus.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.corpus.application.DatasetUploadCommand.ConversationData;
import com.init.corpus.application.DatasetUploadCommand.TurnData;
import com.init.corpus.application.exception.DatasetKeyConflictException;
import com.init.corpus.application.exception.DuplicateTurnIndexException;
import com.init.corpus.application.exception.UnauthorizedWorkspaceAccessException;
import com.init.corpus.application.exception.WorkspaceNotFoundException;
import com.init.corpus.domain.model.Conversation;
import com.init.corpus.domain.model.Dataset;
import com.init.corpus.domain.repository.ConversationRepository;
import com.init.corpus.domain.repository.ConversationTurnRepository;
import com.init.corpus.domain.repository.DatasetRepository;
import com.init.corpus.domain.repository.WorkspaceExistenceRepository;
import com.init.corpus.domain.repository.WorkspaceMembershipRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("DatasetUploadService")
class DatasetUploadServiceTest {

  @Mock private DatasetRepository datasetRepository;
  @Mock private ConversationRepository conversationRepository;
  @Mock private ConversationTurnRepository conversationTurnRepository;
  @Mock private WorkspaceExistenceRepository workspaceExistenceRepository;
  @Mock private WorkspaceMembershipRepository workspaceMembershipRepository;

  private DatasetUploadService service;

  @BeforeEach
  void setUp() {
    service =
        new DatasetUploadService(
            datasetRepository,
            conversationRepository,
            conversationTurnRepository,
            workspaceExistenceRepository,
            workspaceMembershipRepository);
  }

  @Test
  @DisplayName("워크스페이스 없음 → WorkspaceNotFoundException, DB write 없음")
  void should_WorkspaceNotFoundException발생_when_워크스페이스없음() {
    // given
    given(workspaceExistenceRepository.existsById(1L)).willReturn(false);

    // when & then
    assertThatThrownBy(() -> service.upload(buildCommand(1L, 1L)))
        .isInstanceOf(WorkspaceNotFoundException.class);

    verify(datasetRepository, never()).save(any());
  }

  @Test
  @DisplayName("멤버십 없음 → UnauthorizedWorkspaceAccessException, DB write 없음")
  void should_UnauthorizedWorkspaceAccessException발생_when_멤버십없음() {
    // given
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 99L)).willReturn(false);

    // when & then
    assertThatThrownBy(() -> service.upload(buildCommand(1L, 99L)))
        .isInstanceOf(UnauthorizedWorkspaceAccessException.class);

    verify(datasetRepository, never()).save(any());
  }

  @Test
  @DisplayName("데이터셋 키 중복 → DatasetKeyConflictException, DB write 없음")
  void should_DatasetKeyConflictException발생_when_키중복() {
    // given
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "test-key")).willReturn(true);

    // when & then
    assertThatThrownBy(() -> service.upload(buildCommand(1L, 1L)))
        .isInstanceOf(DatasetKeyConflictException.class);

    verify(datasetRepository, never()).save(any());
  }

  @Test
  @DisplayName("정상 업로드 → DatasetUploadResult 반환")
  void should_DatasetUploadResult반환_when_정상업로드() {
    // given
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "test-key")).willReturn(false);

    Dataset savedDataset = Dataset.create(1L, "test-key", "Test", "csv", 1L);
    ReflectionTestUtils.setField(savedDataset, "id", 100L);
    given(datasetRepository.save(any())).willReturn(savedDataset);

    Conversation savedConv =
        Conversation.create(100L, "case-001", "CRM", null, null, null, null, "안녕하세요", 1);
    ReflectionTestUtils.setField(savedConv, "id", 200L);
    given(conversationRepository.save(any())).willReturn(savedConv);

    // when
    DatasetUploadResult result = service.upload(buildCommand(1L, 1L));

    // then
    assertThat(result).isNotNull();
    assertThat(result.datasetId()).isEqualTo(100L);
    assertThat(result.conversationCount()).isEqualTo(1);
  }

  @Test
  @DisplayName("중복 turnIndex → DuplicateTurnIndexException")
  void should_DuplicateTurnIndexException발생_when_중복turnIndex() {
    // given
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "test-key")).willReturn(false);

    Dataset savedDataset = Dataset.create(1L, "test-key", "Test", "csv", 1L);
    ReflectionTestUtils.setField(savedDataset, "id", 100L);
    given(datasetRepository.save(any())).willReturn(savedDataset);

    List<TurnData> duplicateTurns =
        List.of(
            new TurnData(0, "AGENT", "Hello", null), new TurnData(0, "CUSTOMER", "Hi", null));
    DatasetUploadCommand command =
        new DatasetUploadCommand(
            1L,
            "test-key",
            "Test",
            "csv",
            1L,
            List.of(new ConversationData("case-001", "CRM", null, null, null, duplicateTurns)));

    // when & then
    assertThatThrownBy(() -> service.upload(command))
        .isInstanceOf(DuplicateTurnIndexException.class);
  }

  // ── helper ──────────────────────────────────────────────────────────────────

  private DatasetUploadCommand buildCommand(Long workspaceId, Long userId) {
    List<TurnData> turns = List.of(new TurnData(0, "AGENT", "안녕하세요", null));
    return new DatasetUploadCommand(
        workspaceId,
        "test-key",
        "Test Dataset",
        "csv",
        userId,
        List.of(new ConversationData("case-001", "CRM", null, null, null, turns)));
  }
}
