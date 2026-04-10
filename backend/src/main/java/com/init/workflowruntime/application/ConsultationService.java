package com.init.workflowruntime.application;

import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.application.dto.ChatSessionResponse;
import com.init.workflowruntime.application.dto.SendMessageRequest;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 상담 시스템의 비즈니스 로직을 처리하는 서비스 클래스입니다. 상담 세션 관리와 메시지 이력 조회, 답변 전송 기능을 담당합니다. */
@Service
@Transactional(readOnly = true)
public class ConsultationService {

  private final ChatSessionRepository chatSessionRepository;
  private final ChatMessageRepository chatMessageRepository;

  public ConsultationService(
      ChatSessionRepository chatSessionRepository, ChatMessageRepository chatMessageRepository) {
    this.chatSessionRepository = chatSessionRepository;
    this.chatMessageRepository = chatMessageRepository;
  }

  public List<ChatSessionResponse> getActiveQueue() {
    List<ChatSession> sessions =
        chatSessionRepository.findByStatusOrderByStartedAtDesc(ChatSessionStatus.OPEN);
    return sessions.stream().map(ChatSessionResponse::from).collect(Collectors.toList());
  }

  public List<ChatMessageResponse> getMessages(@NonNull Long sessionId) {
    ChatSession session =
        chatSessionRepository
            .findById(sessionId)
            .orElseThrow(
                () ->
                    new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + sessionId));

    Long id = session.getId();
    if (id == null) {
      throw new IllegalStateException("Session ID cannot be null");
    }

    return chatMessageRepository.findByChatSessionIdOrderBySeqNoAsc(id).stream()
        .map(ChatMessageResponse::from)
        .collect(Collectors.toList());
  }

  @Transactional
  public ChatMessageResponse sendMessage(
      @NonNull Long sessionId, @NonNull SendMessageRequest request) {
    ChatSession session =
        chatSessionRepository
            .findById(sessionId)
            .orElseThrow(
                () ->
                    new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + sessionId));

    if (session.getId() == null) {
      throw new IllegalStateException("Session ID cannot be null");
    }

    String role = request.isNote() ? "NOTE" : "AGENT";
    String messageType = "TEXT";

    Integer nextSeqNo =
        chatMessageRepository
            .findTopByChatSessionIdOrderBySeqNoDesc(sessionId)
            .map(msg -> msg.getSeqNo() + 1)
            .orElse(1);

    ChatMessage newMessage =
        ChatMessage.create(session.getId(), nextSeqNo, role, messageType, request.getContent());
    chatMessageRepository.save(newMessage);

    return ChatMessageResponse.from(newMessage);
  }

  @Transactional
  public ChatSessionResponse updateSessionStatus(@NonNull Long sessionId, @NonNull String status) {
    ChatSession session =
        chatSessionRepository
            .findById(sessionId)
            .orElseThrow(
                () ->
                    new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + sessionId));

    ChatSessionStatus newStatus;
    try {
      newStatus = ChatSessionStatus.valueOf(status.toUpperCase());
    } catch (IllegalArgumentException e) {
      throw new BadRequestException("UNSUPPORTED_STATUS", "Unsupported status: " + status);
    }

    switch (newStatus) {
      case COMPLETED -> session.closeSession();
      case ACTIVE -> session.activate();
      case RESOLVED -> session.resolve();
      case OPEN -> session.reopen();
    }

    return ChatSessionResponse.from(session);
  }
}
