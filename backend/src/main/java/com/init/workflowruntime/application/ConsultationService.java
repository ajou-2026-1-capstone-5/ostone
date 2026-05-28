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
import com.init.workflowruntime.domain.event.ConsultationQueueChangedEvent;
import com.init.workflowruntime.domain.event.ConsultationQueueEventType;
import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 상담 시스템의 비즈니스 로직을 처리하는 서비스 클래스입니다. 상담 세션 관리와 메시지 이력 조회, 답변 전송 기능을 담당합니다. */
@Service
@Transactional(readOnly = true)
public class ConsultationService {

  private final ChatSessionRepository chatSessionRepository;
  private final ChatMessageRepository chatMessageRepository;
  private final WorkspaceMemberRepository workspaceMemberRepository;
  private final ApplicationEventPublisher eventPublisher;
  private final ChatSessionMetadataService chatSessionMetadataService;

  public ConsultationService(
      ChatSessionRepository chatSessionRepository,
      ChatMessageRepository chatMessageRepository,
      WorkspaceMemberRepository workspaceMemberRepository,
      ApplicationEventPublisher eventPublisher,
      ChatSessionMetadataService chatSessionMetadataService) {
    this.chatSessionRepository = chatSessionRepository;
    this.chatMessageRepository = chatMessageRepository;
    this.workspaceMemberRepository = workspaceMemberRepository;
    this.eventPublisher = eventPublisher;
    this.chatSessionMetadataService = chatSessionMetadataService;
  }

  public List<ChatSessionResponse> getActiveQueue(Long workspaceId, Long userId) {
    validateWorkspaceMembership(workspaceId, userId);
    return chatSessionRepository
        .findByWorkspaceIdAndStatusInOrderByStartedAtDesc(
            workspaceId, Arrays.asList(ChatSessionStatus.OPEN, ChatSessionStatus.ACTIVE))
        .stream()
        .map(ChatSessionResponse::from)
        .collect(Collectors.toList());
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
            .findByIdForUpdate(sessionId)
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
    ChatMessage savedMessage = chatMessageRepository.save(newMessage);
    chatSessionMetadataService.updateAfterMessage(session, savedMessage);

    return ChatMessageResponse.from(savedMessage);
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

    eventPublisher.publishEvent(
        new ConsultationQueueChangedEvent(
            session.getWorkspaceId(), sessionId, queueEventTypeFor(newStatus)));

    return ChatSessionResponse.from(session);
  }

  private ConsultationQueueEventType queueEventTypeFor(ChatSessionStatus status) {
    return switch (status) {
      case OPEN, ACTIVE -> ConsultationQueueEventType.SESSION_UPSERTED;
      case RESOLVED, COMPLETED -> ConsultationQueueEventType.SESSION_REMOVED;
    };
  }

  private void validateWorkspaceMembership(Long workspaceId, Long userId) {
    workspaceMemberRepository
        .findByWorkspaceIdAndUserId(workspaceId, userId)
        .orElseThrow(() -> new WorkspaceAccessDeniedException("워크스페이스에 접근 권한이 없습니다."));
  }
}
