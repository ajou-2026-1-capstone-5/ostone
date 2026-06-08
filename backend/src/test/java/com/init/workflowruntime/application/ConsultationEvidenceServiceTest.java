package com.init.workflowruntime.application;

import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.chatMessageWithId;
import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.chatSessionWithId;
import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.policyDefinitionWithId;
import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.riskDefinitionWithId;
import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.slotDefinitionWithId;
import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.workflowExecutionWithId;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.domain.model.PolicyDefinition;
import com.init.domainpack.domain.model.RiskDefinition;
import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import com.init.domainpack.domain.repository.RiskDefinitionRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.dto.MessageDomainPackElementsResponse;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.domain.WorkflowExecution;
import com.init.workflowruntime.domain.WorkflowExecutionRepository;
import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.domain.model.WorkspaceMember;
import com.init.workspace.domain.model.WorkspaceMemberRole;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("ConsultationEvidenceService")
class ConsultationEvidenceServiceTest {

  @Mock private ChatSessionRepository chatSessionRepository;
  @Mock private ChatMessageRepository chatMessageRepository;
  @Mock private WorkflowExecutionRepository workflowExecutionRepository;
  @Mock private SlotDefinitionRepository slotDefinitionRepository;
  @Mock private PolicyDefinitionRepository policyDefinitionRepository;
  @Mock private RiskDefinitionRepository riskDefinitionRepository;
  @Mock private WorkspaceMemberRepository workspaceMemberRepository;

  private ConsultationEvidenceService service;

  @BeforeEach
  void setUp() {
    service =
        new ConsultationEvidenceService(
            chatSessionRepository,
            chatMessageRepository,
            workflowExecutionRepository,
            slotDefinitionRepository,
            policyDefinitionRepository,
            riskDefinitionRepository,
            workspaceMemberRepository,
            new ObjectMapper());
  }

  @Test
  @DisplayName("메시지 상세 근거는 최신 실행 스냅샷의 slot/policy/risk를 도메인팩 정의명과 함께 반환한다")
  void should_returnDomainPackElementsFromLatestWorkflowExecution() {
    ChatSession session = createSession(1L, 2L, 3L, "WEB");
    ChatMessage message = createMessage(100L, 1L);
    WorkflowExecution execution = createExecution();
    SlotDefinition orderNumber = createSlot(10L, "orderNumber", "주문 번호", false);
    SlotDefinition refundReason = createSlot(11L, "refundReason", "환불 사유", false);
    SlotDefinition cardLast4 = createSlot(12L, "cardLast4", "카드 끝자리", true);
    PolicyDefinition refundPolicy = createPolicy(20L, "refund_policy", "환불 정책");
    RiskDefinition highRefund = createRisk(30L, "high_refund", "고액 환불", "HIGH");

    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(2L, 7L))
        .willReturn(Optional.of(WorkspaceMember.create(2L, 7L, WorkspaceMemberRole.OPERATOR)));
    given(chatMessageRepository.findById(100L)).willReturn(Optional.of(message));
    given(workflowExecutionRepository.findTopByChatSessionIdOrderByStartedAtDescIdDesc(1L))
        .willReturn(Optional.of(execution));
    given(slotDefinitionRepository.findAllByDomainPackVersionIdOrderBySlotCodeAsc(3L))
        .willReturn(List.of(cardLast4, orderNumber, refundReason));
    given(policyDefinitionRepository.findByDomainPackVersionIdAndPolicyCode(3L, "refund_policy"))
        .willReturn(Optional.of(refundPolicy));
    given(riskDefinitionRepository.findByDomainPackVersionIdAndRiskCode(3L, "high_refund"))
        .willReturn(Optional.of(highRefund));

    MessageDomainPackElementsResponse result = service.getMessageDomainPackElements(1L, 100L, 7L);

