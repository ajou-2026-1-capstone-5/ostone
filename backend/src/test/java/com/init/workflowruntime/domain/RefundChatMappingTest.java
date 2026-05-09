package com.init.workflowruntime.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("RefundChatMapping")
class RefundChatMappingTest {

  private static final Long WORKSPACE_ID = 1L;
  private static final Long CHAT_SESSION_ID = 1L;
  private static final Long DOMAIN_PACK_VERSION_ID = 101L;
  private static final Long WORKFLOW_ID = 153L;
  private static final String WORKFLOW_CODE = "refund_request_flow";
  private static final String SESSION_META_JSON =
      "{\"demo\":true,\"scenario\":\"refund_request\",\"workflowCode\":\"refund_request_flow\"}";
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  @Test
  @DisplayName("demo chat session과 seeded message mapping이 환불 워크플로우 순서와 일치한다")
  void should_환불워크플로우매핑일치_when_demoChatMessagesSeeded() {
    // given
    ChatSession session = createSession();
    List<ExpectedMessage> expectedMessages = expectedMessages();
    List<ChatMessage> messages = expectedMessages.stream().map(this::createMessage).toList();

    // then
    assertThat(session.getWorkspaceId()).isEqualTo(WORKSPACE_ID);
    assertThat(session.getDomainPackVersionId()).isEqualTo(DOMAIN_PACK_VERSION_ID);
    assertThat(session.getStatus()).isEqualTo(ChatSessionStatus.ACTIVE);
    assertThat(session.getChannel()).isEqualTo("DEMO");
    JsonNode meta = parseJson(session.getMetaJson());
    assertThat(meta.path("demo").asBoolean()).isTrue();
    assertThat(meta.path("scenario").asText()).isEqualTo("refund_request");
    assertThat(meta.path("workflowCode").asText()).isEqualTo(WORKFLOW_CODE);

    assertThat(messages).hasSize(5).extracting(ChatMessage::getSeqNo).containsExactly(1, 2, 3, 4, 5);
    assertThat(messages)
        .zipSatisfy(expectedMessages, (message, expected) -> assertMessageMatches(message, expected));
  }

  @Test
  @DisplayName("payloadJson의 edgeId가 기대 매핑과 다르면 검증이 실패한다")
  void should_매핑검증실패_when_edgeIdInvalid() {
    // given
    ExpectedMessage expected = expectedMessages().get(1);
    ChatMessage message =
        createMessage(
            new ExpectedMessage(
                expected.seqNo(),
                expected.senderRole(),
                expected.messageType(),
                expected.content(),
                expected.currentNodeId(),
                "INVALID_EDGE_999",
                expected.policyRef()));

    // when
    boolean matchesExpectedMapping = payloadMatchesExpectedMapping(message, expected);

    // then
    assertThat(matchesExpectedMapping).isFalse();
  }

  private ChatSession createSession() {
    return ChatSession.create(
        WORKSPACE_ID, DOMAIN_PACK_VERSION_ID, ChatSessionStatus.ACTIVE, "DEMO", SESSION_META_JSON);
  }

  private ChatMessage createMessage(ExpectedMessage expected) {
    ChatMessage message =
        ChatMessage.create(
            CHAT_SESSION_ID,
            expected.seqNo(),
            expected.senderRole(),
            expected.messageType(),
            expected.content());
    ReflectionTestUtils.setField(message, "payloadJson", payloadJson(expected));
    return message;
  }

  private String payloadJson(ExpectedMessage expected) {
    String mappingJson =
        "\"workflowCode\":\""
            + WORKFLOW_CODE
            + "\",\"workflowId\":"
            + WORKFLOW_ID
            + ",\"currentNodeId\":\""
            + expected.currentNodeId()
            + "\"";
    if (expected.incomingEdgeId() != null) {
      mappingJson += ",\"incomingEdgeId\":\"" + expected.incomingEdgeId() + "\"";
    }
    if (expected.policyRef() != null) {
      mappingJson += ",\"policyRef\":\"" + expected.policyRef() + "\"";
    }
    return "{" + mappingJson + "}";
  }

