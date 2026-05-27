package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionStatus;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

@DisplayName("ChatSessionMetadataService")
class ChatSessionMetadataServiceTest {

  private final ObjectMapper objectMapper = new ObjectMapper();
  private final ChatSessionMetadataService service = new ChatSessionMetadataService(objectMapper);

  @Test
  @DisplayName("updateAfterMessage: 기존 meta를 보존하고 최근 메시지 필드를 갱신한다")
  void should_preserveExistingMetaAndUpdateLastMessageFields() throws Exception {
    ChatSession session =
        createSession("{\"customerName\":\"김민지\",\"handoffReason\":\"환불 문의\"}");
    ChatMessage message =
        createMessage(1L, 3, "COUNSELOR", "처리 도와드리겠습니다.", "2026-05-27T10:15:30+09:00");

    service.updateAfterMessage(session, message);

    JsonNode meta = objectMapper.readTree(session.getMetaJson());
    assertThat(meta.path("customerName").asText()).isEqualTo("김민지");
    assertThat(meta.path("handoffReason").asText()).isEqualTo("환불 문의");
    assertThat(meta.path("title").asText()).isEqualTo("환불 문의");
    assertThat(meta.path("messageCount").asInt()).isEqualTo(3);
    assertThat(meta.path("lastMessagePreview").asText()).isEqualTo("처리 도와드리겠습니다.");
    assertThat(meta.path("lastMessageRole").asText()).isEqualTo("COUNSELOR");
    assertThat(meta.path("lastMessageAt").asText()).isEqualTo("2026-05-27T10:15:30+09:00");
  }

  @Test
  @DisplayName("updateAfterMessage: invalid metaJson을 복구하고 고객 메시지로 제목을 만든다")
  void should_recoverInvalidMetaAndUseCustomerMessageTitle() throws Exception {
    ChatSession session = createSession("{invalid-json}");
    ChatMessage message =
        createMessage(1L, 1, "USER", "환불 가능 여부를 확인하고 싶습니다.", "2026-05-27T10:00:00+09:00");

    service.updateAfterMessage(session, message);

    JsonNode meta = objectMapper.readTree(session.getMetaJson());
    assertThat(meta.path("title").asText()).isEqualTo("환불 가능 여부를 확인하고 싶습니다.");
    assertThat(meta.path("messageCount").asInt()).isEqualTo(1);
    assertThat(meta.path("lastMessageRole").asText()).isEqualTo("USER");
  }

  @Test
  @DisplayName("updateAfterMessage: 기존 title은 덮어쓰지 않는다")
  void should_keepExistingTitle() throws Exception {
    ChatSession session = createSession("{\"title\":\"VIP 환불 상담\",\"handoffReason\":\"다른 제목\"}");
    ChatMessage message =
        createMessage(1L, 2, "ASSISTANT", "안내 메시지입니다.", "2026-05-27T10:03:00+09:00");

    service.updateAfterMessage(session, message);

    JsonNode meta = objectMapper.readTree(session.getMetaJson());
    assertThat(meta.path("title").asText()).isEqualTo("VIP 환불 상담");
    assertThat(meta.path("lastMessageRole").asText()).isEqualTo("ASSISTANT");
  }

  private ChatSession createSession(String metaJson) {
    ChatSession session = ChatSession.create(1L, 1L, ChatSessionStatus.OPEN, "WEB", metaJson, 1L);
    ReflectionTestUtils.setField(session, "id", 1L);
    return session;
  }

  private ChatMessage createMessage(
      Long sessionId, int seqNo, String role, String content, String createdAt) {
    ChatMessage message = ChatMessage.create(sessionId, seqNo, role, "TEXT", content);
    ReflectionTestUtils.setField(message, "id", (long) seqNo);
    ReflectionTestUtils.setField(message, "createdAt", OffsetDateTime.parse(createdAt));
    return message;
  }
}
