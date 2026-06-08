package com.init.workflowruntime.application;

import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.chatMessageWithId;
import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.chatMessageWithIdAndCreatedAt;
import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.chatSessionWithId;
import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionStatus;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

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

  @Test
  @DisplayName("recordHandoff: handoff 메타데이터를 기록하고 제목 후보로 사용한다")
  void should_recordHandoffMetadata() throws Exception {
    ChatSession session = createSession("{\"customerName\":\"김민지\"}");

    boolean changed = service.recordHandoff(session, " 상담사 이관 ", " handoff ");

    JsonNode meta = objectMapper.readTree(session.getMetaJson());
    assertThat(changed).isTrue();
    assertThat(meta.path("customerName").asText()).isEqualTo("김민지");
    assertThat(meta.path("handoffRequired").asBoolean()).isTrue();
    assertThat(meta.path("handoffReason").asText()).isEqualTo("상담사 이관");
    assertThat(meta.path("handoffNodeId").asText()).isEqualTo("handoff");
    assertThat(meta.path("handoffAt").asText()).isNotBlank();
    assertThat(meta.path("title").asText()).isEqualTo("상담사 이관");
    assertThat(service.isHandoffRequired(session)).isTrue();
    assertThat(service.handoffAt(session)).isNotNull();
  }

  @Test
  @DisplayName("recordHandoff: 같은 handoff는 handoffAt을 다시 쓰지 않는다")
  void should_notRewriteSameHandoff() throws Exception {
    ChatSession session =
        createSession(
            "{\"handoffRequired\":true,\"handoffReason\":\"상담사 이관\",\"handoffNodeId\":\"handoff\",\"handoffAt\":\"2026-06-01T10:00:00+09:00\"}");

    boolean changed = service.recordHandoff(session, "상담사 이관", "handoff");

    JsonNode meta = objectMapper.readTree(session.getMetaJson());
    assertThat(changed).isFalse();
    assertThat(meta.path("handoffAt").asText()).isEqualTo("2026-06-01T10:00:00+09:00");
  }

  @Test
  @DisplayName("recordHandoff: 빈 reason과 nodeId는 기본 사유와 node 제거로 정규화한다")
  void should_useDefaultReasonAndRemoveNode_when_handoffValuesAreBlank() throws Exception {
    ChatSession session =
        createSession("{\"title\":\"기존 상담\",\"handoffNodeId\":\"previous-node\"}");

    boolean changed = service.recordHandoff(session, " ", " ");

    JsonNode meta = objectMapper.readTree(session.getMetaJson());
    assertThat(changed).isTrue();
    assertThat(meta.path("handoffRequired").asBoolean()).isTrue();
    assertThat(meta.path("handoffReason").asText()).isEqualTo("상담원 확인이 필요합니다.");
    assertThat(meta.has("handoffNodeId")).isFalse();
    assertThat(meta.path("title").asText()).isEqualTo("기존 상담");
  }

  @Test
  @DisplayName("resolveHandoff: 이관 필요 상태를 해소하고 해소 시각을 남긴다")
  void should_resolveHandoffMetadata() throws Exception {
    ChatSession session =
        createSession(
            "{\"handoffRequired\":true,\"handoffReason\":\"상담사 이관\",\"handoffAt\":\"2026-06-01T10:00:00+09:00\"}");

    service.resolveHandoff(session);

    JsonNode meta = objectMapper.readTree(session.getMetaJson());
    assertThat(meta.path("handoffRequired").asBoolean()).isFalse();
    assertThat(meta.path("handoffResolvedAt").asText()).isNotBlank();
    assertThat(meta.path("handoffReason").asText()).isEqualTo("상담사 이관");
  }

  @Test
  @DisplayName("resolveHandoff: 이관 필요 상태가 아니면 meta를 변경하지 않는다")
  void should_keepMetadata_when_handoffIsNotRequired() {
    ChatSession session = createSession("{\"handoffRequired\":false,\"title\":\"일반 상담\"}");

    service.resolveHandoff(session);

    assertThat(session.getMetaJson()).isEqualTo("{\"handoffRequired\":false,\"title\":\"일반 상담\"}");
  }

  @Test
  @DisplayName("handoffAt: 값이 없거나 잘못된 시각이면 null을 반환한다")
  void should_returnNull_when_handoffAtIsMissingOrInvalid() {
    ChatSession missing = createSession("{}");
    ChatSession invalid = createSession("{\"handoffAt\":\"not-a-date\"}");

    assertThat(service.handoffAt(missing)).isNull();
    assertThat(service.handoffAt(invalid)).isNull();
  }

  @Test
  @DisplayName("recordResolution: 기존 meta를 보존하고 처리 결과를 기록한다")
  void should_preserveMetaAndRecordResolution() throws Exception {
    ChatSession session = createSession("{\"customerName\":\"김민지\",\"title\":\"환불 상담\"}");

    service.recordResolution(
        session, "FOLLOW_UP_REQUIRED", "후속 연락 필요", "RESOLVED", " 배송사 확인 필요 ", true);

    JsonNode meta = objectMapper.readTree(session.getMetaJson());
    assertThat(meta.path("customerName").asText()).isEqualTo("김민지");
    assertThat(meta.path("title").asText()).isEqualTo("환불 상담");
    assertThat(meta.path("resolution").path("outcome").asText()).isEqualTo("FOLLOW_UP_REQUIRED");
    assertThat(meta.path("resolution").path("label").asText()).isEqualTo("후속 연락 필요");
    assertThat(meta.path("resolution").path("status").asText()).isEqualTo("RESOLVED");
    assertThat(meta.path("resolution").path("reason").asText()).isEqualTo("배송사 확인 필요");
    assertThat(meta.path("resolution").path("followUpRequired").asBoolean()).isTrue();
    assertThat(meta.path("resolution").path("resolvedAt").asText()).isNotBlank();
  }

  private ChatSession createSession(String metaJson) {
    return createSession(metaJson, "WEB");
  }

  private ChatSession createSession(String metaJson, String channel) {
    ChatSession session = ChatSession.create(1L, 1L, ChatSessionStatus.OPEN, channel, metaJson, 1L);
    return chatSessionWithId(session, 1L);
  }

  private ChatMessage createMessage(
      Long sessionId, int seqNo, String role, String content, String createdAt) {
    ChatMessage message = ChatMessage.create(sessionId, seqNo, role, "TEXT", content);
    return chatMessageWithIdAndCreatedAt(message, (long) seqNo, OffsetDateTime.parse(createdAt));
  }

  private ChatMessage createMessageWithoutCreatedAt(
      Long sessionId, int seqNo, String role, String content) {
    ChatMessage message = ChatMessage.create(sessionId, seqNo, role, "TEXT", content);
    return chatMessageWithId(message, (long) seqNo);
  }
}
