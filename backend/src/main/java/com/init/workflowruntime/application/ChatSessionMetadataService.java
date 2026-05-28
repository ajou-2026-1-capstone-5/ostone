package com.init.workflowruntime.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatSession;
import java.time.OffsetDateTime;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ChatSessionMetadataService {

  private static final Logger log = LoggerFactory.getLogger(ChatSessionMetadataService.class);
  private static final int TITLE_MAX_LENGTH = 40;
  private static final int PREVIEW_MAX_LENGTH = 80;

  private final ObjectMapper objectMapper;

  public ChatSessionMetadataService(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  @Transactional
  public void updateAfterMessage(ChatSession session, ChatMessage message) {
    ObjectNode meta = parseMeta(session.getMetaJson());
    ensureTitle(meta, session, message);
    meta.put("messageCount", message.getSeqNo());
    meta.put("lastMessagePreview", truncate(message.getContent(), PREVIEW_MAX_LENGTH));
    meta.put("lastMessageRole", message.getSenderRole());
    meta.put("lastMessageAt", resolveCreatedAt(message).toString());
    session.updateMetaJson(meta.toString());
  }

  private ObjectNode parseMeta(String metaJson) {
    if (metaJson == null || metaJson.isBlank()) {
      return objectMapper.createObjectNode();
    }
    try {
      JsonNode node = objectMapper.readTree(metaJson);
      if (node != null && node.isObject()) {
        return (ObjectNode) node;
      }
    } catch (JsonProcessingException e) {
      log.warn("Invalid legacy chat session metaJson; fallback to empty object", e);
    }
    return objectMapper.createObjectNode();
  }

  private void ensureTitle(ObjectNode meta, ChatSession session, ChatMessage message) {
    if (hasText(meta.path("title").asText(null))) {
      return;
    }

    String title = firstText(meta, "handoffReason");
    if (!hasText(title) && isCustomerRole(message.getSenderRole())) {
      title = truncate(message.getContent(), TITLE_MAX_LENGTH);
    }
    if (!hasText(title)) {
      String customerName = firstText(meta, "customerName");
      if (hasText(customerName)) {
        title = customerName + " 상담";
      }
    }
    if (!hasText(title)) {
      title = hasText(session.getChannel()) ? session.getChannel() + " 상담" : "채팅 상담";
    }
    meta.put("title", truncate(title, TITLE_MAX_LENGTH));
  }

  private static String firstText(ObjectNode meta, String fieldName) {
    String value = meta.path(fieldName).asText(null);
    return hasText(value) ? value.trim() : "";
  }

  private static boolean isCustomerRole(String senderRole) {
    return "USER".equals(senderRole) || "CUSTOMER".equals(senderRole);
  }

  private static OffsetDateTime resolveCreatedAt(ChatMessage message) {
    return message.getCreatedAt() != null ? message.getCreatedAt() : OffsetDateTime.now();
  }

  private static String truncate(String value, int maxLength) {
    if (value == null || value.isBlank()) {
      return "";
    }
    String normalized = value.trim().replaceAll("\\s+", " ");
    if (normalized.length() <= maxLength) {
      return normalized;
    }
    return normalized.substring(0, maxLength - 1).trim() + "…";
  }

  private static boolean hasText(String value) {
    return value != null && !value.isBlank();
  }
}
