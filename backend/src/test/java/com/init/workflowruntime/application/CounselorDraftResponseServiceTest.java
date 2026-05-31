package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.command.GenerateDraftResponseCommand;
import com.init.workflowruntime.application.dto.GenerateWorkflowAwareResponseResult;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.domain.WorkflowExecution;
import com.init.workflowruntime.domain.WorkflowExecutionRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("CounselorDraftResponseService")
class CounselorDraftResponseServiceTest {

  private static final String DRAFT_RESPONSE =
      "주문번호를 확인해주시면 환불 상태를 안내드리겠습니다.";
  private static final String WORKFLOW_SUMMARY =
      """
      환불 워크플로우 (REFUND_FLOW)
      환불 요청을 확인하고 필요한 정보를 수집합니다.
      Graph JSON: {"nodes":[]}""";

  @Mock private ChatSessionRepository chatSessionRepository;
  @Mock private ChatMessageRepository chatMessageRepository;
  @Mock private WorkflowExecutionRepository workflowExecutionRepository;
  @Mock private WorkflowDefinitionRepository workflowDefinitionRepository;
  @Mock private LlmAssistantService llmAssistantService;

  private CounselorDraftResponseService service;

  @BeforeEach
  void setUp() {
    service =
        new CounselorDraftResponseService(
            chatSessionRepository,
            chatMessageRepository,
            workflowExecutionRepository,
            workflowDefinitionRepository,
            llmAssistantService);
  }

  @Test
  @DisplayName("매칭 워크플로우와 최근 대화를 기반으로 상담사 초안을 생성한다")
  void should_generateDraft_when_matchedWorkflowExists() {
    // given
    ChatSession session = ChatSession.create(2L, 12L, ChatSessionStatus.ACTIVE, "WEB", "{}");
    WorkflowExecution execution = WorkflowExecution.create(1L);
    execution.assignIntentWorkflow(30L, 88L, "COLLECT_INFO");
    WorkflowDefinition workflow =
        WorkflowDefinition.create(
            12L,
            "REFUND_FLOW",
            "환불 워크플로우",
            "환불 요청을 확인하고 필요한 정보를 수집합니다.",
            "{\"nodes\":[]}",
            "COLLECT_INFO",
            "[\"END\"]",
            "[]",
            "{}",
            30L,
            true,
            "{}");
    List<ChatMessage> recentDesc =
        List.of(
            ChatMessage.create(1L, 3, "COUNSELOR", "TEXT", "확인해보겠습니다."),
            ChatMessage.create(
                1L, 2, "CUSTOMER", "TEXT", "주문을 취소했는데 환불되나요?"),
            ChatMessage.create(1L, 1, "CUSTOMER", "TEXT", "환불 문의드립니다."));

    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(workflowExecutionRepository.findTopByChatSessionIdOrderByStartedAtDescIdDesc(1L))
        .willReturn(Optional.of(execution));
    given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(88L, 12L))
        .willReturn(Optional.of(workflow));
    given(chatMessageRepository.findTop5ByChatSessionIdOrderBySeqNoDesc(1L))
        .willReturn(recentDesc);
    given(
            llmAssistantService.generateCounselorDraftResponse(
                any(), eq("COLLECT_INFO"), any(), eq("주문을 취소했는데 환불되나요?")))
        .willReturn(new GenerateWorkflowAwareResponseResult(DRAFT_RESPONSE));

    // when
    GenerateWorkflowAwareResponseResult result =
        service.generateDraft(new GenerateDraftResponseCommand(1L));

    // then
    assertThat(result.content()).isEqualTo(DRAFT_RESPONSE);
    verify(chatMessageRepository, never()).save(any());
    verify(llmAssistantService)
        .generateCounselorDraftResponse(
            eq(WORKFLOW_SUMMARY),
            eq("COLLECT_INFO"),
            eq(
                """
                CUSTOMER: 환불 문의드립니다.
                CUSTOMER: 주문을 취소했는데 환불되나요?
                COUNSELOR: 확인해보겠습니다."""),
            eq("주문을 취소했는데 환불되나요?"));
  }

  @Test
  @DisplayName("실행 이력이 없으면 도메인팩 버전의 워크플로우 후보로 초안을 생성한다")
  void should_generateDraftWithCandidateWorkflow_when_executionMissing() {
    // given
    ChatSession session = ChatSession.create(2L, 12L, ChatSessionStatus.ACTIVE, "WEB", "{}");
    WorkflowDefinition workflow =
        WorkflowDefinition.create(
            12L,
            "REFUND_FLOW",
            "환불 워크플로우",
            null,
            "{\"nodes\":[]}",
            "START",
            "[\"END\"]",
            "[]",
            "{}",
            30L,
            true,
            "{}");
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(workflowExecutionRepository.findTopByChatSessionIdOrderByStartedAtDescIdDesc(1L))
        .willReturn(Optional.empty());
    given(workflowDefinitionRepository.findAllByDomainPackVersionId(12L))
        .willReturn(List.of(workflow));
    given(chatMessageRepository.findTop5ByChatSessionIdOrderBySeqNoDesc(1L)).willReturn(List.of());
    given(llmAssistantService.generateCounselorDraftResponse(any(), eq("START"), any(), any()))
        .willReturn(new GenerateWorkflowAwareResponseResult(DRAFT_RESPONSE));

    // when
    GenerateWorkflowAwareResponseResult result =
        service.generateDraft(new GenerateDraftResponseCommand(1L));

    // then
    assertThat(result.content()).isEqualTo(DRAFT_RESPONSE);
  }

  @Test
  @DisplayName("세션이 없으면 NotFoundException을 던진다")
  void should_throwNotFound_when_sessionMissing() {
    given(chatSessionRepository.findById(999L)).willReturn(Optional.empty());

    assertThatThrownBy(() -> service.generateDraft(new GenerateDraftResponseCommand(999L)))
        .isInstanceOf(NotFoundException.class)
        .hasMessageContaining("Session not found: 999");
  }

  @Test
  @DisplayName("매칭 워크플로우가 없으면 BadRequestException을 던진다")
  void should_throwBadRequest_when_workflowMissing() {
    ChatSession session = ChatSession.create(2L, 12L, ChatSessionStatus.ACTIVE, "WEB", "{}");
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(workflowExecutionRepository.findTopByChatSessionIdOrderByStartedAtDescIdDesc(1L))
        .willReturn(Optional.empty());
    given(workflowDefinitionRepository.findAllByDomainPackVersionId(12L)).willReturn(List.of());

    assertThatThrownBy(() -> service.generateDraft(new GenerateDraftResponseCommand(1L)))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("Matched workflow not found for session: 1");
  }
}
