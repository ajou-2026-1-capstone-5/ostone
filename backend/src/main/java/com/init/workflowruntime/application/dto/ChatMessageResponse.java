package com.init.workflowruntime.application.dto;

import com.init.workflowruntime.domain.ChatMessage;
import java.time.OffsetDateTime;

/**
 * 채팅 메시지 정보를 전달하는 응답 DTO 클래스입니다. Record 형식을 사용하여 불변성을 보장합니다.
 *
 * @param id 메시지 고유 식별자
 * @param seqNo 메시지 순번
 * @param senderRole 발신자 역할 (USER, AGENT, NOTE 등)
 * @param messageType 메시지 유형 (TEXT 등)
 * @param content 메시지 내용
 * @param createdAt 메시지 생성 시각
 */
public record ChatMessageResponse(
    Long id,
    Integer seqNo,
    String senderRole,
    String messageType,
    String content,
    OffsetDateTime createdAt) {
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
        message.getCreatedAt());
  }
}
