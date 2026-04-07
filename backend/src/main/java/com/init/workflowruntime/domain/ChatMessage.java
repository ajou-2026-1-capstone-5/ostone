package com.init.workflowruntime.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "chat_message", schema = "runtime")
public class ChatMessage {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "chat_session_id", nullable = false)
  private Long chatSessionId;

  @Column(name = "seq_no", nullable = false)
  private Integer seqNo;

  @Column(name = "sender_role", nullable = false)
  private String senderRole;

  @Column(name = "message_type", nullable = false)
  private String messageType;

  @Column(columnDefinition = "TEXT")
  private String content;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "payload_json", nullable = false)
  private String payloadJson;

  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  protected ChatMessage() {}

  public static ChatMessage create(Long chatSessionId, Integer seqNo, String senderRole, String messageType, String content) {
    if (chatSessionId == null || seqNo == null || senderRole == null) {
      throw new IllegalArgumentException("Session ID, SeqNo, SenderRole missing");
    }
    ChatMessage message = new ChatMessage();
    message.chatSessionId = chatSessionId;
    message.seqNo = seqNo;
    message.senderRole = senderRole;
    message.messageType = messageType != null ? messageType : "TEXT";
    message.content = content;
    message.payloadJson = "{}";
    return message;
  }

  @PrePersist
  protected void onPersist() {
    this.createdAt = OffsetDateTime.now();
  }

  public Long getId() { return id; }
  public Long getChatSessionId() { return chatSessionId; }
  public Integer getSeqNo() { return seqNo; }
  public String getSenderRole() { return senderRole; }
  public String getMessageType() { return messageType; }
  public String getContent() { return content; }
  public String getPayloadJson() { return payloadJson; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
}
