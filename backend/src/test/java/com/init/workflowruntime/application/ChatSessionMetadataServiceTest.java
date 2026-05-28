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
    ChatSession session = createSession("{\"customerName\":\"김민지\",\"handoffReason\":\"환불 문의\"}");
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

  @Test
  @DisplayName("updateAfterMessage: 빈 meta와 빈 본문을 복구하고 채널 기반 제목을 사용한다")
  void should_recoverBlankMetaAndUseChannelTitle() throws Exception {
    ChatSession session = createSession(" ", "WEB");
    ChatMessage message = createMessageWithoutCreatedAt(1L, 1, "AGENT", "   ");

    service.updateAfterMessage(session, message);

    JsonNode meta = objectMapper.readTree(session.getMetaJson());
    assertThat(meta.path("title").asText()).isEqualTo("WEB 상담");
    assertThat(meta.path("lastMessagePreview").asText()).isEmpty();
    assertThat(meta.path("lastMessageAt").asText()).isNotBlank();
  }

  @Test
  @DisplayName("updateAfterMessage: object가 아닌 metaJson도 메시지 저장을 막지 않는다")
  void should_recoverNonObjectMetaJson() throws Exception {
    ChatSession session = createSession("[]", "WEB");
    ChatMessage message =
        createMessage(1L, 1, "ASSISTANT", "안내 메시지입니다.", "2026-05-27T10:03:00+09:00");

    service.updateAfterMessage(session, message);

    JsonNode meta = objectMapper.readTree(session.getMetaJson());
    assertThat(meta.path("title").asText()).isEqualTo("WEB 상담");
    assertThat(meta.path("lastMessageRole").asText()).isEqualTo("ASSISTANT");
  }

  @Test
  @DisplayName("updateAfterMessage: handoffReason이 없으면 고객명 기반 제목을 사용한다")
  void should_useCustomerNameTitle_when_handoffReasonIsMissing() throws Exception {
    ChatSession session = createSession("{\"customerName\":\"이영희\"}");
    ChatMessage message =
        createMessage(1L, 1, "ASSISTANT", "안내 메시지입니다.", "2026-05-27T10:03:00+09:00");

    service.updateAfterMessage(session, message);

    JsonNode meta = objectMapper.readTree(session.getMetaJson());
    assertThat(meta.path("title").asText()).isEqualTo("이영희 상담");
  }

  @Test
  @DisplayName("updateAfterMessage: 제목 후보가 없으면 기본 상담 제목을 사용한다")
  void should_useDefaultTitle_when_noFallbackMetadataExists() throws Exception {
    ChatSession session = createSession("{}", " ");
    ChatMessage message =
        createMessage(1L, 1, "ASSISTANT", "안내 메시지입니다.", "2026-05-27T10:03:00+09:00");

    service.updateAfterMessage(session, message);

    JsonNode meta = objectMapper.readTree(session.getMetaJson());
    assertThat(meta.path("title").asText()).isEqualTo("채팅 상담");
  }

  @Test
  @DisplayName("updateAfterMessage: 고객 메시지 제목과 최근 메시지 미리보기를 축약한다")
  void should_truncateCustomerTitleAndLastMessagePreview() throws Exception {
    ChatSession session = createSession("{}");
    String content = "고객이 남긴 환불 문의 내용이 매우 길어서 상담 목록과 상세 미리보기에서 적절하게 줄여야 합니다. ".repeat(3);
    ChatMessage message = createMessage(1L, 1, "CUSTOMER", content, "2026-05-27T10:03:00+09:00");

    service.updateAfterMessage(session, message);

    JsonNode meta = objectMapper.readTree(session.getMetaJson());
    assertThat(meta.path("title").asText()).hasSizeLessThanOrEqualTo(40).endsWith("…");
    assertThat(meta.path("lastMessagePreview").asText()).hasSizeLessThanOrEqualTo(80).endsWith("…");
  }

  private ChatSession createSession(String metaJson) {
    return createSession(metaJson, "WEB");
  }

  private ChatSession createSession(String metaJson, String channel) {
    ChatSession session = ChatSession.create(1L, 1L, ChatSessionStatus.OPEN, channel, metaJson, 1L);
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

  private ChatMessage createMessageWithoutCreatedAt(
      Long sessionId, int seqNo, String role, String content) {
    ChatMessage message = ChatMessage.create(sessionId, seqNo, role, "TEXT", content);
    ReflectionTestUtils.setField(message, "id", (long) seqNo);
    return message;
  }
}
