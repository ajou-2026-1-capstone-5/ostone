package com.init.workflowruntime.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatSession;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
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
  private static final String DEFAULT_HANDOFF_REASON = "상담원 확인이 필요합니다.";

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

  @Transactional
  public void recordResolution(
      ChatSession session,
      String outcome,
      String label,
      String status,
      String reason,
      boolean followUpRequired) {
    ObjectNode meta = parseMeta(session.getMetaJson());
    ObjectNode resolution = objectMapper.createObjectNode();
    resolution.put("outcome", outcome);
    resolution.put("label", label);
    resolution.put("status", status);
    resolution.put("followUpRequired", followUpRequired);
    resolution.put("resolvedAt", OffsetDateTime.now().toString());
    if (hasText(reason)) {
      resolution.put("reason", reason.trim());
    }
    meta.set("resolution", resolution);
    session.updateMetaJson(meta.toString());
  }

  @Transactional
  public boolean recordHandoff(ChatSession session, String reason, String nodeId) {
    ObjectNode meta = parseMeta(session.getMetaJson());
    String normalizedReason = hasText(reason) ? reason.trim() : DEFAULT_HANDOFF_REASON;
    String normalizedNodeId = hasText(nodeId) ? nodeId.trim() : "";
    boolean alreadyRequired = meta.path("handoffRequired").asBoolean(false);
    boolean sameReason = normalizedReason.equals(meta.path("handoffReason").asText(""));
    boolean sameNode = normalizedNodeId.equals(meta.path("handoffNodeId").asText(""));
    if (alreadyRequired && sameReason && sameNode) {
      return false;
    }

    meta.put("handoffRequired", true);
    meta.put("handoffReason", normalizedReason);
    meta.put("handoffAt", OffsetDateTime.now().toString());
    if (hasText(normalizedNodeId)) {
      meta.put("handoffNodeId", normalizedNodeId);
    } else {
      meta.remove("handoffNodeId");
    }
    ensureTitleFromHandoff(meta, normalizedReason);
    session.updateMetaJson(meta.toString());
    return true;
  }

  @Transactional
  public void resolveHandoff(ChatSession session) {
    ObjectNode meta = parseMeta(session.getMetaJson());
    if (!meta.path("handoffRequired").asBoolean(false)) {
      return;
    }
    meta.put("handoffRequired", false);
    meta.put("handoffResolvedAt", OffsetDateTime.now().toString());
    session.updateMetaJson(meta.toString());
  }

  public boolean isHandoffRequired(ChatSession session) {
    return parseMeta(session.getMetaJson()).path("handoffRequired").asBoolean(false);
  }

  public OffsetDateTime handoffAt(ChatSession session) {
    String value = parseMeta(session.getMetaJson()).path("handoffAt").asText(null);
    if (!hasText(value)) {
      return null;
    }
    try {
      return OffsetDateTime.parse(value);
    } catch (DateTimeParseException e) {
      log.warn("Invalid chat session handoffAt metadata; fallback to startedAt", e);
      return null;
    }
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

  private void ensureTitleFromHandoff(ObjectNode meta, String reason) {
    if (hasText(meta.path("title").asText(null))) {
      return;
    }
    meta.put("title", truncate(reason, TITLE_MAX_LENGTH));
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
