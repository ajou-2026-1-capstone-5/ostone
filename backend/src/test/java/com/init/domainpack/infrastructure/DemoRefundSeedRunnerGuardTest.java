package com.init.domainpack.infrastructure;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.IntentSlotBindingRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionSummaryRow;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("DemoRefundRequestSeedRunner guard")
class DemoRefundSeedRunnerGuardTest {

  private static final Long DOMAIN_PACK_VERSION_ID = 101L;
  private static final String WORKFLOW_CODE = "refund_request_flow";

  @Mock private WorkflowDefinitionRepository workflowDefinitionRepository;
  @Mock private IntentDefinitionRepository intentDefinitionRepository;
  @Mock private IntentSlotBindingRepository intentSlotBindingRepository;
  @Mock private ChatSessionRepository chatSessionRepository;
  @Mock private ChatMessageRepository chatMessageRepository;
  @Mock private EntityManager entityManager;
  @Mock private Query query;

  private DemoRefundRequestSeedRunner runner;

  @BeforeEach
  void setUp() {
    runner =
        new DemoRefundRequestSeedRunner(
            workflowDefinitionRepository,
            intentDefinitionRepository,
            intentSlotBindingRepository,
            chatSessionRepository,
            chatMessageRepository,
            entityManager);
  }

  @Test
  @DisplayName("workflowCode가 이미 존재하면 seed 저장 로직을 건너뛴다")
  void shouldSkipSeedWhenWorkflowCodeExists() {
    WorkflowDefinitionSummaryRow existing = existingWorkflow(WORKFLOW_CODE);
    given(workflowDefinitionRepository.findAllByDomainPackVersionIdOrderByWorkflowCodeAsc(101L))
        .willReturn(List.of(existing));

    runner.run(new DefaultApplicationArguments());

    verify(intentDefinitionRepository, never()).save(any(IntentDefinition.class));
    verify(workflowDefinitionRepository, never()).save(any(WorkflowDefinition.class));
    verify(intentSlotBindingRepository, never()).saveAll(any());
    verify(chatSessionRepository, never()).save(any(ChatSession.class));
    verify(chatMessageRepository, never()).save(any(ChatMessage.class));
  }

  @Test
  @DisplayName("workflowCode가 없으면 seed 저장 로직을 실행한다")
  void shouldSeedWhenWorkflowCodeMissing() {
    given(workflowDefinitionRepository.findAllByDomainPackVersionIdOrderByWorkflowCodeAsc(101L))
        .willReturn(List.of());
    given(intentDefinitionRepository.save(any(IntentDefinition.class)))
        .willAnswer(
            invocation -> {
              IntentDefinition intent = invocation.getArgument(0);
              ReflectionTestUtils.setField(intent, "id", 111L);
              return intent;
            });
    given(workflowDefinitionRepository.save(any(WorkflowDefinition.class)))
        .willAnswer(
            invocation -> {
              WorkflowDefinition workflow = invocation.getArgument(0);
              ReflectionTestUtils.setField(workflow, "id", 153L);
              return workflow;
            });
    given(chatSessionRepository.save(any(ChatSession.class)))
        .willAnswer(
            invocation -> {
              ChatSession session = invocation.getArgument(0);
              ReflectionTestUtils.setField(session, "id", 1L);
              return session;
            });
    given(chatMessageRepository.save(any(ChatMessage.class)))
        .willAnswer(
            invocation -> {
              ChatMessage message = invocation.getArgument(0);
              ReflectionTestUtils.setField(message, "id", 10L);
              return message;
            });
    when(entityManager.createNativeQuery(any(String.class))).thenReturn(query);
    when(query.setParameter(any(String.class), any())).thenReturn(query);

    runner.run(new DefaultApplicationArguments());

    verify(intentDefinitionRepository).save(any(IntentDefinition.class));
    verify(workflowDefinitionRepository).save(any(WorkflowDefinition.class));
    verify(intentSlotBindingRepository).saveAll(any());
    verify(chatSessionRepository).save(any(ChatSession.class));
    verify(chatMessageRepository, times(5)).save(any(ChatMessage.class));
  }

  private WorkflowDefinitionSummaryRow existingWorkflow(String workflowCode) {
    return new WorkflowDefinitionSummaryRow() {
      @Override
      public Long getId() {
        return 153L;
      }

      @Override
      public Long getDomainPackVersionId() {
        return DOMAIN_PACK_VERSION_ID;
      }

      @Override
      public String getWorkflowCode() {
        return workflowCode;
      }

      @Override
      public String getName() {
        return "환불 요청 처리";
      }

      @Override
      public String getDescription() {
        return "환불 요청 워크플로우";
      }

      @Override
      public String getInitialState() {
        return "start";
      }

      @Override
      public String getTerminalStatesJson() {
        return "[]";
      }

      @Override
      public java.time.OffsetDateTime getCreatedAt() {
        return null;
      }

      @Override
      public java.time.OffsetDateTime getUpdatedAt() {
        return null;
      }
    };
  }
}
