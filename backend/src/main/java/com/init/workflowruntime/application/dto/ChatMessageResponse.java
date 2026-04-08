package com.init.workflowruntime.application.dto;

import com.init.workflowruntime.domain.ChatMessage;
import java.time.OffsetDateTime;

/**
 * 채팅 메시지 정보를 전달하는 응답 DTO 클래스입니다.
 * 메시지 ID, 발신자, 내용, 작성 시각 등의 정보를 포함합니다.
 */
public class ChatMessageResponse {
  /** 메시지 고유 식별자 */
  private final Long id;
  /** 메시지 순번 */
  private final Integer seqNo;
  /** 발신자 역할 (USER, AGENT, NOTE 등) */
  private final String senderRole;
  /** 메시지 유형 (TEXT 등) */
  private final String messageType;
  /** 메시지 내용 */
  private final String content;
  /** 메시지 생성 시각 */
  private final OffsetDateTime createdAt;

  /**
   * 모든 필드를 초기화하는 생성자입니다.
   */
  public ChatMessageResponse(Long id, Integer seqNo, String senderRole, String messageType, String content, OffsetDateTime createdAt) {
    this.id = id;
    this.seqNo = seqNo;
    this.senderRole = senderRole;
    this.messageType = messageType;
    this.content = content;
    this.createdAt = createdAt;
  }

  /**
   * ChatMessage 엔티티를 ChatMessageResponse DTO로 변환합니다.
   *
   * @param message 변환할 메시지 엔티티
   * @return 변환된 응답 DTO
   */
  public static ChatMessageResponse from(ChatMessage message) {
    return new ChatMessageResponse(
      message.getId(),
      message.getSeqNo(),
      message.getSenderRole(),
      message.getMessageType(),
      message.getContent(),
      message.getCreatedAt()
    );
  }

  public Long getId() {
    return id;
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

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }
}