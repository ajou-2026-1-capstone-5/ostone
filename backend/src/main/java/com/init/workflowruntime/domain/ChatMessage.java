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

/** 상담 시스템에서 개별 메시지 데이터를 나타내는 엔티티 클래스입니다. 세션 정보, 발신자 역할, 메시지 유형 및 내용을 저장합니다. */
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

  /**
   * 새로운 채팅 메시지 인스턴스를 생성하는 정적 팩토리 메서드입니다.
   *
   * @param chatSessionId 연결될 세션 ID
   * @param seqNo 메시지 순번
   * @param senderRole 발신자 역할 (USER, AGENT, NOTE 등)
   * @param messageType 메시지 유형 (TEXT 등)
   * @param content 메시지 본문
   * @return 생성된 ChatMessage 인스턴스
   */
  public static ChatMessage create(
      Long chatSessionId, Integer seqNo, String senderRole, String messageType, String content) {
    if (chatSessionId == null) {
      throw new IllegalArgumentException("chatSessionId must not be null");
    }
    if (seqNo == null || seqNo <= 0) {
      throw new IllegalArgumentException("seqNo must be a positive integer");
    }
    if (senderRole == null || senderRole.isBlank()) {
      throw new IllegalArgumentException("senderRole must not be blank");
    }
    if (messageType == null || messageType.isBlank()) {
      throw new IllegalArgumentException("messageType must not be blank");
    }
    ChatMessage message = new ChatMessage();
    message.chatSessionId = chatSessionId;
    message.seqNo = seqNo;
    message.senderRole = senderRole.trim();
    message.messageType = messageType.trim();
    message.content = content;
    message.payloadJson = "{}";
    return message;
  }

  @PrePersist
  protected void onPersist() {
    this.createdAt = OffsetDateTime.now();
  }

  public Long getId() {
    return id;
  }

  public Long getChatSessionId() {
    return chatSessionId;
  }

  public Integer getSeqNo() {
    return seqNo;
  }

  public String getSenderRole() {
    return senderRole;
  }

  public String getMessageType() {
    return messageType;
  }

  public String getContent() {
    return content;
  }

  public String getPayloadJson() {
    return payloadJson;
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }
}
