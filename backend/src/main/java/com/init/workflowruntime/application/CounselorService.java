package com.init.workflowruntime.application;

import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.application.dto.ChatSessionResponse;
import com.init.workflowruntime.application.dto.CounselorSessionResponse;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.domain.event.ConsultationQueueChangedEvent;
import com.init.workflowruntime.domain.event.ConsultationQueueEventType;
import com.init.workflowruntime.domain.event.SessionAssignedEvent;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
@Transactional(readOnly = true)
public class CounselorService {

  private final ChatSessionRepository chatSessionRepository;
  private final ChatMessageRepository chatMessageRepository;
  private final SimpMessagingTemplate messagingTemplate;
  private final ApplicationEventPublisher eventPublisher;
  private final ChatSessionMetadataService chatSessionMetadataService;

  public CounselorService(
      ChatSessionRepository chatSessionRepository,
      ChatMessageRepository chatMessageRepository,
      SimpMessagingTemplate messagingTemplate,
      ApplicationEventPublisher eventPublisher,
      ChatSessionMetadataService chatSessionMetadataService) {
    this.chatSessionRepository = chatSessionRepository;
    this.chatMessageRepository = chatMessageRepository;
    this.messagingTemplate = messagingTemplate;
    this.eventPublisher = eventPublisher;
    this.chatSessionMetadataService = chatSessionMetadataService;
  }

  @Transactional
  public CounselorSessionResponse assignSession(Long counselorId, Long sessionId) {
    validateCounselorId(counselorId);

    ChatSession session =
        chatSessionRepository
            .findByIdForUpdate(sessionId)
            .orElseThrow(
                () ->
                    new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + sessionId));

    session.assignTo(counselorId);
    chatSessionRepository.save(session);

    eventPublisher.publishEvent(new SessionAssignedEvent(sessionId, counselorId));
    eventPublisher.publishEvent(
        new ConsultationQueueChangedEvent(
            session.getWorkspaceId(), sessionId, ConsultationQueueEventType.SESSION_UPSERTED));

    return CounselorSessionResponse.from(session);
  }

  @Transactional
  public CounselorSessionResponse releaseSession(Long sessionId, Long counselorId) {
    validateCounselorId(counselorId);

    ChatSession session =
        chatSessionRepository
            .findByIdForUpdate(sessionId)
            .orElseThrow(
                () ->
                    new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + sessionId));

    if (!Objects.equals(counselorId, session.getAssignedCounselorId())) {
      throw new BadRequestException(
          "SESSION_NOT_ASSIGNED_TO_COUNSELOR",
          "Session " + sessionId + " is not assigned to counselor: " + counselorId);
    }

    session.releaseFrom();
    chatSessionRepository.save(session);
    eventPublisher.publishEvent(
        new ConsultationQueueChangedEvent(
            session.getWorkspaceId(), sessionId, ConsultationQueueEventType.SESSION_UPSERTED));

    return CounselorSessionResponse.from(session);
  }

  public boolean isSessionAssigned(Long sessionId) {
    ChatSession session =
        chatSessionRepository
            .findById(sessionId)
            .orElseThrow(
                () ->
                    new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + sessionId));
    return session.getAssignedCounselorId() != null;
  }

  public List<ChatSessionResponse> getAssignedSessions(Long counselorId) {
    return chatSessionRepository.findByAssignedCounselorId(counselorId).stream()
        .map(ChatSessionResponse::from)
        .collect(Collectors.toList());
  }

  @Transactional
  public ChatMessageResponse sendCounselorMessage(
      Long sessionId, String content, Long counselorId, boolean isNote) {
    validateCounselorId(counselorId);

    ChatSession session =
        chatSessionRepository
            .findByIdForUpdate(sessionId)
            .orElseThrow(
                () ->
                    new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + sessionId));

    if (!Objects.equals(counselorId, session.getAssignedCounselorId())) {
      throw new BadRequestException(
          "SESSION_NOT_ASSIGNED",
          "Session " + sessionId + " is not assigned to counselor: " + counselorId);
    }

    ChatSessionStatus status = session.getStatus();
    if (status != ChatSessionStatus.ACTIVE) {
      throw new BadRequestException(
          "SESSION_NOT_ACTIVE",
          "Session " + sessionId + " is not ACTIVE; current status: " + status);
    }

    Integer nextSeqNo =
        chatMessageRepository
            .findTopByChatSessionIdOrderBySeqNoDesc(sessionId)
            .map(msg -> msg.getSeqNo() + 1)
            .orElse(1);

    String senderRole = isNote ? "NOTE" : "COUNSELOR";
    ChatMessage message = ChatMessage.create(sessionId, nextSeqNo, senderRole, "TEXT", content);
    ChatMessage savedMessage = chatMessageRepository.save(message);
    chatSessionMetadataService.updateAfterMessage(session, savedMessage);

    ChatMessageResponse response = ChatMessageResponse.from(savedMessage);
    String destination = "/topic/chat." + sessionId;
    TransactionSynchronizationManager.registerSynchronization(
        new TransactionSynchronization() {
          @Override
          public void afterCommit() {
            messagingTemplate.convertAndSend(destination, response);
          }
        });

    return response;
  }

  public CounselorSessionResponse getSessions(Long workspaceId, String status, int page, int size) {
    if (workspaceId == null || workspaceId <= 0) {
      throw new BadRequestException(
          "INVALID_WORKSPACE_ID", "workspaceId must be a positive number");
    }
    if (page < 0 || size <= 0) {
      throw new BadRequestException("INVALID_PAGING", "page must be >= 0 and size must be > 0");
    }

    ChatSessionStatus sessionStatus = null;
    if (status != null && !status.isBlank()) {
      try {
        sessionStatus = ChatSessionStatus.valueOf(status.toUpperCase());
      } catch (IllegalArgumentException e) {
        throw new BadRequestException("UNSUPPORTED_STATUS", "Unsupported status: " + status);
      }
    }

    PageRequest pageRequest = PageRequest.of(page, size);
    Page<ChatSession> sessionPage;
    if (sessionStatus != null) {
      sessionPage =
          chatSessionRepository.findByWorkspaceIdAndStatus(workspaceId, sessionStatus, pageRequest);
    } else {
      sessionPage = chatSessionRepository.findByWorkspaceId(workspaceId, pageRequest);
    }

    List<ChatSessionResponse> content =
        sessionPage.getContent().stream()
            .map(ChatSessionResponse::from)
            .collect(Collectors.toList());

    return new CounselorSessionResponse(
        content,
        sessionPage.getNumber(),
        sessionPage.getSize(),
        sessionPage.getTotalElements(),
        sessionPage.getTotalPages());
  }

  private void validateCounselorId(Long counselorId) {
    if (counselorId == null) {
      throw new BadRequestException("INVALID_COUNSELOR_ID", "counselorId must not be null");
    }
  }
}