    assertThat(result.sessionId()).isEqualTo(1L);
    assertThat(result.messageId()).isEqualTo(100L);
    assertThat(result.workspaceId()).isEqualTo(2L);
    assertThat(result.domainPackVersionId()).isEqualTo(3L);
    assertThat(result.executionId()).isEqualTo(50L);
    assertThat(result.currentState()).isEqualTo("collect_refund_info");
    assertThat(result.slots())
        .extracting("id", "code", "name", "extracted", "value")
        .containsExactly(
            tuple(12L, "cardLast4", "카드 끝자리", true, "***"),
            tuple(10L, "orderNumber", "주문 번호", true, "ORD-1"),
            tuple(11L, "refundReason", "환불 사유", false, null));
    assertThat(result.policies())
        .extracting("id", "code", "name", "matched", "reason", "nodeId")
        .containsExactly(tuple(20L, "refund_policy", "환불 정책", true, "조건 충족", "policy_check"));
    assertThat(result.risks())
        .extracting("id", "code", "name", "level")
        .containsExactly(tuple(30L, "high_refund", "고액 환불", "high"));
  }

  @Test
  @DisplayName("워크플로우 실행이 없어도 메시지 소유권 확인 후 빈 근거 목록을 반환한다")
  void should_returnEmptyEvidence_when_executionDoesNotExist() {
    ChatSession session = createSession(1L, 2L, 3L, "WEB");
    ChatMessage message = createMessage(100L, 1L);

    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(2L, 7L))
        .willReturn(Optional.of(WorkspaceMember.create(2L, 7L, WorkspaceMemberRole.OPERATOR)));
    given(chatMessageRepository.findById(100L)).willReturn(Optional.of(message));
    given(workflowExecutionRepository.findTopByChatSessionIdOrderByStartedAtDescIdDesc(1L))
        .willReturn(Optional.empty());
    given(slotDefinitionRepository.findAllByDomainPackVersionIdOrderBySlotCodeAsc(3L))
        .willReturn(List.of());

    MessageDomainPackElementsResponse result = service.getMessageDomainPackElements(1L, 100L, 7L);

    assertThat(result.executionId()).isNull();
    assertThat(result.currentState()).isNull();
    assertThat(result.slots()).isEmpty();
    assertThat(result.policies()).isEmpty();
    assertThat(result.risks()).isEmpty();
  }

  @Test
  @DisplayName("다른 세션의 메시지는 찾을 수 없는 메시지처럼 처리한다")
  void should_throwNotFound_when_messageBelongsToAnotherSession() {
    ChatSession session = createSession(1L, 2L, 3L, "WEB");
    ChatMessage message = createMessage(100L, 999L);

    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(2L, 7L))
        .willReturn(Optional.of(WorkspaceMember.create(2L, 7L, WorkspaceMemberRole.OPERATOR)));
    given(chatMessageRepository.findById(100L)).willReturn(Optional.of(message));

    assertThatThrownBy(() -> service.getMessageDomainPackElements(1L, 100L, 7L))
        .isInstanceOf(NotFoundException.class)
        .hasMessageContaining("Message not found: 100");

    verify(workflowExecutionRepository, never())
        .findTopByChatSessionIdOrderByStartedAtDescIdDesc(1L);
  }

  @Test
  @DisplayName("워크스페이스 멤버가 아니면 메시지 존재 여부를 노출하지 않고 거부한다")
  void should_throwAccessDenied_beforeMessageLookup_when_notWorkspaceMember() {
    ChatSession session = createSession(1L, 2L, 3L, "WEB");

    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(2L, 7L))
        .willReturn(Optional.empty());

    assertThatThrownBy(() -> service.getMessageDomainPackElements(1L, 100L, 7L))
        .isInstanceOf(WorkspaceAccessDeniedException.class);

    verify(chatMessageRepository, never()).findById(100L);
    verify(workflowExecutionRepository, never())
        .findTopByChatSessionIdOrderByStartedAtDescIdDesc(1L);
  }

  private ChatSession createSession(Long id, Long workspaceId, Long versionId, String channel) {
    ChatSession session =
        ChatSession.create(workspaceId, versionId, ChatSessionStatus.OPEN, channel, "{}");
    return chatSessionWithId(session, id);
  }

  private ChatMessage createMessage(Long id, Long sessionId) {
    ChatMessage message = ChatMessage.create(sessionId, 1, "CUSTOMER", "TEXT", "환불 요청");
    return chatMessageWithId(message, id);
  }

  private WorkflowExecution createExecution() {
    WorkflowExecution execution = WorkflowExecution.create(1L);
    execution.assignIntentWorkflow(40L, 60L, "collect_refund_info");
    execution.replaceSlotValuesJson("{\"orderNumber\":\"ORD-1\",\"cardLast4\":\"1234\"}");
    execution.replacePolicySnapshotJson(
        """
        {
          "currentPolicy": {
            "policyCode": "refund_policy",
            "matched": true,
            "missingSlotCodes": ["refundReason"],
            "reason": "조건 충족",
            "nodeId": "policy_check"
          },
          "hits": [{"policyCode": "refund_policy"}]
        }
        """);
    execution.replaceRiskSnapshotJson(
        """
        {
          "hits": [
            {"riskCode": "high_refund", "riskLevel": "HIGH"}
          ]
        }
        """);
    return workflowExecutionWithId(execution, 50L);
  }

  private SlotDefinition createSlot(Long id, String code, String name, boolean sensitive) {
    SlotDefinition slot =
        SlotDefinition.create(3L, code, name, "", "STRING", sensitive, "{}", null, "{}");
    return slotDefinitionWithId(slot, id);
  }

  private PolicyDefinition createPolicy(Long id, String code, String name) {
    PolicyDefinition policy =
        PolicyDefinition.create(3L, code, name, "", "HIGH", "{}", "{}", "[]", "{}");
    return policyDefinitionWithId(policy, id);
  }

  private RiskDefinition createRisk(Long id, String code, String name, String level) {
    RiskDefinition risk = RiskDefinition.create(3L, code, name, "", level, "{}", "{}", "[]", "{}");
    return riskDefinitionWithId(risk, id);
  }
}
