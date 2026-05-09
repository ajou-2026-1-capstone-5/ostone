package com.init.domainpack.infrastructure;

import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.IntentSlotBinding;
import com.init.domainpack.domain.model.IntentWorkflowBinding;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.IntentSlotBindingRepository;
import com.init.domainpack.domain.repository.IntentWorkflowBindingRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionSummaryRow;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import jakarta.persistence.EntityManager;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("demo")
@Order(Ordered.LOWEST_PRECEDENCE - 100)
public class DemoRefundRequestSeedRunner implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(DemoRefundRequestSeedRunner.class);
  private static final Long DOMAIN_PACK_VERSION_ID = 101L;
  private static final Long WORKFLOW_ID = 153L;
  private static final String WORKFLOW_CODE = "refund_request_flow";

  private final WorkflowDefinitionRepository workflowDefinitionRepository;
  private final IntentDefinitionRepository intentDefinitionRepository;
  private final IntentSlotBindingRepository intentSlotBindingRepository;
  private final IntentWorkflowBindingRepository intentWorkflowBindingRepository;
  private final ChatSessionRepository chatSessionRepository;
  private final ChatMessageRepository chatMessageRepository;
  private final EntityManager entityManager;

  public DemoRefundRequestSeedRunner(
      WorkflowDefinitionRepository workflowDefinitionRepository,
      IntentDefinitionRepository intentDefinitionRepository,
      IntentSlotBindingRepository intentSlotBindingRepository,
      IntentWorkflowBindingRepository intentWorkflowBindingRepository,
      ChatSessionRepository chatSessionRepository,
      ChatMessageRepository chatMessageRepository,
      EntityManager entityManager) {
    this.workflowDefinitionRepository = workflowDefinitionRepository;
    this.intentDefinitionRepository = intentDefinitionRepository;
    this.intentSlotBindingRepository = intentSlotBindingRepository;
    this.intentWorkflowBindingRepository = intentWorkflowBindingRepository;
    this.chatSessionRepository = chatSessionRepository;
    this.chatMessageRepository = chatMessageRepository;
    this.entityManager = entityManager;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    log.info("demo seed start");
    seedIfMissing();
    log.info("Demo seed completed for workflow '{}'", WORKFLOW_CODE);
  }

  private void seedIfMissing() {
    List<WorkflowDefinitionSummaryRow> existing =
        workflowDefinitionRepository.findAllByDomainPackVersionIdOrderByWorkflowCodeAsc(
            DOMAIN_PACK_VERSION_ID);
    boolean exists = existing.stream().anyMatch(row -> WORKFLOW_CODE.equals(row.getWorkflowCode()));
    if (exists) {
      log.info("Workflow '{}' already exists, skipping demo seed", WORKFLOW_CODE);
      return;
    }

    IntentDefinition intent =
        IntentDefinition.create(
            DOMAIN_PACK_VERSION_ID,
            "request_refund",
            "환불 요청",
            "고객이 이미 구매한 상품에 대해 환불을 요청하는 의도",
            1,
            "{}",
            "{}",
            "[]",
            "{}");
    intent.changeStatus(IntentDefinition.STATUS_PUBLISHED);
    IntentDefinition savedIntent = intentDefinitionRepository.save(intent);

    String graphJson = buildRefundRequestGraphJson();
    validateGraph(graphJson);

    WorkflowDefinition workflow =
        WorkflowDefinition.create(
            DOMAIN_PACK_VERSION_ID,
            WORKFLOW_CODE,
            "환불 요청 처리",
            "환불 요청을 접수하고 금액, 기한, 고액 알림 조건을 확인하는 워크플로우",
            graphJson,
            "start",
            "[\"refund_requested\",\"rejected\"]",
            "[]",
            "{}");
    WorkflowDefinition savedWorkflow = workflowDefinitionRepository.save(workflow);

    intentSlotBindingRepository.saveAll(
        List.of(
            IntentSlotBinding.create(savedIntent.getId(), 120L, true, 1, null, "{}"),
            IntentSlotBinding.create(savedIntent.getId(), 123L, true, 2, null, "{}"),
            IntentSlotBinding.create(savedIntent.getId(), 124L, true, 3, null, "{}"),
            IntentSlotBinding.create(savedIntent.getId(), 125L, true, 4, null, "{}")));

    intentWorkflowBindingRepository.saveAll(
        List.of(IntentWorkflowBinding.create(savedIntent.getId(), savedWorkflow.getId(), true, "{}")));

    seedChatMessages();
  }

  private void seedChatMessages() {
    ChatSession session =
        ChatSession.create(
            1L,
            DOMAIN_PACK_VERSION_ID,
            ChatSessionStatus.ACTIVE,
            "DEMO",
            "{\"demo\":true,\"scenario\":\"refund_request\",\"workflowCode\":\"refund_request_flow\"}");
    ChatSession savedSession = chatSessionRepository.save(session);

    saveMessage(
        savedSession.getId(),
        1,
        "USER",
        "TEXT",
        "환불 요청합니다",
        "{\"workflowCode\":\"refund_request_flow\",\"workflowId\":"
            + WORKFLOW_ID
            + ",\"currentNodeId\":\"start\"}");
    saveMessage(
        savedSession.getId(),
        2,
        "AGENT",
        "TEXT",
        "주문번호와 환불 예상 금액을 확인하겠습니다.",
        "{\"workflowCode\":\"refund_request_flow\",\"workflowId\":"
            + WORKFLOW_ID
            + ",\"incomingEdgeId\":\"e1\",\"currentNodeId\":\"n1\",\"policyRef\":\"refund_amount_check\"}");
    saveMessage(
        savedSession.getId(),
        3,
        "AGENT",
        "TEXT",
        "환불 가능 금액이 확인되었습니다. 반품 가능 기한을 이어서 확인하겠습니다.",
        "{\"workflowCode\":\"refund_request_flow\",\"workflowId\":"
            + WORKFLOW_ID
            + ",\"incomingEdgeId\":\"e3\",\"currentNodeId\":\"n3\",\"policyRef\":\"return_deadline_check\"}");
    saveMessage(
        savedSession.getId(),
        4,
        "NOTE",
        "SYSTEM",
        "고객명과 연락처 확인 완료. 고액 환불 알림 대상입니다.",
        "{\"workflowCode\":\"refund_request_flow\",\"workflowId\":"
            + WORKFLOW_ID
            + ",\"incomingEdgeId\":\"e6\",\"currentNodeId\":\"n5\",\"policyRef\":\"high_value_alert\"}");
    saveMessage(
        savedSession.getId(),
        5,
        "AGENT",
        "TEXT",
        "환불 요청이 접수되었습니다. 처리 결과는 등록된 연락처로 안내드리겠습니다.",
        "{\"workflowCode\":\"refund_request_flow\",\"workflowId\":"
            + WORKFLOW_ID
            + ",\"incomingEdgeId\":\"e8\",\"currentNodeId\":\"end_requested\"}");
  }

  private void saveMessage(
      Long chatSessionId,
      Integer seqNo,
      String senderRole,
      String messageType,
      String content,
      String payloadJson) {
    ChatMessage savedMessage =
        chatMessageRepository.save(
            ChatMessage.create(chatSessionId, seqNo, senderRole, messageType, content));
    entityManager
        .createNativeQuery(
            "update runtime.chat_message set payload_json = cast(:payloadJson as jsonb) where id = :id")
        .setParameter("payloadJson", payloadJson)
        .setParameter("id", savedMessage.getId())
        .executeUpdate();
  }

  private void validateGraph(String graphJson) {
    try {
      Class<?> validatorClass = Class.forName("com.init.domainpack.application.WorkflowGraphValidator");
      Method parseAndValidate =
          validatorClass.getDeclaredMethod("parseAndValidate", String.class, String.class);
      parseAndValidate.setAccessible(true);
      parseAndValidate.invoke(null, graphJson, WORKFLOW_CODE);
    } catch (InvocationTargetException e) {
      Throwable cause = e.getCause();
      if (cause instanceof RuntimeException runtimeException) {
        throw runtimeException;
      }
      throw new IllegalStateException("워크플로우 그래프 검증에 실패했습니다.", cause);
    } catch (ReflectiveOperationException e) {
      throw new IllegalStateException("워크플로우 그래프 검증기를 호출할 수 없습니다.", e);
    }
  }

  private String buildRefundRequestGraphJson() {
    return """
        {
          "direction": "top-to-bottom",
          "nodes": [
            {"id": "start", "type": "START", "label": "시작"},
            {"id": "n1", "type": "ACTION", "label": "환불 금액 확인", "policyRef": "refund_amount_check"},
            {"id": "n2", "type": "DECISION", "label": "환불 가능?"},
            {"id": "n3", "type": "ACTION", "label": "반품 기한 확인", "policyRef": "return_deadline_check"},
            {"id": "n4", "type": "DECISION", "label": "기한 내?"},
            {"id": "n5", "type": "ACTION", "label": "고액 환불 알림", "policyRef": "high_value_alert"},
            {"id": "end_requested", "type": "TERMINAL", "label": "환불 접수 완료", "state": "refund_requested"},
            {"id": "end_rejected", "type": "TERMINAL", "label": "환불 불가", "state": "rejected"}
          ],
          "edges": [
            {"id": "e1", "from": "start", "to": "n1"},
            {"id": "e2", "from": "n1", "to": "n2"},
            {"id": "e3", "from": "n2", "to": "n3", "label": "가능"},
            {"id": "e4", "from": "n2", "to": "end_rejected", "label": "불가능"},
            {"id": "e5", "from": "n3", "to": "n4"},
            {"id": "e6", "from": "n4", "to": "n5", "label": "기한 내"},
            {"id": "e7", "from": "n4", "to": "end_rejected", "label": "기한 초과"},
            {"id": "e8", "from": "n5", "to": "end_requested"}
          ]
        }
        """;
  }
}
