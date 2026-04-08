package com.init.workflowruntime.application.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.init.workflowruntime.domain.ChatMessage;
import java.time.OffsetDateTime;

/**
 * 채팅 메시지 정보를 전달하는 응답 DTO 클래스입니다.
 * 메시지 ID, 발신자, 내용, 작성 시각 등의 정보를 포함합니다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class ChatMessageResponse {
  /** 메시지 고유 식별자 */
  private Long id;
  /** 메시지 순번 */
  private Integer seqNo;
  /** 발신자 역할 (USER, AGENT, NOTE 등) */
  private String senderRole;
  /** 메시지 유형 (TEXT 등) */
  private String messageType;
  /** 메시지 내용 */
  private String content;
  /** 메시지 생성 시각 */
  private OffsetDateTime createdAt;

  /**
   * ChatMessage 엔티티를 ChatMessageResponse DTO로 변환합니다.
   *
   * @param message 변환할 메시지 엔티티
   * @return 변환된 응답 DTO
   */
  public static ChatMessageResponse from(ChatMessage message) {
    ChatMessageResponse resp = new ChatMessageResponse();
    resp.id = message.getId();
    resp.seqNo = message.getSeqNo();
    resp.senderRole = message.getSenderRole();
    resp.messageType = message.getMessageType();
    resp.content = message.getContent();
    resp.createdAt = message.getCreatedAt();
    return resp;
  }

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public Integer getSeqNo() {
    return seqNo;
  }

  public void setSeqNo(Integer seqNo) {
    this.seqNo = seqNo;
  }

  public String getSenderRole() {
    return senderRole;
  }

  public void setSenderRole(String senderRole) {
    this.senderRole = senderRole;
  }

  public String getMessageType() {
    return messageType;
  }

  public void setMessageType(String messageType) {
    this.messageType = messageType;
  }

  public String getContent() {
    return content;
  }

  public void setContent(String content) {
    this.content = content;
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(OffsetDateTime createdAt) {
    this.createdAt = createdAt;
  }
}