  private void assertMessageMatches(ChatMessage message, ExpectedMessage expected) {
    assertThat(message.getChatSessionId()).isEqualTo(CHAT_SESSION_ID);
    assertThat(message.getSeqNo()).isEqualTo(expected.seqNo());
    assertThat(message.getSenderRole()).isEqualTo(expected.senderRole());
    assertThat(message.getMessageType()).isEqualTo(expected.messageType());
    assertThat(message.getContent()).isEqualTo(expected.content());
    JsonNode payload = parseJson(message.getPayloadJson());
    assertThat(payload.path("workflowCode").asText()).isEqualTo(WORKFLOW_CODE);
    assertThat(payload.path("workflowId").asLong()).isEqualTo(WORKFLOW_ID);
    assertThat(payload.path("currentNodeId").asText()).isEqualTo(expected.currentNodeId());
    assertOptionalText(payload, "incomingEdgeId", expected.incomingEdgeId());
    assertOptionalText(payload, "policyRef", expected.policyRef());
  }

  private boolean payloadMatchesExpectedMapping(ChatMessage message, ExpectedMessage expected) {
    JsonNode payload = parseJson(message.getPayloadJson());
    boolean requiredFieldsMatch =
        WORKFLOW_CODE.equals(payload.path("workflowCode").asText())
            && WORKFLOW_ID.equals(payload.path("workflowId").asLong())
            && expected.currentNodeId().equals(payload.path("currentNodeId").asText());

    return requiredFieldsMatch
        && optionalTextMatches(payload, "incomingEdgeId", expected.incomingEdgeId())
        && optionalTextMatches(payload, "policyRef", expected.policyRef());
  }

  private boolean optionalTextMatches(JsonNode payload, String fieldName, String expectedValue) {
    if (expectedValue == null) {
      return !payload.has(fieldName);
    }
    return expectedValue.equals(payload.path(fieldName).asText());
  }

  private void assertOptionalText(JsonNode payload, String fieldName, String expectedValue) {
    if (expectedValue == null) {
      assertThat(payload.has(fieldName)).isFalse();
      return;
    }
    assertThat(payload.path(fieldName).asText()).isEqualTo(expectedValue);
  }

  private JsonNode parseJson(String json) {
    try {
      return OBJECT_MAPPER.readTree(json);
    } catch (JsonProcessingException e) {
      throw new AssertionError("JSON parsing failed", e);
    }
  }

  private List<ExpectedMessage> expectedMessages() {
    return List.of(
        new ExpectedMessage(1, "USER", "TEXT", "환불 요청합니다", "start", null, null),
        new ExpectedMessage(
            2,
            "AGENT",
            "TEXT",
            "주문번호와 환불 예상 금액을 확인하겠습니다.",
            "n1",
            "e1",
            "refund_amount_check"),
        new ExpectedMessage(
            3,
            "AGENT",
            "TEXT",
            "환불 가능 금액이 확인되었습니다. 반품 가능 기한을 이어서 확인하겠습니다.",
            "n3",
            "e3",
            "return_deadline_check"),
        new ExpectedMessage(
            4,
            "NOTE",
            "SYSTEM",
            "고객명과 연락처 확인 완료. 고액 환불 알림 대상입니다.",
            "n5",
            "e6",
            "high_value_alert"),
        new ExpectedMessage(
            5,
            "AGENT",
            "TEXT",
            "환불 요청이 접수되었습니다. 처리 결과는 등록된 연락처로 안내드리겠습니다.",
            "end_requested",
            "e8",
            null));
  }

  private record ExpectedMessage(
      int seqNo,
      String senderRole,
      String messageType,
      String content,
      String currentNodeId,
      String incomingEdgeId,
      String policyRef) {}
}
